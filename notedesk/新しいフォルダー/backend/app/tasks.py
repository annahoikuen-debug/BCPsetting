from app.worker import celery_app
from app.services.scenario import scenario_service
from app.services.image_gen import image_gen_service
from app.services.composition import composition_service
from app.services.voice import voice_service
from app.services.bgm import bgm_service
from app.services.prompt_builder import prompt_builder
from app.services.character_service import character_service
from app.services.background_service import BackgroundService
from app.services.checkpoint import checkpoint_manager
from app.services.evaluator_service import evaluator_service
from app.services.consistency_service import character_consistency_service
from app.core.db import async_session_maker as SessionLocal
from typing import Optional, List, Dict
from app.core.exceptions import WebtoonGenerationError, LLMAPIError, ImageGenerationError, ResourceProcessingError
import logging
import structlog
import asyncio
import json
import redis
from app.core.config import settings
from app.core.constants import TaskEventType, CompositionPosition, CELERY_TASK_TIMEOUT

# AI Director用イベントを追加 (本来は constants.py で定義すべきだが、まずはここに追加)
class DirectorEventType:
    PLANNING_START = "director_planning_start"
    PLANNING_COMPLETE = "director_planning_complete"
    EVALUATING = "image_evaluating"

logger = structlog.get_logger(__name__)

# 非同期ではないRedisクライアント(Pub/Sub配信用)
redis_client = redis.Redis.from_url(settings.CELERY_BROKER_URL)

async def _generate_image_assets(
    task_id: str,
    panel_data: dict,
    style: Optional[str],
    char_prompt_base: str,
    char_ref_url: Optional[str],
    bg_ref_url: Optional[str],
    visual_prompt: str,
    characters: List[Dict] = None,
    pose: Optional[str] = None,
    custom_prompt: Optional[str] = None,
    seed: Optional[int] = None,
    work_id: Optional[int] = None,
    db_session: Optional[AsyncSession] = None,
    user_control_image_url: Optional[str] = None,
) -> tuple[dict, Optional[str], Optional[str]]:
    """パネルの画像アセット（背景、キャラクター、合成後）を生成する"""
    # 背景生成
    composition = panel_data.get("composition", "medium_shot")
    bg_prompt = prompt_builder.build_background_prompt(visual_prompt, style, composition=composition, is_reference=bool(bg_ref_url))
    
    # シーンベースの背景ライブラリ確認 (フェーズ2)
    scene_name = panel_data.get("scene_name")
    if scene_name and work_id and db_session:
        bg_service = BackgroundService()
        existing_bg = await bg_service.get_background_by_scene(db_session, work_id, scene_name)
        if existing_bg:
            bg_ref_url = existing_bg.image_url
            # 既存の高品質背景をそのまま利用するか、それを参照に生成
            bg_image_url = await image_gen_service.generate_with_reference(bg_prompt, bg_ref_url, seed=seed)
            logger.info(f"Using existing background for scene: {scene_name}")
        else:
            # 新規生成して保存
            bg_image_url = await image_gen_service.text_to_image(bg_prompt, seed=seed)
            if bg_image_url:
                await bg_service.save_background(db_session, work_id, scene_name, bg_image_url, bg_prompt)
            bg_ref_url = bg_image_url
    else:
        # 従来のフォールバック処理
        if not bg_ref_url:
            bg_image_url = await image_gen_service.text_to_image(bg_prompt, seed=seed)
            await checkpoint_manager.save_bg_ref(task_id, bg_image_url)
            bg_ref_url = bg_image_url
        else:
            bg_image_url = await image_gen_service.generate_with_reference(bg_prompt, bg_ref_url, seed=seed)

    # キャラクター生成
    composition = panel_data.get("composition", "medium_shot")
    full_char_prompt = prompt_builder.build_character_prompt(
        visual_prompt=visual_prompt,
        style=style,
        characters=characters,
        char_prompt_base=char_prompt_base,
        composition=composition,
        pose=pose
    )

    # キャラクター一貫性のためのLoRA/タグ情報の抽出
    lora_name = None
    lora_weight = None
    if characters:
        # 最初のメインキャラクターのLoRA設定を優先的に使用
        first_char = characters[0]
        lora_name = first_char.get("lora_name")
        lora_weight = first_char.get("lora_weight") if first_char.get("lora_weight") else 0.8

    # 構図制御 (ControlNet) の適用 (フェーズ3)
    # ユーザー提供のラフスケッチがあれば優先し、なければプリセットから取得
    if user_control_image_url:
        control_image_url = user_control_image_url
    else:
        control_image_url = await composition_service.get_composition_hint_url(composition)
    
    if not char_ref_url:
        # 初回生成時はControlNetを使用して構図を固定
        char_image_url = await image_gen_service.generate_with_controlnet(
            prompt=full_char_prompt,
            control_image_url=control_image_url,
            seed=seed
        )
        char_ref_url = char_image_url
        await checkpoint_manager.save_char_ref(task_id, char_ref_url)
    else:
        # 2回目以降は、キャラクター参照(InstantID/LoRA) + 構図制御(ControlNet)を組み合わせたいが
        # 現状はControlNetを優先して構図を維持
        char_image_url = await image_gen_service.generate_with_controlnet(
            prompt=full_char_prompt,
            control_image_url=control_image_url,
            seed=seed
        )

    # 合成処理 (Celeryタスク経由)
    subtask = composite_layers_task.delay(
        bg_image_url,
        char_image_url,
        panel_data.get("dialogue", ""),
        panel_data.get("composition", CompositionPosition.CENTER)
    )
    final_image_url = await asyncio.to_thread(subtask.get, timeout=CELERY_TASK_TIMEOUT)

    return {
        "bg_image_url": bg_image_url,
        "char_image_url": char_image_url,
        "final_image_url": final_image_url,
    }, char_ref_url, bg_ref_url

async def _generate_audio_assets(panel_data: dict) -> dict:
    """パネルの音声アセット（セリフ、BGM）を生成する"""
    audio_url = await voice_service.generate_voice(panel_data.get("dialogue", ""))
    bgm_url = await bgm_service.generate_bgm(panel_data.get("emotion", "default"), panel_data.get("visual_description", ""))
    return {"audio_url": audio_url, "bgm_url": bgm_url}

async def _generate_single_panel(
    task_id: str,
    panel_index: int,
    panel_data: dict,
    style: Optional[str],
    char_prompt_base: str,
    char_ref_url: Optional[str],
    bg_ref_url: Optional[str],
    characters: List[Dict] = None,
    custom_prompt: Optional[str] = None,
    regen_type: str = "all",
    current_panel_state: Optional[dict] = None,
    seed: Optional[int] = None,
    work_id: Optional[int] = None,
    db_session: Optional[AsyncSession] = None,
    user_control_image_url: Optional[str] = None,
) -> tuple[dict, Optional[str], Optional[str]]:
    """
    1パネル分の生成処理をカプセル化したヘルパー関数。
    戻り値: (生成結果の辞書, 更新されたchar_ref_url)
    """
    # 既存の成果物をロード（部分再生成のため）
    bg_image_url = current_panel_state.get("bg_image_url") if current_panel_state else None
    char_image_url = current_panel_state.get("char_image_url") if current_panel_state else None
    final_image_url = current_panel_state.get("final_image_url") if current_panel_state else None
    audio_url = current_panel_state.get("audio_url") if current_panel_state else None
    bgm_url = current_panel_state.get("bgm_url") if current_panel_state else None

    visual_prompt = custom_prompt or panel_data.get("visual_prompt", panel_data["visual_description"])

    # --- 画像生成ロジック ---
    if regen_type in ["all", "image"]:
        assets, updated_char_ref, updated_bg_ref = await _generate_image_assets(
            task_id=task_id,
            panel_data=panel_data,
            style=style,
            char_prompt_base=char_prompt_base,
            char_ref_url=char_ref_url,
            bg_ref_url=bg_ref_url,
            visual_prompt=visual_prompt,
            characters=characters,
            pose=panel_data.get("pose"),
            seed=seed,
            work_id=None,
            db_session=None,
            user_control_image_url=user_control_image_url
        )
        bg_image_url = assets["bg_image_url"]
        char_image_url = assets["char_image_url"]
        final_image_url = assets["final_image_url"]
        char_ref_url = updated_char_ref
        bg_ref_url = updated_bg_ref

    # --- 音声・BGM生成ロジック ---
    if regen_type in ["all", "audio"]:
        assets = await _generate_audio_assets(panel_data)
        audio_url = assets["audio_url"]
        bgm_url = assets["bgm_url"]

    return {
        "bg_image_url": bg_image_url or "",
        "char_image_url": char_image_url or "",
        "final_image_url": final_image_url or "",
        "audio_url": audio_url or "",
        "bgm_url": bgm_url or "",
    }, char_ref_url, bg_ref_url

def publish_progress(task_id: str, event_type: str, data: dict):
    """Redis Pub/Sub で進捗イベントを発行"""
    message = json.dumps({
        "type": event_type,
        **data
    }, ensure_ascii=False)
    redis_client.publish(f"task:{task_id}:events", message)

async def _async_generate_webtoon_task(self, plot: str, style: Optional[str] = None, characters: List[Dict] = None, resume: bool = False, mode: str = 'advanced', request_id: Optional[str] = None):
    """
    非同期でシナリオ生成、レイヤー別画像生成、合成、ボイス適用を行うタスク。
    チェックポイント、部分再開(スキップ続行形式)に対応。
    """
    task_id = self.request.id
    if request_id:
        structlog.contextvars.bind_contextvars(request_id=request_id)
    
    try:
        # 1. シナリオの取得 (再開の場合はチェックポイントから復元)
        if resume:
            state = await checkpoint_manager.get_task_state(task_id)
            if not state:
                raise WebtoonGenerationError("No checkpoint found for this task ID.")
            
            # 演出プランが既に存在するか確認
            # 全コマの演出プランが揃っているかチェック
            scenario = json.loads(state["scenario"])
            has_all_plans = True
            for i in range(len(scenario)):
                if not await checkpoint_manager.get_director_plan(task_id, i):
                    has_all_plans = False
                    break
            
            if has_all_plans:
                logger.info(f"Resuming from director plans for task {task_id}")
                # 演出プランがある場合は、脚本深化/演出策定フェーズをスキップ可能
            else:
                logger.info(f"Resuming without complete director plans for task {task_id}")
            
            char_ref_url = state.get("char_ref_base64") or None
            bg_ref_url = state.get("bg_ref_url") or None
            style = state.get("style") or None
            characters = json.loads(state.get("characters", "[]"))
            char_prompt_base = state.get("char_prompt_base") or ""
            # シード値を復元 (Redisでは文字列で保存されているためintに変換)
            seed_val = state.get("seed")
            seed = int(seed_val) if seed_val and seed_val.isdigit() else None
        else:
            char_ref_url = None
            bg_ref_url = None
            char_prompt_base = ""
            
            # DBから事前登録キャラクター情報の取得 (複数キャラ対応)
            char_prompt_base = ""
            enriched_characters = []
            if characters:
                char_prompts = []
                for char in characters:
                    char_id = char.get("character_id")
                    if char_id:
                        try:
                            db_char = await character_service.get_character_by_id_standalone(char_id)
                            if db_char:
                                char_prompts.append(db_char.prompt)
                                
                                # Embeddingの取得と初期化
                                async with SessionLocal() as session:
                                    # Embeddingがなければ初期化
                                    await character_consistency_service.initialize_character_embedding(session, char_id)
                                    # 最新の視覚的特徴テキストを取得
                                    embedding_text = await character_consistency_service.get_latest_embedding_text(session, char_id)
                                
                                enriched_characters.append({
                                    "character_id": char_id,
                                    "name": db_char.name,
                                    "prompt": db_char.prompt,
                                    "visual_tags": db_char.visual_tags,
                                    "lora_name": db_char.lora_name,
                                    "lora_weight": db_char.lora_weight,
                                    "description": char.get("description", ""),
                                    "embedding_text": embedding_text
                                })
                        except Exception as db_err:
                            logger.error(f"Failed to fetch character {char_id} from database: {db_err}")
                    elif char.get("description"):
                        char_prompts.append(char["description"])
                        enriched_characters.append(char)
                
                char_prompt_base = " ".join(char_prompts)
                characters = enriched_characters
            
            # AI Director Chain: Base Scenario -> Deepened Script -> Director Plan
            # 再開時に演出プランが揃っている場合はスキップ
            scenario_data = None
            if resume:
                # 演出プランの存在確認 (タスク初期化時に全コマ分あるかチェック済みと仮定)
                # 簡易的に最初のコマのプランがあるかで判定し、あれば既存を利用
                existing_plan = await checkpoint_manager.get_director_plan(task_id, 0)
                if existing_plan:
                    logger.info(f"Resuming using existing director plans for task {task_id}")
                    # 脚本は既にcheckpointにあるため、scenario_serviceを通さずstateから復元
                    # scenario は既に state = await checkpoint_manager.get_task_state(task_id) で取得済み
                    scenario_data = {"scenario": scenario}
                else:
                    scenario_data = await scenario_service.generate_full_chain_scenario(plot, characters=characters, mode=mode, task_id=task_id)
            else:
                publish_progress(task_id, DirectorEventType.PLANNING_START, {
                    "message": "AIディレクターが脚本を深化させ、視覚的な演出プランを策定しています..."
                })
                scenario_data = await scenario_service.generate_full_chain_scenario(plot, characters=characters, mode=mode, task_id=task_id)
                publish_progress(task_id, DirectorEventType.PLANNING_COMPLETE, {
                    "message": "演出プランの策定が完了しました。"
                })
            
            scenario = scenario_data["scenario"]
            import random
            seed = random.randint(0, 2**32 - 1)
            await checkpoint_manager.init_task(
                task_id,
                len(scenario),
                scenario,
                style=style,
                characters=characters,
                char_prompt_base=char_prompt_base,
                seed=seed,
                mode=mode
            )
            # 登録キャラクターの参照画像URLがある場合はRedisにも保存しておく
            if char_ref_url:
                await checkpoint_manager.save_char_ref(task_id, char_ref_url)
        
        publish_progress(task_id, TaskEventType.SCENARIO_READY, {
            "total": len(scenario),
            "message": "AIディレクターが演出プランを策定しました。"
        })
        
        full_webtoon = []
        has_failed_panel = False
        
        # 2. 各コマの処理
        for i, panel in enumerate(scenario):
            self.update_state(state='PROGRESS', meta={'current': i + 1, 'total': len(scenario)})
            
            # 途中再開モードで、すでにそのコマが過去の実行で成功している場合はスキップしてデータをロード
            if resume:
                panel_state = await checkpoint_manager.get_panel_state(task_id, i)
                if panel_state and panel_state.get("status") == "completed":
                    logger.info(f"Panel {i} already completed. Loading from checkpoint.")
                    full_webtoon.append({
                        **panel,
                        "image_url": panel_state["final_image_url"],
                        "audio_url": panel_state["audio_url"],
                        "bgm_url": panel_state["bgm_url"],
                    })
                    publish_progress(task_id, TaskEventType.PANEL_SKIPPED, {
                        "current": i + 1,
                        "total": len(scenario),
                        "panel": i,
                    })
                    continue
            
            # 新規生成・再生成の場合
            publish_progress(task_id, TaskEventType.PANEL_START, {
                "current": i + 1,
                "total": len(scenario),
                "panel": i
            })
            
            try:
                # 演出プランの取得
                director_plan = await checkpoint_manager.get_director_plan(task_id, i)
                
                publish_progress(task_id, TaskEventType.STEP, {
                    "current": i + 1, "total": len(scenario),
                    "panel": i,
                    "status": "processing",
                    "step": "image",
                    "message": "AIディレクターの演出に基づき複数候補を生成中..."
                })

                # 1. 複数候補の並列生成
                # PromptBuilder.build_from_director_plan を使用して最適化プロンプトを構築
                optimized_prompt = prompt_builder.build_from_director_plan(
                    plan=director_plan,
                    style=style,
                    characters=characters,
                    char_prompt_base=char_prompt_base
                )
                
                # 背景生成 (従来通り)
                bg_prompt = prompt_builder.build_background_prompt(
                    optimized_prompt,
                    style,
                    composition=director_plan.get("composition"),
                    is_reference=bool(bg_ref_url)
                )
                bg_image_url = await image_gen_service.text_to_image(bg_prompt, seed=seed)
                if bg_image_url:
                    await checkpoint_manager.save_bg_ref(task_id, bg_image_url)
                    bg_ref_url = bg_image_url

                # キャラクター候補の並列生成
                candidate_urls = await image_gen_service.generate_multiple_images(
                    prompt=optimized_prompt,
                    count=3,
                    reference_image_base64=char_ref_url,
                    seed=seed
                )
                candidates = [{"url": url} for url in candidate_urls]

                # 2. AI評価によるベストショット選出
                publish_progress(task_id, DirectorEventType.EVALUATING, {
                    "current": i + 1, "total": len(scenario),
                    "panel": i,
                    "message": "AIが演出プランとの適合性を分析し、ベストショットを選出しています..."
                })
                
                best_shot, others = await evaluator_service.select_best_shot(candidates, director_plan)
                
                # 3. DBへの昇格と不要画像のクリーンアップ
                await evaluator_service.promote_best_shot(task_id, i, best_shot)
                # Update character embeddings based on the visual "Best Shot"
                for char in characters:
                    char_id = char.get('character_id')
                    if char_id:
                        await character_consistency_service.update_embedding_from_visual(
                            char_id=char_id,
                            image_url=best_shot['url']
                        )
                # ユーザーがCandidate Galleryで選べるよう、デフォルトでは削除しない
                await evaluator_service.cleanup_rejected_candidates(task_id, i, force=False)

                char_image_url = best_shot["url"]
                # 参照画像の更新
                char_ref_url = char_image_url

                # 4. 合成処理
                subtask = composite_layers_task.delay(
                    bg_image_url,
                    char_image_url,
                    panel.get("dialogue", ""),
                    director_plan.get("composition", "center")
                )
                final_image_url = await asyncio.to_thread(subtask.get, timeout=CELERY_TASK_TIMEOUT)

                audio_assets = await _generate_audio_assets(panel)
                audio_url = audio_assets["audio_url"]
                bgm_url = audio_assets["bgm_url"]

                panel_results = {
                    "bg_image_url": bg_image_url,
                    "char_image_url": char_image_url,
                    "final_image_url": final_image_url,
                    "audio_url": audio_url,
                    "bgm_url": bgm_url,
                }

                # 成果物の保存
                await checkpoint_manager.save_panel_result(task_id, i, panel_results)

                panel_result = {
                    **panel,
                    "image_url": panel_results["final_image_url"],
                    "audio_url": panel_results["audio_url"],
                    "bgm_url": panel_results["bgm_url"]
                }
                full_webtoon.append(panel_result)

                publish_progress(task_id, TaskEventType.PANEL_COMPLETE, {
                    "current": i + 1,
                    "total": len(scenario),
                    "panel": i,
                    "status": "completed",
                    "result": panel_result
                })
                
            except (LLMAPIError, ImageGenerationError, ResourceProcessingError) as panel_err:
                logger.error(f"Panel {i} failed with known error: {str(panel_err)}")
                await checkpoint_manager.mark_panel_failed(task_id, i, str(panel_err))
                has_failed_panel = True
                
                # 失敗時でもBGMなどは生成して保存しておく (後で再開しやすくするため)
                try:
                    bgm_url = await bgm_service.generate_bgm(panel.get("emotion", "default"), panel.get("visual_description", ""))
                    await checkpoint_manager.save_panel_result(task_id, i, {"bgm_url": bgm_url})
                except Exception as bgm_err:
                    logger.error(f"Failed to generate fallback BGM for failed panel {i}: {bgm_err}")

                publish_progress(task_id, TaskEventType.PANEL_FAILED, {
                    "current": i + 1,
                    "total": len(scenario),
                    "panel": i,
                    "status": "failed",
                    "error": str(panel_err)
                })
            except Exception as panel_err:
                logger.exception(f"Panel {i} failed with unexpected error: {str(panel_err)}")
                await checkpoint_manager.mark_panel_failed(task_id, i, str(panel_err))
                has_failed_panel = True
                
                publish_progress(task_id, TaskEventType.PANEL_FAILED, {
                    "current": i + 1,
                    "total": len(scenario),
                    "panel": i,
                    "status": "failed",
                    "error": "An unexpected error occurred during panel generation."
                })
                
                # エラーダミーを挿入して一旦処理続行
                full_webtoon.append({
                    **panel,
                    "image_url": None,
                    "audio_url": None,
                    "bgm_url": await bgm_service.generate_bgm(panel.get("emotion", "default"), panel.get("visual_description", ""))
                })
        
        if has_failed_panel:
            # 失敗したコマが存在する場合は例外を送出し、タスク全体としてはエラー扱いにする（しかし部分データはRedisにあるため再開可能）
            raise WebtoonGenerationError("Some panels failed to generate. Please check checkpoint status and try resuming.")
            
        await checkpoint_manager.mark_task_completed(task_id)
        publish_progress(task_id, TaskEventType.COMPLETED, {
            "total": len(scenario)
        })
        return full_webtoon
        
    except (WebtoonGenerationError, LLMAPIError, ImageGenerationError) as e:
        logger.error(f"Known task error: {str(e)}")
        publish_progress(task_id, TaskEventType.ERROR, {
            "error": str(e)
        })
        raise e
    except Exception as e:
        logger.exception(f"Unexpected task failure: {str(e)}")
        publish_progress(task_id, TaskEventType.ERROR, {
            "error": "A critical unexpected error occurred. Please contact support."
        })
        raise e

@celery_app.task(bind=True, name="app.tasks.generate_webtoon_task")
def generate_webtoon_task(self, plot: str, style: Optional[str] = None, characters: List[Dict] = None, resume: bool = False, mode: str = 'advanced', request_id: Optional[str] = None):
    return asyncio.run(_async_generate_webtoon_task(self, plot, style=style, characters=characters, resume=resume, mode=mode, request_id=request_id))

@celery_app.task(name="app.tasks.composite_layers_task")
def composite_layers_task(background_url: str, character_url: str, dialogue: Optional[str] = None, composition: str = "center"):
    return asyncio.run(composition_service.composite_layers(background_url, character_url, composition, dialogue))

@celery_app.task(bind=True, name="app.tasks.regenerate_panel_task")
def regenerate_panel_task(self, task_id: str, panel_index: int, custom_prompt: Optional[str] = None, regen_type: str = "all", user_control_image_url: Optional[str] = None, request_id: Optional[str] = None):
    """
    特定のコマのみを再生成し、チェックポイントを更新するタスク。
    regen_type: 'all' (全て), 'image' (画像のみ), 'audio' (音声/BGMのみ)
    """
    async def _run():
        if request_id:
            structlog.contextvars.bind_contextvars(request_id=request_id)
        try:
            # 1. タスク状態の復元
            state = await checkpoint_manager.get_task_state(task_id)
            if not state:
                raise WebtoonGenerationError(f"Task state not found for {task_id}")
            
            scenario = json.loads(state["scenario"])
            if panel_index < 0 or panel_index >= len(scenario):
                raise WebtoonGenerationError(f"Invalid panel index {panel_index}")
            
            panel = scenario[panel_index]
            style = state.get("style")
            character_description = state.get("character_description")
            char_prompt_base = state.get("char_prompt_base", "")
            
            # シード値を復元
            seed_val = state.get("seed")
            seed = int(seed_val) if seed_val and seed_val.isdigit() else None

            # 再生成時は、直前のパネルのキャラクター画像を参照する
            if panel_index > 0:
                prev_panel_state = await checkpoint_manager.get_panel_state(task_id, panel_index - 1)
                # 直前のパネルが成功していればそのキャラ画像を、なければタスク初期の参照画像を使う
                char_ref_url = prev_panel_state.get("char_image_url") if prev_panel_state else state.get("char_ref_base64")
            else:
                char_ref_url = state.get("char_ref_base64") # 最初のパネルの場合はタスク初期の参照画像
            
            # 2. プロンプトの決定
            publish_progress(task_id, TaskEventType.PANEL_START, {
                "current": panel_index + 1,
                "total": len(scenario),
                "panel": panel_index,
                "status": "processing",
                "message": "コマを再生成中..."
            })

            # 既存の成果物を取得 (部分再生成のため)
            panel_state = await checkpoint_manager.get_panel_state(task_id, panel_index)

            # ヘルパー関数を使用して再生成
            if regen_type == "director":
                # AI Directorフローによる再生成 (複数生成 -> 評価 -> 選出)
                publish_progress(task_id, TaskEventType.STEP, {
                    "current": panel_index + 1, "total": len(scenario),
                    "panel": panel_index,
                    "status": "processing",
                    "step": "image",
                    "message": "AIディレクターが別の候補を生成し、再評価しています..."
                })

                # 演出プランの取得
                director_plan = await checkpoint_manager.get_director_plan(task_id, panel_index)
                if not director_plan:
                    raise WebtoonGenerationError(f"Director plan not found for panel {panel_index}")

                # 最適化プロンプトの構築
                optimized_prompt = prompt_builder.build_from_director_plan(
                    plan=director_plan,
                    style=style,
                    characters=json.loads(state.get("characters", "[]")),
                    char_prompt_base=char_prompt_base
                )
                if custom_prompt:
                    optimized_prompt = f"{custom_prompt}, {optimized_prompt}"

                # 1. 候補の並列生成
                candidate_urls = await image_gen_service.generate_multiple_images(
                    prompt=optimized_prompt,
                    count=3,
                    reference_image_base64=char_ref_url,
                    seed=seed
                )
                candidates = [{"url": url} for url in candidate_urls]

                # 2. AI評価
                publish_progress(task_id, DirectorEventType.EVALUATING, {
                    "current": panel_index + 1, "total": len(scenario),
                    "panel": panel_index,
                    "message": "AIが新たな候補の中からベストショットを選出しています..."
                })
                best_shot, _ = await evaluator_service.select_best_shot(candidates, director_plan)
                
                # 3. 昇格とクリーンアップ
                await evaluator_service.promote_best_shot(task_id, panel_index, best_shot)
                await evaluator_service.cleanup_rejected_candidates(task_id, panel_index)

                char_image_url = best_shot["url"]
                
                # 背景は既存のものを利用するか、必要なら再生成 (ここではシンプルに既存利用)
                bg_image_url = panel_state.get("bg_image_url") if panel_state else ""
                
                # 合成処理
                subtask = composite_layers_task.delay(
                    bg_image_url,
                    char_image_url,
                    panel.get("dialogue", ""),
                    director_plan.get("composition", "center")
                )
                final_image_url = await asyncio.to_thread(subtask.get, timeout=CELERY_TASK_TIMEOUT)
                
                panel_results = {
                    "bg_image_url": bg_image_url or "",
                    "char_image_url": char_image_url,
                    "final_image_url": final_image_url,
                    "audio_url": panel_state.get("audio_url") if panel_state else "",
                    "bgm_url": panel_state.get("bgm_url") if panel_state else "",
                }
                updated_char_ref = char_image_url
                updated_bg_ref = bg_image_url
            else:
                # 従来の再生成フロー
                panel_results, updated_char_ref, updated_bg_ref = await _generate_single_panel(
                    task_id=task_id,
                    panel_index=panel_index,
                    panel_data=panel,
                    style=style,
                    char_prompt_base=char_prompt_base,
                    char_ref_url=char_ref_url,
                    custom_prompt=custom_prompt,
                    regen_type=regen_type,
                    current_panel_state=panel_state,
                    seed=seed,
                    characters=json.loads(state.get("characters", "[]")),
                    user_control_image_url=user_control_image_url
                )
            char_ref_url = updated_char_ref
            
            bg_image_url = panel_results["bg_image_url"]
            char_image_url = panel_results["char_image_url"]
            final_image_url = panel_results["final_image_url"]
            audio_url = panel_results["audio_url"]
            bgm_url = panel_results["bgm_url"]
            
            # 3. 結果の保存
            await checkpoint_manager.save_panel_result(task_id, panel_index, {
                "bg_image_url": bg_image_url or "",
                "char_image_url": char_image_url or "",
                "final_image_url": final_image_url or "",
                "audio_url": audio_url or "",
                "bgm_url": bgm_url or "",
            })
            
            panel_result = {
                **panel,
                "image_url": final_image_url,
                "audio_url": audio_url,
                "bgm_url": bgm_url
            }
            
            publish_progress(task_id, TaskEventType.PANEL_COMPLETE, {
                "current": panel_index + 1,
                "total": len(scenario),
                "panel": panel_index,
                "status": "completed",
                "result": panel_result
            })
            
            return panel_result
            
        except Exception as e:
            logger.error(f"Regeneration failed for panel {panel_index}: {str(e)}")
            publish_progress(task_id, TaskEventType.PANEL_FAILED, {
                "panel": panel_index,
                "status": "failed",
                "error": str(e)
            })
            raise e

    return asyncio.run(_run())
