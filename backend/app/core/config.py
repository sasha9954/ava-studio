from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_prefix='AVA_', extra='ignore')

    env: str = Field(default='development')
    app_name: str = Field(default='ava-studio')
    secret_key: str = Field(default='dev-secret-change-me')
    storage_dir: str = Field(default='storage')
    static_dir: str = Field(default='static')
    cors_origins: str = Field(default='http://localhost:5173')
    public_base_url: str = Field(default='http://localhost:8000')
    asr_provider: str = Field(default='local')
    asr_model: str = Field(default='base')
    asr_device: str = Field(default='cpu')
    asr_compute_type: str = Field(default='int8')

    @property
    def storage_path(self) -> Path:
        return Path(self.storage_dir)

    @property
    def static_path(self) -> Path:
        return Path(self.static_dir)

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(',') if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
