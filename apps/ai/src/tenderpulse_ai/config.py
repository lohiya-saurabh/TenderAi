import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Ensure .env is loaded into os.environ for external libraries (boto3, etc.)
_current_dir = Path(__file__).resolve().parent
for _env_path in (
    _current_dir.parents[1] / ".env",  # apps/ai/.env
    _current_dir.parents[2] / ".env",  # root .env
    Path.cwd() / "apps" / "ai" / ".env",
    Path.cwd() / ".env",
):
    if _env_path.is_file():
        load_dotenv(str(_env_path), override=False)


class Settings(BaseSettings):
    service_name: str = "tenderpulse-ai"
    internal_service_key: str = "tenderpulse-internal-secret-2026"
    api_gateway_url: str = "http://localhost:3000"
    environment: str = "development"
    log_level: str = "INFO"

    # Logging & Retention Settings
    log_dir: str = "logs"
    log_level_console: str = "INFO"
    log_level_file: str = "DEBUG"
    log_max_bytes: int = 10485760  # 10 MB
    log_backup_count: int = 5

    # LLM Gateway Settings (Multi-Provider Free Rotation & OpenRouter)
    llm_provider: str = (
        "rotation"  # "rotation", "gemini", "groq", "cerebras", "sambanova", "openrouter"
    )
    llm_api_key: str | None = None
    llm_base_url: str = "https://openrouter.ai/api/v1"
    llm_model: str = "openrouter/free"
    llm_timeout_seconds: float = 45.0
    llm_max_retries: int = 2
    batch_page_window_size: int = 3

    # Provider-Specific API Keys (Option C: Multi-Provider Free Rotation)
    gemini_api_key: str | None = None
    groq_api_key: str | None = None
    cerebras_api_key: str | None = None
    sambanova_api_key: str | None = None
    openrouter_api_key: str | None = None

    # AWS & Object Storage Settings
    aws_region: str = "ap-south-1"
    aws_s3_bucket: str = "tenderai-ap-south-1-1029"

    # Completion Queue Settings (Option B: Two-Queue Architecture)
    completion_queue_provider: str = "mock"  # "sqs", "pubsub", "mock"
    completion_webhook_path: str = "/api/v1/internal/extraction-completed"
    gcp_completion_topic: str | None = None
    aws_completion_queue_url: str | None = None

    # Ingestion Queue Settings (Option B: Direct Queue Worker)
    ingestion_queue_provider: str = "none"  # "sqs", "pubsub", "mock", "none"
    aws_ingestion_queue_url: str | None = None
    gcp_ingestion_subscription: str | None = None
    queue_poll_interval_seconds: float = 1.0
    queue_visibility_timeout_seconds: int = 300
    queue_heartbeat_interval_seconds: int = 60

    @model_validator(mode="before")
    @classmethod
    def resolve_api_keys(cls, data: Any) -> Any:
        if isinstance(data, dict):
            provider = (
                data.get("llm_provider") or data.get("LLM_PROVIDER") or os.getenv("LLM_PROVIDER")
            )
            if provider:
                data["llm_provider"] = str(provider).strip().lower()

            gemini_key = (
                data.get("gemini_api_key")
                or data.get("GEMINI_API_KEY")
                or data.get("GOOGLE_API_KEY")
                or os.getenv("GEMINI_API_KEY")
                or os.getenv("GOOGLE_API_KEY")
            )
            if gemini_key:
                data["gemini_api_key"] = str(gemini_key).strip()

            groq_key = (
                data.get("groq_api_key") or data.get("GROQ_API_KEY") or os.getenv("GROQ_API_KEY")
            )
            if groq_key:
                data["groq_api_key"] = str(groq_key).strip()

            cerebras_key = (
                data.get("cerebras_api_key")
                or data.get("CEREBRAS_API_KEY")
                or os.getenv("CEREBRAS_API_KEY")
            )
            if cerebras_key:
                data["cerebras_api_key"] = str(cerebras_key).strip()

            sambanova_key = (
                data.get("sambanova_api_key")
                or data.get("SAMBANOVA_API_KEY")
                or os.getenv("SAMBANOVA_API_KEY")
            )
            if sambanova_key:
                data["sambanova_api_key"] = str(sambanova_key).strip()

            openrouter_key = (
                data.get("openrouter_api_key")
                or data.get("OPENROUTER_API_KEY")
                or os.getenv("OPENROUTER_API_KEY")
            )
            if openrouter_key:
                data["openrouter_api_key"] = str(openrouter_key).strip()

            batch_size = (
                data.get("batch_page_window_size")
                or data.get("BATCH_PAGE_WINDOW_SIZE")
                or os.getenv("BATCH_PAGE_WINDOW_SIZE")
            )
            if batch_size:
                try:
                    data["batch_page_window_size"] = max(1, min(int(batch_size), 5))
                except (ValueError, TypeError):
                    data["batch_page_window_size"] = 3

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
                if str(model).strip() == "minimax/minimax-m3.1-flash:free":
                    model = "minimax/minimax-m3.1-flash"
                data["llm_model"] = model

            region = (
                data.get("aws_region")
                or data.get("AWS_REGION")
                or data.get("AWS_DEFAULT_REGION")
                or os.getenv("AWS_REGION")
                or os.getenv("AWS_DEFAULT_REGION")
            )
            if region:
                data["aws_region"] = region

            s3_bucket = (
                data.get("aws_s3_bucket") or data.get("AWS_S3_BUCKET") or os.getenv("AWS_S3_BUCKET")
            )
            if s3_bucket:
                data["aws_s3_bucket"] = s3_bucket

            ingestion_url = (
                data.get("aws_ingestion_queue_url")
                or data.get("AWS_INGESTION_QUEUE_URL")
                or data.get("AWS_SQS_INGESTION_QUEUE_URL")
                or data.get("AWS_SQS_QUEUE_URL")
                or os.getenv("AWS_INGESTION_QUEUE_URL")
                or os.getenv("AWS_SQS_INGESTION_QUEUE_URL")
                or os.getenv("AWS_SQS_QUEUE_URL")
            )
            if ingestion_url:
                data["aws_ingestion_queue_url"] = ingestion_url

            completion_url = (
                data.get("aws_completion_queue_url")
                or data.get("AWS_COMPLETION_QUEUE_URL")
                or data.get("AWS_SQS_COMPLETION_QUEUE_URL")
                or os.getenv("AWS_COMPLETION_QUEUE_URL")
                or os.getenv("AWS_SQS_COMPLETION_QUEUE_URL")
            )
            if completion_url:
                data["aws_completion_queue_url"] = completion_url
        return data

    model_config = SettingsConfigDict(env_file=(".env", "../.env", "../../.env"), extra="ignore")


settings = Settings()
