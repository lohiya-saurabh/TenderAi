import os
from typing import Any

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "tenderpulse-ai"
    internal_service_key: str = "tenderpulse-internal-secret-2026"
    api_gateway_url: str = "http://localhost:3000"
    environment: str = "development"
    log_level: str = "INFO"

    # LLM Gateway Settings (OpenRouter / OpenAI-Compatible)
    llm_api_key: str | None = None
    llm_base_url: str = "https://openrouter.ai/api/v1"
    llm_model: str = "google/gemini-2.0-flash-001"
    llm_timeout_seconds: float = 45.0
    llm_max_retries: int = 2

    # Completion Queue & Webhook Event Choreography Settings (Design B)
    completion_queue_provider: str = "http"
    completion_webhook_path: str = "/api/v1/internal/extraction-completed"
    gcp_completion_topic: str | None = None
    aws_completion_queue_url: str | None = None

    @model_validator(mode="before")
    @classmethod
    def resolve_api_keys(cls, data: Any) -> Any:
        if isinstance(data, dict):
            key = (
                data.get("llm_api_key")
                or data.get("OPENROUTER_API_KEY")
                or data.get("LLM_API_KEY")
                or os.getenv("OPENROUTER_API_KEY")
                or os.getenv("LLM_API_KEY")
            )
            if key:
                data["llm_api_key"] = key
            model = (
                data.get("llm_model")
                or data.get("OPENROUTER_MODEL")
                or data.get("LLM_MODEL")
                or os.getenv("OPENROUTER_MODEL")
                or os.getenv("LLM_MODEL")
            )
            if model:
                data["llm_model"] = model
        return data

    model_config = SettingsConfigDict(env_file=(".env", "../.env", "../../.env"), extra="ignore")


settings = Settings()
