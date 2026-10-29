import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.db import async_session_maker
from app.models.db import WebtoonWork
from unittest.mock import AsyncMock, MagicMock, patch, ANY
import json

client = TestClient(app)

# テスト用にAPIキーを追加
from app.core.auth import ALLOWED_API_KEYS
ALLOWED_API_KEYS.add("test-api-key")

@pytest.mark.asyncio
async def test_full_generation_flow_integration():
    """
    APIエンドポイントからタスク起動までの統合フローをテストする。
    実際のリクエストが正しく受理され、タスクに渡されるかを確認する。
    """
    with patch("app.api.router.generate_webtoon_task.delay") as mock_delay:
        mock_task_id = "test-task-api-123"
        mock_delay.return_value = MagicMock(id=mock_task_id)

        payload = {
            "plot": "A story about a brave cat",
            "style": "digital art",
            "characters": [
                {"name": "Hero Cat", "description": "A ginger cat with a small cape"}
            ]
        }

        response = client.post(
            "/api/generate-webtoon", 
            json=payload, 
            headers={"X-API-Key": "test-api-key"}
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["task_id"] == mock_task_id
        
        expected_characters = [
            {**char, "character_id": None} for char in payload["characters"]
        ]
        mock_delay.assert_called_once_with(
            plot=payload["plot"],
            style=payload["style"],
            characters=expected_characters,
            mode="advanced", # Default
            request_id=ANY
        )

@pytest.mark.asyncio
async def test_easy_mode_generation_flow():
    with patch("app.api.router.generate_webtoon_task.delay") as mock_delay:
        mock_task_id = "test-easy-mode-123"
        mock_delay.return_value = MagicMock(id=mock_task_id)

        payload = {
            "plot": "Easy mode test",
            "style": "anime",
            "characters": [],
            "mode": "easy"
        }

        response = client.post(
            "/api/generate-webtoon",
            json=payload,
            headers={"X-API-Key": "test-api-key"}
        )

        assert response.status_code == 200
        # mode="easy" が渡されていることを確認
        mock_delay.assert_called_with(
            plot=payload["plot"],
            style=payload["style"],
            characters=[],
            mode="easy",
            request_id=ANY
        )

@pytest.mark.asyncio
async def test_resume_task_flow_integration():
    """
    一部失敗したタスクの再開フローをテストする。
    """
    with patch("app.api.router.checkpoint_manager.get_task_state", new_callable=AsyncMock) as mock_get_state, \
         patch("app.api.router.generate_webtoon_task.apply_async") as mock_apply_async:
        
        # 1. タスクの状態を「部分完了」に設定
        mock_get_state.return_value = {
            "status": "partial",
            "completed_panels": 1,
            "total_panels": 4
        }
        
        task_id = "test-task-resume-123"
        response = client.post(
            f"/api/resume/{task_id}", 
            headers={"X-API-Key": "test-api-key"}
        )
        
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["task_id"] == task_id
        assert data["status"] == "resuming"
        
        # 正しい設定でタスクが再起動されたか確認
        mock_apply_async.assert_called_once_with(
            args=[""],
            kwargs={"resume": True, "request_id": ANY},
            task_id=task_id
        )

@pytest.mark.asyncio
async def test_invalid_api_key_integration():
    """
    不正なAPIキーでアクセスした際に401/403が返ることを確認する。
    """
    payload = {
        "plot": "Invalid key test",
        "style": "anime",
        "characters": []
    }
    
    # キーなし
    response = client.post("/api/generate-webtoon", json=payload)
    assert response.status_code == 401
    
    # 不正なキー
    response = client.post(
        "/api/generate-webtoon", 
        json=payload, 
        headers={"X-API-Key": "wrong-key"}
    )
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_invalid_payload_integration():
    """
    バリデーションエラー（422）が発生することを確認する。
    """
    # plotが空のケース
    payload = {
        "plot": "", 
        "style": "anime",
        "characters": []
    }
    response = client.post(
        "/api/generate-webtoon", 
        json=payload, 
        headers={"X-API-Key": "test-api-key"}
    )
    assert response.status_code == 422
