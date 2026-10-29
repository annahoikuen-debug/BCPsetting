import logging
import json
import asyncio
from typing import List, Dict, Optional, Tuple
from google import genai
from app.core.config import settings
from app.core.exceptions import LLMAPIError, GeminiContentError
from tenacity import retry, stop_after_attempt, wait_exponential
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

class ImageEvaluation(BaseModel):
    score: int = Field(description="0-100の適合度スコア")
    reason: str = Field(description="スコアの根拠となる具体的理由（日本語）")
    composition_match: bool = Field(description="指定した構図が正しく再現されているか")
    pose_match: bool = Field(description="指定したポーズや表情が再現されているか")
    consistency_match: bool = Field(description="キャラクターの一貫性が保たれているか")

class EvaluatorService:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model_name = settings.GEMINI_SCENARIO_MODEL

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def evaluate_image(self, image_url: str, director_plan: Dict) -> ImageEvaluation:
        """
        Gemini Visionを使用して、生成画像が演出プランに適合しているかを評価する。
        """
        prompt = f"""
        あなたはプロのWebtoon編集者兼アートディレクターです。
        提供された【演出プラン】に基づき、生成された画像がどれだけ意図通りに作成されているかを厳格に評価してください。

        【演出プラン】:
        - 視覚的意図: {director_plan.get('composition_reasoning', '指定なし')}
        - 構図: {director_plan.get('composition', '指定なし')}
        - キャラクターのポーズ・表情: {director_plan.get('character_poses', '指定なし')}
        - 最終的な最適化プロンプト: {director_plan.get('final_optimized_prompt', '指定なし')}

        【評価基準】:
        1. 構図 (Composition): 指定されたアングルやショット（例：close_up, wide_shot）が正しく再現されているか。
        2. ポーズ・表情 (Pose & Emotion): キャラクターの具体的な動作や感情表現がプラン通りか。
        3. 一貫性 (Consistency): キャラクターの外見的特徴が維持されているか。
        4. 全体的な品質 (Quality): 破綻がなく、Webtoonとしてのクオリティを満たしているか。

        結果をJSON形式で出力してください。
        """

        try:
            # 画像データを取得してGeminiに渡す
            # 注: 実際にはURLから画像を読み込むか、GeminiのファイルAPIを使用する
            from app.services.storage import storage_service
            image_bytes = await storage_service.download_file(image_url)
            
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[
                    prompt,
                    genai.types.Part.from_bytes(data=image_bytes, mime_type="image/png")
                ],
                config={
                    "response_mime_type": "application/json",
                    "response_schema": ImageEvaluation,
                }
            )
            
            return response.parsed
        except Exception as e:
            logger.error(f"Error evaluating image: {str(e)}")
            if "safety" in str(e).lower() or "block" in str(e).lower():
                raise GeminiContentError(f"Gemini evaluation blocked: {str(e)}") from e
            raise LLMAPIError(f"Failed to evaluate image: {str(e)}") from e

    async def select_best_shot(self, candidates: List[Dict], director_plan: Dict) -> Tuple[Dict, List[Dict]]:
        """
        複数の候補画像から最高の1枚を選出し、選ばれた画像と残りの候補を返す。
        candidates: [{'url': '...', 'seed': ...}, ...]
        """
        async def evaluate_one(cand: Dict) -> Dict:
            try:
                eval_res = await self.evaluate_image(cand['url'], director_plan)
                return {
                    **cand,
                    "score": eval_res.score,
                    "reason": eval_res.reason,
                    "metrics": eval_res.model_dump()
                }
            except Exception as e:
                logger.error(f"Evaluation failed for {cand['url']}: {str(e)}")
                return {**cand, "score": 0, "reason": f"評価失敗: {str(e)}", "metrics": {}}

        evaluations = await asyncio.gather(*[evaluate_one(cand) for cand in candidates])

        if not evaluations:
            raise LLMAPIError("No valid image evaluations could be performed.")

        # スコアでソートして最高点を選出
        evaluations.sort(key=lambda x: x['score'], reverse=True)
        best_shot = evaluations[0]
        others = evaluations[1:]

        return best_shot, others

    async def promote_best_shot(self, task_id: str, panel_index: int, best_shot: Dict):
        """
        選出されたベストショットをDBのメイン画像として昇格させ、
        候補画像テーブルのステータスを更新する。
        """
        from app.core.db import SessionLocal
        from app.models.db import ImageCandidate, WebtoonPanelData

        async with SessionLocal() as session:
            # 1. メインパネルデータの画像URLを更新
            panel = await session.get(WebtoonPanelData, f"{task_id}_{panel_index}")
            if panel:
                panel.image_url = best_shot['url']
            
            # 2. 全候補画像のステータスを更新 (選出されたものを 'selected'、他を 'rejected' に)
            # 注: ImageCandidateモデルにstatus列がある前提
            from sqlalchemy import update
            
            # 全ての候補を一旦棄却に
            await session.execute(
                update(ImageCandidate)
                .where(ImageCandidate.task_id == task_id, ImageCandidate.panel_index == panel_index)
                .values(status='rejected')
            )
            
            # ベストショットのみを選出済みに
            await session.execute(
                update(ImageCandidate)
                .where(ImageCandidate.url == best_shot['url'])
                .values(status='selected', score=best_shot.get('score', 0), evaluation_reason=best_shot.get('reason', ''))
            )
            
            await session.commit()

    async def cleanup_rejected_candidates(self, task_id: str, panel_index: int, force: bool = False):
        """
        選出されなかった候補画像をDBおよびストレージから削除する。
        force=False の場合は、ユーザーによる確認（Candidate Galleryでの選択）のために保持する。
        商用環境では一定期間後にバッチ処理で削除することを想定。
        """
        if not force:
            logger.info(f"Keeping rejected candidates for task {task_id} panel {panel_index} for user review.")
            return

        from app.core.db import SessionLocal
        from app.models.db import ImageCandidate
        from app.services.storage import storage_service
        from sqlalchemy import select

        async with SessionLocal() as session:
            stmt = select(ImageCandidate).where(
                ImageCandidate.task_id == task_id,
                ImageCandidate.panel_index == panel_index,
                ImageCandidate.status == 'rejected'
            )
            result = await session.execute(stmt)
            rejected_candidates = result.scalars().all()

            for cand in rejected_candidates:
                try:
                    await storage_service.delete_file(cand.url)
                    await session.delete(cand)
                except Exception as e:
                    logger.error(f"Failed to cleanup rejected candidate {cand.url}: {str(e)}")
            
            await session.commit()

evaluator_service = EvaluatorService()
