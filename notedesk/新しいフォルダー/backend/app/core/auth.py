from typing import Optional
from fastapi import Security, HTTPException, status
from fastapi.security.api_key import APIKeyHeader
from app.core.config import settings
import os

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

def _load_api_keys() -> set:
    """環境変数またはファイルからAPIキーを読み込む"""
    keys = set()
    if settings.APP_API_KEYS:
        keys.update(key.strip() for key in settings.APP_API_KEYS.split(",") if key.strip())
    if settings.APP_API_KEYS_FILE and os.path.exists(settings.APP_API_KEYS_FILE):
        with open(settings.APP_API_KEYS_FILE, "r") as f:
            keys.update(line.strip() for line in f if line.strip())
    return keys

# アプリケーション起動時に許可されたAPIキーのセットを作成
ALLOWED_API_KEYS = _load_api_keys()

def verify_api_key(
    api_key_header: Optional[str] = Security(API_KEY_HEADER),
):
    api_key = api_key_header
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key missing"
        )
    if api_key not in ALLOWED_API_KEYS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API Key"
        )
    return api_key
