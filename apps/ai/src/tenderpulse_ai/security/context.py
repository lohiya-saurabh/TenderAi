from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SecurityContext(BaseModel):
    """
    Immutable security context that must be present in every AI execution,
    graph state transition, and tool call.
    Enforces Zero-Trust AI architecture as defined in ADR 0011 and ADR 0013.
    """
    model_config = ConfigDict(frozen=True)

    tenant_id: str = Field(..., min_length=1, description="Immutable tenant/organization boundary")
    user_id: str = Field(..., min_length=1, description="Authenticated user initiating or supervising workflow")
    workflow_run_id: str = Field(..., min_length=1, description="Unique execution instance identifier")
    roles: list[str] = Field(default_factory=list, description="Assigned tenant RBAC roles")
    permissions: list[str] = Field(default_factory=list, description="Explicit caller permissions")
    allowed_document_ids: list[str] = Field(..., min_length=1, description="Explicit whitelist of authorized document IDs")
    allowed_source_ids: list[str] = Field(default_factory=list, description="Whitelisted public procurement portal sources")
    purpose: Literal["COMPLIANCE_EXTRACTION", "CORRIGENDUM_ANALYSIS", "PROPOSAL_DRAFTING"] = Field(
        default="COMPLIANCE_EXTRACTION",
        description="Explicit business purpose of the AI invocation"
    )
