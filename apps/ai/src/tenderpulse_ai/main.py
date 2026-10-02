from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(
    title="TenderPulse AI Engine",
    description="Internal AI extraction and document intelligence worker service",
    version="0.1.0",
)


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


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
