from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "tenderpulse-ai"
    internal_service_key: str = "tenderpulse-internal-secret-2026"
    api_gateway_url: str = "http://localhost:3000"
    environment: str = "development"
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
