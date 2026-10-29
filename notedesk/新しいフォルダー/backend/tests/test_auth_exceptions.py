from fastapi.testclient import TestClient
from app.main import app
from unittest.mock import AsyncMock, patch
import pytest

client = TestClient(app)

def test_health_check_public():
    # Health endpoint should be open without API Key
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in ("healthy", "degraded")
    assert "checks" in body
    assert body["checks"].get("api") == "healthy"
    assert body["checks"].get("database") in ("healthy", "unhealthy")

def test_generate_scenario_missing_key():
    response = client.post("/api/generate-scenario", json={"plot": "test plot"})
    assert response.status_code == 401

def test_generate_scenario_invalid_key():
    response = client.post(
        "/api/generate-scenario", 
        json={"plot": "test plot"},
        headers={"X-API-Key": "wrong_key"}
    )
    assert response.status_code == 403

def test_generate_scenario_valid_key_mocked():
    from app.services.scenario import scenario_service
    
    mock_generate = AsyncMock(return_value=[
        {"panel": 1, "dialogue": "Hello", "visual_description": "A character", "emotion": "happy", "effect": None, "composition": None, "image_url": None}
    ])
    
    with patch.object(scenario_service, "generate_scenario", mock_generate):
        response = client.post(
            "/api/generate-scenario",
            json={"plot": "test plot"},
            headers={"X-API-Key": "default_key_change_me_in_production"}
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 1
        assert data[0]["dialogue"] == "Hello"

def test_custom_exception_mapping():
    from app.services.scenario import scenario_service
    from app.core.exceptions import GeminiContentError
    
    # Mock to raise GeminiContentError and check if it maps to 400 Bad Request
    mock_generate = AsyncMock(side_effect=GeminiContentError("Blocked by safety policy"))
    
    with patch.object(scenario_service, "generate_scenario", mock_generate):
        response = client.post(
            "/api/generate-scenario",
            json={"plot": "test plot"},
            headers={"X-API-Key": "default_key_change_me_in_production"}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is False
        assert body["error"]["code"] == "GENERATION_ERROR"
        assert "Blocked by safety policy" in body["error"]["message"]

def test_generate_scenario_empty_key():
    response = client.post(
        "/api/generate-scenario", 
        json={"plot": "test plot"},
        headers={"X-API-Key": ""}
    )
    # APIKeyHeader(auto_error=False)の場合、空文字はNoneと解釈されずに通過し、その後のチェックで401か403になる。
    # 現在の実装では `if not api_key:` に引っかかるため 401 が返る。
    assert response.status_code == 401

def test_generate_scenario_whitespace_key():
    response = client.post(
        "/api/generate-scenario", 
        json={"plot": "test plot"},
        headers={"X-API-Key": "   "}
    )
    # 空白のみのキーもエラーになるか確認
    assert response.status_code in [401, 403]
