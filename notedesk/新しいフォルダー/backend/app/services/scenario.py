from google import genai
from app.core.config import settings
from app.models.schemas import ScenarioResponse, PanelScenario, DirectorPlan, DirectorPlanResponse
from typing import List, Dict, Optional
from tenacity import retry, stop_after_attempt, wait_exponential
import logging
import json
from app.core.exceptions import LLMAPIError, GeminiContentError

logger = logging.getLogger(__name__)

class ScenarioService:
    def __init__(self):
        # google-genai SDK の新しいクライアント初期化
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model_name = settings.GEMINI_SCENARIO_MODEL

    async def generate_full_chain_scenario(self, plot_summary: str, characters: List[Dict] = None, mode: str = 'advanced', task_id: Optional[str] = None) -> Dict:
        """
        プロンプトチェーン全体を実行し、最終的な演出プランまでを生成して返す。
        フロー: 基礎シナリオ -> 脚本深化 -> 演出プラン
        task_id が提供された場合、中間状態を Redis に保存・復元する。
        """
        from app.services.checkpoint import checkpoint_manager

        # Step 1: 基礎シナリオ生成
        base_scenario = await self.generate_scenario(plot_summary, characters, mode)
        
        # Step 2: 脚本深化
        deepened_scenario = await self.deepen_script(base_scenario)
        if task_id:
            await checkpoint_manager.save_deepened_scenario(task_id, deepened_scenario)
        
        # Step 3: 演出プラン生成
        director_plans = await self.generate_director_plan(deepened_scenario, characters or [])
        if task_id:
            for i, plan in enumerate(director_plans):
                await checkpoint_manager.save_director_plan(task_id, i, plan)
        
        return {
            "scenario": deepened_scenario,
            "director_plans": director_plans
        }

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def generate_scenario(self, plot_summary: str, characters: List[Dict] = None, mode: str = 'advanced') -> List[Dict]:
        """
        あらすじとキャラクター設定から4コマ分の基礎シナリオを生成する。
(プロンプトチェーンの第一段階: 脚本の骨子作成)
        """
        prompt = """
        あなたは世界最高峰のWebtoon脚本家兼AI演出家です。
        提供されたあらすじとキャラクター設定を元に、没入感のある4コマ構成のWebtoonシナリオを作成してください。
        
        【重要: プロンプト最適化ガイドライン】
        各コマの `visual_prompt` は、Stable Diffusion XLなどの画像生成AIが最高品質の出力を出せるよう、以下のルールで作成してください：
        1. 完全な英語で記述すること。
        2. 具体的な視覚要素（ライティング、構図、詳細な服装、表情、背景の質感）を盛り込むこと。
        3. 登場するすべてのキャラクターについて、提供された外見的特徴を一貫して記述すること。複数のキャラクターが登場する場合、それぞれの特徴を明確に描き分け、位置関係や相互作用を具体的に記述してください。
        4. Webtoon/Manhwa特有のスタイルキーワード（"digital art, high quality webtoon style, vivid colors"）を含めること。
        
        【重要: ポーズ・アクション (pose) ガイドライン】
        各コマのキャラクターの動きに合わせて、最適なポーズを以下のリストから1つ選択して `pose` フィールドに指定してください：
        - "neutral": 自然な立ち姿、リラックスした姿勢
        - "dynamic_action": ダイナミックなアクション、激しい動き、動作の途中
        - "emotional_distress": 崩れ落ちる、顔を覆うなど、深い悲しみや衝撃の表現
        - "confident": 胸を張る、腕を組むなど、自信に満ちた姿勢
        - "aggressive": 戦闘態勢、拳を握りしめるなど、攻撃的な姿勢
        - "surprised": 後ろに飛びのく、目を見開くなど、驚きの表現
        - "thinking": 顎に手を当てる、考え込むポーズ
        - "greeting": 手を振る、親しみやすい姿勢
        
        【重要: 演出指示 (effect) ガイドライン】
        各コマに最適な視覚演出を `effect` フィールドに指定してください。以下の選択肢から1つ選んでください：
        - "fade_in": ゆっくりと現れる（静かなシーン、回想など）
        - "slide_up": 下からせり上がる（登場シーン、驚きなど）
        - "zoom_in": ゆっくり拡大する（感情の強調、緊張感など）
        - "shake": 画面が激しく揺れる（衝撃、爆発、激怒など）
        - "slide_left" / "slide_right": 横からスライド（視点移動、対峙など）

        【重要: 構図・カメラアングル (composition) ガイドライン】
        各コマの物語的意図に合わせて、最適な構図を `composition` フィールドに指定してください：
        - "close_up": 顔のアップ（感情の機微、強い意志）
        - "medium_shot": 腰から上のショット（対話、動作の提示）
        - "wide_shot": 全身や背景を含む広いショット（状況説明、孤独感、壮大な景色）
        - "low_angle": 下から見上げる（権威、威圧感、英雄的演出）
        - "high_angle": 上から見下ろす（弱さ、俯瞰、客観的な視点）
        - "dynamic": 俯瞰・仰俯が混在するダイナミックな構図（アクション、衝撃的な展開）
        """
        
        char_info = ""
        if mode == 'easy':
            char_info = "\n【キャラクター生成指示】:\nあらすじに合わせて、物語に不可欠な主要キャラクターを1〜3名、AIが自律的に定義してください。各キャラクターについて、名前、外見的特徴（髪色、服装、年齢層など）、役割を明確に設定し、シナリオ全体を通して一貫性を保持させてください。"
        elif characters:
            char_info = "\n【登場キャラクター設定】:\n" + "\n".join([f"- {c['name']}: {c.get('description', '設定なし')}" for c in characters])

        full_prompt = f"{prompt}\n\n{char_info}\n\n【あらすじ】:\n{plot_summary}"
        
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=full_prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": ScenarioResponse,
                }
            )
            
            parsed: ScenarioResponse = response.parsed
            if parsed and parsed.panels:
                return [panel.model_dump(mode='json') for panel in parsed.panels]
            else:
                raise ValueError("Parsed result is empty")
                
        except Exception as e:
            logger.error(f"Error generating scenario with Gemini: {str(e)}")
            if "safety" in str(e).lower() or "block" in str(e).lower():
                raise GeminiContentError(f"Gemini content generation blocked: {str(e)}") from e
            raise LLMAPIError(f"Failed to generate scenario: {str(e)}") from e

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def deepen_script(self, base_scenario: List[Dict]) -> List[Dict]:
        """
        基礎シナリオを深化させ、より感情表現豊かなセリフと詳細な状況設定を付加する。
        (プロンプトチェーンの第二段階: 脚本深化)
        """
        prompt = """
        あなたは世界最高峰のWebtoon脚本家です。提供された【基礎シナリオ】を元に、読者の感情を揺さぶる「深化された脚本」へアップグレードしてください。
        
        【深化のガイドライン】:
        1. セリフの洗練: 単なる説明的なセリフではなく、キャラクターの性格や現在の感情が滲み出る、生きた言葉に書き換えてください。
        2. 心理描写の追加: キャラクターがその時どう感じているか、どのような葛藤があるかという内部的な状況を詳細に記述してください。
        3. テンポの最適化: 4コマという制約の中で、起承転結が最大限に活きるよう、情報の出し方と間（ま）を調整してください。
        4. 状況の具体化: 「驚く」→「目を見開き、持っていたカップを落とす」など、視覚的に描写可能な具体的なアクションに変換してください。
        
        出力形式は元のシナリオ構造を維持し、`dialogue` と `visual_prompt` (状況描写部分) を重点的に強化してください。
        """
        
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=f"{prompt}\n\n【基礎シナリオ】:\n{json.dumps(base_scenario, ensure_ascii=False)}",
                config={
                    "response_mime_type": "application/json",
                    "response_schema": ScenarioResponse,
                }
            )
            parsed = response.parsed
            if not parsed or not hasattr(parsed, 'panels') or not parsed.panels:
                raise LLMAPIError("Deepened script returned empty panels")
            return [panel.model_dump(mode='json') for panel in parsed.panels]
        except Exception as e:
            logger.error(f"Error deepening script: {str(e)}")
            raise LLMAPIError(f"Failed to deepen script: {str(e)}") from e

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def generate_director_plan(self, deepened_scenario: List[Dict], characters: List[Dict]) -> List[Dict]:
        """
        深化された脚本から、視覚的な演出プラン（構図、ポーズ、ライティング、最適化プロンプト）を生成する。
        (プロンプトチェーンの第三段階: 視覚演出プランニング)
        """
        prompt = """
        あなたは天才的なWebtoon演出家兼アートディレクターです。
        【深化された脚本】を読み込み、画像生成AIが「意図通り」に出力するための詳細な【演出プラン】を作成してください。
        
        【演出プラン作成ガイドライン】:
        1. 視覚的意図の明確化: そのコマで「何を伝えたいか（例：絶望感、圧倒的な権力、密やかな恋心）」を `composition_reasoning` に記述してください。
        2. 厳格な構図指定: `composition` (close_up, wide_shot等) を脚本の感情曲線に合わせて最適に選択してください。
        3. 具体的なポーズと表情: `character_poses` に、単なる動作ではなく「眉をひそめながら、右手をわずかに震わせて差し出す」といったレベルの具体的指示を記述してください。
        4. 最終プロンプトの最適化: 以上の演出意図をすべて統合し、画像生成AIが迷わず出力できる最高の英語プロンプトを `final_optimized_prompt` として作成してください。
        
        【出力形式】:
        `DirectorPlanResponse` スキーマに従い出力してください。
        """
        
        char_info = "\n".join([f"- {c['name']}: {c.get('description', '')}" for c in characters])
        full_prompt = f"{prompt}\n\n【登場キャラクター】:\n{char_info}\n\n【深化された脚本】:\n{json.dumps(deepened_scenario, ensure_ascii=False)}"
        
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=full_prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": DirectorPlanResponse,
                }
            )
            parsed = response.parsed
            if not parsed or not hasattr(parsed, 'plans') or not parsed.plans:
                raise LLMAPIError("Director plan generation returned empty plans")
            return [plan.model_dump(mode='json') for plan in parsed.plans]
        except Exception as e:
            logger.error(f"Error generating director plan: {str(e)}")
            raise LLMAPIError(f"Failed to generate director plan: {str(e)}")

scenario_service = ScenarioService()
