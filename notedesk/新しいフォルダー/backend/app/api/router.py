from fastapi import APIRouter, HTTPException, Depends, Request, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from app.services.scenario import scenario_service
from app.services.image_gen import image_gen_service
from app.services.checkpoint import checkpoint_manager
from app.tasks import generate_webtoon_task
from celery.result import AsyncResult
from typing import List, Dict, Optional
import redis.asyncio as aioredis
import json
import os
import asyncio
from app.core.auth import verify_api_key, ALLOWED_API_KEYS
from app.core.responses import StandardResponse
import structlog
from app.core.limiter import limiter
from app.core.exceptions import WebtoonGenerationError
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.core.db import get_db
from app.models.db import Character, WebtoonWork
from app.services.work_service import work_service

logger = structlog.get_logger(__name__)

router = APIRouter()

class CharacterPlotConfig(BaseModel):
    name: str = Field(..., description="キャラクターの名前")
    description: Optional[str] = Field(None, description="キャラクターの外見や特徴の詳細設定")
    character_id: Optional[int] = Field(None, description="事前登録されたキャラクターのID")

class PlotRequest(BaseModel):
    plot: str = Field(..., min_length=1, max_length=2000, description="Webtoonのあらすじ。1文字以上2000文字以内で入力してください。")
    style: Optional[str] = Field(None, description="選択した画風（例: 'anime', 'realistic'）")
    characters: List[CharacterPlotConfig] = Field(default_factory=list, description="登場キャラクターのリスト")
    mode: Optional[str] = Field("advanced", description="制作モード ('easy' または 'advanced')")

class CharacterCreate(BaseModel):
    name: str = Field(..., description="キャラクターの名前")
    reference_image_url: Optional[str] = Field(None, description="InstantID用のキャラクター参照画像URL")
    prompt: str = Field(..., description="キャラクターの特徴を表すプロンプト")

class CharacterResponse(BaseModel):
    id: int
    name: str
    reference_image_url: Optional[str] = None
    prompt: str

    model_config = {
        "from_attributes": True
    }

class PanelResponse(BaseModel):
    panel: int
    dialogue: str
    visual_description: str
    emotion: str
    effect: Optional[str] = None
    composition: Optional[str] = None
    image_url: Optional[str] = None

class RegeneratePanelRequest(BaseModel):
    task_id: str
    panel_index: int
    custom_prompt: Optional[str] = Field(None, description="再生成に使用するカスタムプロンプト。指定がない場合は元の記述が使用されます。")
    user_control_image_url: Optional[str] = Field(None, description="ユーザーがアップロードしたラフスケッチ/構図ガイド画像のURL")
    regen_type: str = Field("all", description="再生成のタイプ: 'all' (全て), 'image' (画像のみ), 'audio' (音声のみ), 'director' (AI Directorによる再選定)")

class PromoteCandidateRequest(BaseModel):
    task_id: str
    panel_index: int
    candidate_url: str

class UpdateDialogueRequest(BaseModel):
    task_id: str
    panel_index: int
    new_dialogue: str

class SaveDraftRequest(BaseModel):
    task_id: str
    plot: str
    style: Optional[str] = None
    characters: Optional[List[Dict]] = None
    panels: Optional[List[Dict]] = None

class UpdatePanelEffectRequest(BaseModel):
    task_id: str
    panel_index: int
    effect: str
    emotion: Optional[str] = None

async def get_async_redis():
    """
    アプリケーションライフサイクルで管理されるRedisコネクションプールから接続を取得する。
    """
    from app.main import app
    redis_pool = getattr(app.state, "redis_pool", None)
    if redis_pool is None:
        raise HTTPException(status_code=503, detail="Redis connection pool is not available.")
    async with aioredis.Redis(connection_pool=redis_pool) as redis:
        yield redis

@router.post(
    "/generate-scenario",
    response_model=StandardResponse[List[PanelResponse]],
    dependencies=[Depends(verify_api_key)],
    summary="Webtoonのシナリオ生成",
    description="入力されたあらすじとキャラクター情報に基づいて、Webtoonのコマ割りごとのシナリオを生成します。"
)
@limiter.limit("5/minute")
async def generate_scenario(request: Request, request_data: PlotRequest):
    request_id = structlog.contextvars.get_contextvars().get("request_id")
    try:
        # mode と characters リストを scenario_service に渡す
        scenario = await scenario_service.generate_scenario(
            plot_summary=request_data.plot,
            characters=request_data.characters,
            mode=request_data.mode
        )
        return StandardResponse.ok(data=scenario, request_id=request_id)
    except ValueError as e:
        return StandardResponse.fail(code="INVALID_INPUT", message=str(e), request_id=request_id)
    except WebtoonGenerationError as e:
        return StandardResponse.fail(code="GENERATION_ERROR", message=str(e), request_id=request_id)
    except Exception as e:
        logger.error(f"Unexpected error in generate_scenario: {str(e)}")
        return StandardResponse.fail(code="INTERNAL_ERROR", message="An unexpected error occurred while generating the scenario.", detail=str(e), request_id=request_id)

@router.post("/characters", response_model=CharacterResponse, dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def create_character(request: Request, char_in: CharacterCreate, db: AsyncSession = Depends(get_db)):
    """
    事前登録キャラクターの作成
    """
    request_id = structlog.contextvars.get_contextvars().get("request_id")
    try:
        db_char = Character(
            name=char_in.name,
            reference_image_url=char_in.reference_image_url,
            prompt=char_in.prompt
        )
        db.add(db_char)
        await db.commit()
        await db.refresh(db_char)
        return StandardResponse.ok(data=db_char, request_id=request_id)
    except Exception as e:
        logger.error(f"Error creating character: {str(e)}")
        return StandardResponse.fail(code="DB_ERROR", message="キャラクターの作成に失敗しました。", detail=str(e), request_id=request_id)

@router.get("/characters", response_model=List[CharacterResponse], dependencies=[Depends(verify_api_key)])
@limiter.limit("15/minute")
async def list_characters(request: Request, db: AsyncSession = Depends(get_db)):
    """
    登録済みキャラクターの一覧取得
    """
    request_id = structlog.contextvars.get_contextvars().get("request_id")
    try:
        result = await db.execute(select(Character))
        return StandardResponse.ok(data=result.scalars().all(), request_id=request_id)
    except Exception as e:
        logger.error(f"Error listing characters: {str(e)}")
        return StandardResponse.fail(code="DB_ERROR", message="キャラクター一覧の取得に失敗しました。", detail=str(e), request_id=request_id)

@router.post(
    "/generate-webtoon",
    dependencies=[Depends(verify_api_key)],
    summary="Webtoon生成タスクの開始",
    description="シナリオ生成、画像生成、音声生成などを一括で行う非同期タスクを開始します。タスクIDが返され、進捗はストリーミングエンドポイントで取得できます。"
)
@limiter.limit("3/minute")
async def start_generate_webtoon(request: Request, request_data: PlotRequest):
    """
    Webtoon生成タスクを非同期で開始し、タスクIDを返す。
    """
    request_id = structlog.contextvars.get_contextvars().get("request_id")
    # APIキーの検証などは Depends(verify_api_key) で行われている
    task = generate_webtoon_task.delay(
        plot=request_data.plot,
        style=request_data.style,
        characters=[char.model_dump() for char in request_data.characters],
        mode=request_data.mode,
        request_id=request_id
    )
    return StandardResponse.ok(data={"task_id": task.id, "status": "processing"}, request_id=request_id)

@router.post(
    "/resume/{task_id}",
    dependencies=[Depends(verify_api_key)],
    summary="一部失敗したタスクの再開",
    description="部分的に失敗したWebtoon生成タスクを、成功したコマの処理をスキップして途中から再開します。"
)
@limiter.limit("5/minute")
async def resume_webtoon_task(request: Request, task_id: str):
    """
    一部失敗したタスクを完了したパネルはスキップして途中から再開する。
    """
    request_id = structlog.contextvars.get_contextvars().get("request_id")
    state = await checkpoint_manager.get_task_state(task_id)
    if not state:
        return StandardResponse.fail(code="NOT_FOUND", message="Task not found", request_id=request_id)
    
    # 失敗中または部分完了状態（partial / failed）の場合のみ再開可能
    if state["status"] not in ("partial", "failed"):
        return StandardResponse.fail(
            code="INVALID_STATE",
            message=f"Task is in state '{state['status']}', cannot resume",
            request_id=request_id
        )
    
    # 再開タスクリプトを同一IDで起動
    generate_webtoon_task.apply_async(
        args=[""],
        kwargs={"resume": True, "request_id": request_id},
        task_id=task_id
    )
    return StandardResponse.ok(data={
        "task_id": task_id,
        "status": "resuming",
        "completed_panels": int(state.get("completed_panels", 0)),
        "total_panels": int(state.get("total_panels", 4))
    }, request_id=request_id)

@router.post("/regenerate-panel", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def regenerate_panel(request: Request, request_data: RegeneratePanelRequest):
    """
    特定のコマだけを再生成する。
    """
    request_id = structlog.contextvars.get_contextvars().get("request_id")
    from app.tasks import regenerate_panel_task
    
    # タスクの存在確認
    state = await checkpoint_manager.get_task_state(request_data.task_id)
    if not state:
        return StandardResponse.fail(code="NOT_FOUND", message="Task not found", request_id=request_id)

    task = regenerate_panel_task.delay(
        request_data.task_id,
        request_data.panel_index,
        custom_prompt=request_data.custom_prompt,
        user_control_image_url=request_data.user_control_image_url,
        request_id=request_id
    )
    return StandardResponse.ok(data={"task_id": task.id, "status": "regenerating", "panel": request_data.panel_index}, request_id=request_id)

from app.models.director_schemas import UpdateDirectorPlanRequest

@router.get("/director-plan/{task_id}/{panel_index}", dependencies=[Depends(verify_api_key)])
async def get_director_plan(request: Request, task_id: str, panel_index: int):
    try:
        plan = await checkpoint_manager.get_director_plan(task_id, panel_index)
        if not plan:
            raise HTTPException(status_code=404, detail="Director plan not found")
        return plan
    except Exception as e:
        import structlog
        logger = structlog.get_logger()
        logger.error(f"Error getting director plan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/update-director-plan", dependencies=[Depends(verify_api_key)])
async def update_director_plan(request: Request, request_data: UpdateDirectorPlanRequest):
    try:
        # 既存のプランを取得
        current_plan = await checkpoint_manager.get_director_plan(
            request_data.task_id, request_data.panel_index
        )
        if not current_plan:
            raise HTTPException(status_code=404, detail="Director plan not found")
        
        # 部分更新を適用
        updated_plan = current_plan.copy()
        update_fields = request_data.model_dump(exclude_unset=True)
        updated_plan.update({k: v for k, v in update_fields.items() if k not in ['task_id', 'panel_index']})
        
        # 保存
        await checkpoint_manager.save_director_plan(
            request_data.task_id, request_data.panel_index, updated_plan
        )
        
        return {"status": "success", "message": "Director plan updated successfully"}
    except Exception as e:
        import structlog
        logger = structlog.get_logger()
        logger.error(f"Error updating director plan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/promote-candidate", dependencies=[Depends(verify_api_key)])
async def promote_candidate(request: Request, request_data: PromoteCandidateRequest):
    try:
        from app.services.evaluator_service import evaluator_service
        best_shot = {"url": request_data.candidate_url}
        await evaluator_service.promote_best_shot(request_data.task_id, request_data.panel_index, best_shot)
        return {"status": "success", "message": "Candidate promoted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/candidates/{task_id}/{panel_index}", dependencies=[Depends(verify_api_key)])
async def get_candidates(task_id: str, panel_index: int):
    try:
        from app.core.db import SessionLocal
        from app.models.db import ImageCandidate
        from sqlalchemy import select
        
        async with SessionLocal() as session:
            stmt = select(ImageCandidate).where(
                ImageCandidate.task_id == task_id,
                ImageCandidate.panel_index == panel_index
            )
            result = await session.execute(stmt)
            candidates = result.scalars().all()
            return [
                {
                    "url": c.url,
                    "score": c.score,
                    "status": c.status,
                    "evaluation_reason": c.evaluation_reason
                } for c in candidates
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/update-dialogue", dependencies=[Depends(verify_api_key)])
@limiter.limit("20/minute")
async def update_dialogue(request: Request, request_data: UpdateDialogueRequest):
    """
    コマのダイアログを更新する。
    """
    request_id = structlog.contextvars.get_contextvars().get("request_id")
    state = await checkpoint_manager.get_task_state(request_data.task_id)
    if not state:
        return StandardResponse.fail(code="NOT_FOUND", message="Task not found", request_id=request_id)
    
    try:
        scenario = json.loads(state["scenario"])
        if request_data.panel_index < 0 or request_data.panel_index >= len(scenario):
            return StandardResponse.fail(code="INVALID_INDEX", message="Invalid panel index", request_id=request_id)
        
        scenario[request_data.panel_index]["dialogue"] = request_data.new_dialogue
        
        # チェックポイントのシナリオを更新
        await checkpoint_manager.init_task(
            request_data.task_id,
            len(scenario),
            scenario
        )
        
        return StandardResponse.ok(data={"status": "success", "message": "Dialogue updated"}, request_id=request_id)
    except Exception as e:
        logger.error(f"Error updating dialogue: {str(e)}")
        return StandardResponse.fail(code="INTERNAL_ERROR", message="Failed to update dialogue", detail=str(e), request_id=request_id)

@router.patch("/update-panel-effect", dependencies=[Depends(verify_api_key)])
@limiter.limit("20/minute")
async def update_panel_effect(request: Request, request_data: UpdatePanelEffectRequest):
    """
    コマの演出エフェクトや感情を更新する。
    """
    request_id = structlog.contextvars.get_contextvars().get("request_id")
    state = await checkpoint_manager.get_task_state(request_data.task_id)
    if not state:
        return StandardResponse.fail(code="NOT_FOUND", message="Task not found", request_id=request_id)
    
    try:
        scenario = json.loads(state["scenario"])
        if request_data.panel_index < 0 or request_data.panel_index >= len(scenario):
            return StandardResponse.fail(code="INVALID_INDEX", message="Invalid panel index", request_id=request_id)
        
        scenario[request_data.panel_index]["effect"] = request_data.effect
        if request_data.emotion:
            scenario[request_data.panel_index]["emotion"] = request_data.emotion
        
        # チェックポイントのシナリオを更新
        await checkpoint_manager.init_task(
            request_data.task_id,
            len(scenario),
            scenario
        )
        
        return StandardResponse.ok(data={"status": "success", "message": "Panel effect updated"}, request_id=request_id)
    except Exception as e:
        logger.error(f"Error updating panel effect: {str(e)}")
        return StandardResponse.fail(code="INTERNAL_ERROR", message="Failed to update panel effect", detail=str(e), request_id=request_id)

@router.get(
    "/stream/{task_id}",
    summary="タスク進捗のストリーミング (SSE)",
    description="Celery Worker からのタスク進捗イベントを Server-Sent Events (SSE) でリアルタイムに配信します。"
)
@limiter.limit("10/minute")
async def stream_task_progress(request: Request, task_id: str, api_key: Optional[str] = Query(None, alias="api_key"), redis_conn: aioredis.Redis = Depends(get_async_redis)):
    """
    SSE (Server-Sent Events) を用いて、Celery Worker が Redis Pub/Sub に
    発行するタスク進捗イベントをクライアントへストリーム配信する。
    """
    if not api_key or api_key not in ALLOWED_API_KEYS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key missing or invalid"
        )
    async def event_generator():
        pubsub = redis_conn.pubsub()
        await pubsub.subscribe(f"task:{task_id}:events")
        
        try:
            # 接続時に現在の状態があれば init イベントとして送信する
            state = await checkpoint_manager.get_task_state(task_id)
            if state:
                yield f"event: init\ndata: {json.dumps(state, ensure_ascii=False)}\n\n"
                
            while True:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0
                )
                if message and message["type"] == "message":
                    data = message["data"]
                    parsed = json.loads(data)
                    event_type = parsed.get("type", "progress")
                    yield f"event: {event_type}\ndata: {data}\n\n"
                    
                    if event_type in ("completed", "error"):
                        break
                else:
                    # Keep-alive (タイムアウト防止用)
                    yield ": keepalive\n\n"
        finally:
            await pubsub.unsubscribe(f"task:{task_id}:events")
            await pubsub.close()
            
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

class SaveWorkRequest(BaseModel):
    title: str
    plot: str
    style: Optional[str] = None
    character_description: Optional[str] = None
    scenario: List[Dict]

@router.post(
    "/save-work",
    dependencies=[Depends(verify_api_key)]
)
async def save_work(request: Request, request_data: SaveWorkRequest, db: AsyncSession = Depends(get_db)):
    request_id = structlog.contextvars.get_contextvars().get("request_id")
    try:
        work_id = await work_service.save_work(
            db,
            title=request_data.title,
            plot=request_data.plot,
            style=request_data.style,
            character_description=request_data.character_description,
            scenario=request_data.scenario
        )
        return StandardResponse.ok(data={"status": "success", "work_id": work_id}, request_id=request_id)
    except Exception as e:
        logger.error(f"Error saving work: {str(e)}")
        return StandardResponse.fail(code="DB_ERROR", message="作品の保存に失敗しました。", detail=str(e), request_id=request_id)

@router.get(
    "/works",
    dependencies=[Depends(verify_api_key)]
)
async def list_works(
    request: Request,
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
    offset: int = 0
):
    request_id = structlog.contextvars.get_contextvars().get("request_id")
    from app.services.work_service import work_service
    try:
        works = await work_service.list_works(db, limit, offset)
        return StandardResponse.ok(data=works, request_id=request_id)
    except Exception as e:
        logger.error(f"Error listing works: {str(e)}")
        return StandardResponse.fail(code="DB_ERROR", message="作品一覧の取得に失敗しました。", detail=str(e), request_id=request_id)

@router.post(
    "/save-draft",
    dependencies=[Depends(verify_api_key)],
    summary="下書きの保存",
    description="生成中の作品の状態を保存し、後で再開できるようにします。"
)
async def save_draft(request: Request, request_data: SaveDraftRequest, db: AsyncSession = Depends(get_db)):
    request_id = structlog.contextvars.get_contextvars().get("request_id")
    try:
        from app.services.work_service import work_service
        result = await work_service.save_draft(db, request_data)
        return StandardResponse.ok(data=result, request_id=request_id)
    except Exception as e:
        logger.error(f"Error saving draft: {str(e)}")
        return StandardResponse.fail(code="DB_ERROR", message="下書きの保存に失敗しました。", detail=str(e), request_id=request_id)

@router.get(
    "/works/{work_id}",
    dependencies=[Depends(verify_api_key)]
)
async def get_work(
    request: Request,
    work_id: int,
    db: AsyncSession = Depends(get_db)
):
    request_id = structlog.contextvars.get_contextvars().get("request_id")
    from app.services.work_service import work_service
    try:
        result = await work_service.get_work_with_panels(db, work_id)
        if not result:
            return StandardResponse.fail(code="NOT_FOUND", message="Work not found", request_id=request_id)
        return StandardResponse.ok(data=result, request_id=request_id)
    except Exception as e:
        logger.error(f"Error getting work {work_id}: {str(e)}")
        return StandardResponse.fail(code="INTERNAL_ERROR", message="作品の取得に失敗しました。", detail=str(e), request_id=request_id)

@router.get("/task-status/{task_id}", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def get_task_status(request: Request, task_id: str):
    """
    タスクの進捗状況または結果を返す（下位互換用）。
    """
    task_result = AsyncResult(task_id)
    
    if task_result.state == 'PENDING':
        return {"status": "pending"}
    elif task_result.state == 'PROGRESS':
        return {"status": "processing", "meta": task_result.info}
    elif task_result.state == 'SUCCESS':
        return {"status": "completed", "result": task_result.result}
    elif task_result.state == 'FAILURE':
        return {"status": "failed", "error": str(task_result.info)}
    
    return {"status": task_result.state}

@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    checks: dict[str, str] = {"api": "healthy"}

    # DB 接続確認
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "healthy"
    except Exception as e:
        checks["database"] = f"unhealthy: {str(e)}"

    # Redis 接続確認
    try:
        from app.main import app
        redis_pool = getattr(app.state, "redis_pool", None)
        if redis_pool:
            async with aioredis.Redis(connection_pool=redis_pool) as redis:
                await redis.ping()
            checks["redis"] = "healthy"
        else:
            checks["redis"] = "not_configured"
    except Exception as e:
        checks["redis"] = f"unhealthy: {str(e)}"

    all_healthy = all(v == "healthy" for v in checks.values())
    return {"status": "healthy" if all_healthy else "degraded", "checks": checks}

@router.get("/verify-key", dependencies=[Depends(verify_api_key)])
async def verify_api_key_endpoint(request: Request):
    """
    APIキーが有効であることを確認するエンドポイント。
    Depends(verify_api_key) を通過すれば有効。
    """
    request_id = structlog.contextvars.get_contextvars().get("request_id")
    return StandardResponse.ok(data={"status": "valid", "message": "API key is valid"}, request_id=request_id)
