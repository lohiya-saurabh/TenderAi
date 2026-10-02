from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "tenderpulse-ai"
    internal_service_key: str = "tenderpulse-internal-secret-2026"
    api_gateway_url: str = "http://localhost:3000"
    environment: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
