from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from tenderpulse_ai.security.context import SecurityContext


class NormalizedPage(BaseModel):
    page_number: int = Field(..., ge=1)
    text: str = Field(..., min_length=1)


class DocumentExtractionRequest(BaseModel):
    security_context: SecurityContext
    bid_id: str
    document_id: str
    document_type: str = "NIT"
    file_name: str
    download_url: str | None = None
    pages: list[NormalizedPage] = Field(default_factory=list)


class DocumentExtractionResponse(BaseModel):
    bid_id: str
    document_id: str
    status: str
    items: list[dict[str, Any]]
    chunks: list[dict[str, Any]] = Field(default_factory=list)
    human_review_required: bool
    audit_events: list[dict[str, Any]]
    okf_bundle: dict[str, Any] | None = Field(
        default=None, description="Compiled Open Knowledge Format (OKF) Bundle"
    )
    uncertainty_items: list[dict[str, Any]] = Field(
        default_factory=list, description="Contradiction and uncertainty items"
    )
