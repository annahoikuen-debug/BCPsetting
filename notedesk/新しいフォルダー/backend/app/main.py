import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.router import router as api_router
from app.core.config import settings
import logging
import structlog

# structlogの初期化設定
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.dict_tracebacks,
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)

@asynccontextmanager
async def lifespan(fastapi_app: FastAPI):
    # Startup: DBテーブルの作成 & Redisコネクションプールの初期化
    from app.core.db import engine, Base
    import app.models.db  # モデル登録のためにインポート
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    import redis.asyncio as aioredis
    fastapi_app.state.redis_pool = aioredis.ConnectionPool.from_url(
        settings.CELERY_BROKER_URL, decode_responses=True
    )
    yield
    # Shutdown: Redisコネクションプールのクローズ
    if hasattr(fastapi_app.state, "redis_pool") and fastapi_app.state.redis_pool:
        await fastapi_app.state.redis_pool.disconnect()

app = FastAPI(
    title="Rich Webtoon Generator API",
    description="API for generating immersive Webtoons from plot summaries",
    version="0.1.0",
    lifespan=lifespan
)

from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.core.limiter import limiter

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ローカル保存用ディレクトリをマウント
local_storage_path = "storage/uploads"
os.makedirs(local_storage_path, exist_ok=True)

# CORS configuration for Next.js frontend
# CORS設定を環境変数から読み込む (カンマ区切り)。未設定時はローカル開発用オリジンをデフォルトとする。
cors_origins = settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS else ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.core.tracing import RequestTracingMiddleware
app.add_middleware(RequestTracingMiddleware)


class SecurityHeadersMiddleware:
    """
    レスポンスにセキュリティヘッダーを付与するミドルウェア。
    - Content-Security-Policy: XSS 対策（インラインスクリプトの禁止等）
    - X-Content-Type-Options: MIME スニッフィング防止
    - X-Frame-Options: クリックジャッキング防止
    - Referrer-Policy: リファラー情報の最小化
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_security_headers(message):
            if message["type"] == "http.response.start":
                headers = dict(message.get("headers", []))
                headers[b"content-security-policy"] = (
                    "default-src 'self'; "
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                    "style-src 'self' 'unsafe-inline'; "
                    "img-src 'self' data: https:; "
                    "connect-src 'self' http://localhost:8000 ws://localhost:8000; "
                    "font-src 'self'; "
                    "object-src 'none'; "
                    "base-uri 'self';"
                ).encode()
                headers[b"x-content-type-options"] = b"nosniff"
                headers[b"x-frame-options"] = "DENY".encode()
                headers[b"referrer-policy"] = b"strict-origin-when-cross-origin"
                message["headers"] = list(headers.items())
            await send(message)

        await self.app(scope, receive, send_with_security_headers)


app.add_middleware(SecurityHeadersMiddleware)

# Include API routes
app.include_router(api_router, prefix="/api", tags=["api"])
# /static/uploads でアクセスできるように、appにマウントする
app.mount("/static/uploads", StaticFiles(directory=local_storage_path), name="static_uploads")


from fastapi import Request
from fastapi.responses import JSONResponse
from app.core.exceptions import (
    WebtoonGenerationError,
    LLMAPIError,
    GeminiContentError,
    ImageGenerationError,
    ResourceProcessingError
)

@app.exception_handler(GeminiContentError)
async def gemini_content_error_handler(request: Request, exc: GeminiContentError):
    return JSONResponse(
        status_code=400,
        content={
            "detail": "AIコンテンツフィルタリングにより生成がブロックされました。",
            "error_type": "CONTENT_FILTER",
            "suggestion": "プロットの表現を少し変更して、再度お試しください。"
        }
    )

@app.exception_handler(LLMAPIError)
async def llm_api_error_handler(request: Request, exc: LLMAPIError):
    return JSONResponse(
        status_code=502,
        content={
            "detail": "AIサービスとの通信に失敗しました。",
            "error_type": "LLM_SERVICE_ERROR",
            "suggestion": "しばらく時間をおいてから再度お試しください。"
        }
    )

@app.exception_handler(ImageGenerationError)
async def image_generation_error_handler(request: Request, exc: ImageGenerationError):
    return JSONResponse(
        status_code=502,
        content={"detail": f"Image generation service error: {str(exc)}"}
    )

@app.exception_handler(ResourceProcessingError)
async def resource_processing_error_handler(request: Request, exc: ResourceProcessingError):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Media processing error: {str(exc)}"}
    )

@app.exception_handler(WebtoonGenerationError)
async def webtoon_generation_error_handler(request: Request, exc: WebtoonGenerationError):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Webtoon generation error: {str(exc)}"}
    )

@app.get("/")
async def root():
    return {"message": "Welcome to the Rich Webtoon Generator API", "status": "running"}
