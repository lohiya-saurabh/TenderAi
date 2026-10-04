import secrets

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel

from tenderpulse_ai.config import settings
from tenderpulse_ai.pipeline import (
    DocumentExtractionRequest,
    DocumentExtractionResponse,
    ProductionExtractionPipeline,
)

app = FastAPI(
    title="TenderPulse AI Engine",
    description="Internal AI extraction and document intelligence worker service",
    version="0.1.0",
)


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


def verify_internal_key(
    x_internal_service_key: str | None = Header(None, alias="X-Internal-Service-Key"),
) -> None:
    if not x_internal_service_key or not secrets.compare_digest(
        x_internal_service_key, settings.internal_service_key
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized internal service call",
        )



@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="tenderpulse-ai",
        version="0.1.0",
    )


@app.get("/")
async def root():
    return {"message": "TenderPulse AI Service Operational"}


@app.post(
    "/api/v1/extract",
    response_model=DocumentExtractionResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def extract_document(request: DocumentExtractionRequest):
    pipeline = ProductionExtractionPipeline()
    return await pipeline.execute(request)

