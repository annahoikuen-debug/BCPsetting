from pydantic_settings import BaseSettings
from typing import Optional, List
from pydantic import model_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "Rich Webtoon Generator"
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: str = ""
    APP_API_KEYS_FILE: Optional[str] = None
    APP_API_KEYS: str = "default_key_change_me_in_production"
    
    # API Keys
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_SCENARIO_MODEL: str = "gemini-3.1-flash-lite"
    GEMINI_IMAGE_MODEL: str = "imagen-4.0-fast-generate-001"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-2"
    USE_GEMINI_IMAGE_GEN: bool = False
    STABLE_DIFFUSION_API_KEY: Optional[str] = None
    ELEVENLABS_API_KEY: Optional[str] = None
    USE_VOICEVOX: bool = False
    VOICEVOX_ENGINE_URL: str = "http://localhost:50021"
    REPLICATE_API_TOKEN: Optional[str] = None
    
    # Storage
    S3_BUCKET: Optional[str] = None
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None
    STORAGE_BASE_URL: str = "http://localhost:8000/static"

    # BGM Generation
    BGM_API_KEY: Optional[str] = None
    BGM_API_URL: str = "https://api.suno.ai/v1/generate"

    # Celery/Redis
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"

    model_config = {
        "env_file": ".env",
        "extra": "ignore"
    }

    @model_validator(mode='after')
    def validate_dependencies(self) -> 'Settings':
        if not self.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required.")
        
        if not self.USE_GEMINI_IMAGE_GEN and not self.STABLE_DIFFUSION_API_KEY:
            raise ValueError("If USE_GEMINI_IMAGE_GEN is False, STABLE_DIFFUSION_API_KEY is required.")
            
        if not self.USE_VOICEVOX and not self.ELEVENLABS_API_KEY:
            raise ValueError("If USE_VOICEVOX is False, ELEVENLABS_API_KEY is required.")

        return self

settings = Settings()
