from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class WorkflowStatus(str, Enum):
    INITIALIZED = "INITIALIZED"
    RETRIEVED = "RETRIEVED"
    EXTRACTED = "EXTRACTED"
    VERIFIED = "VERIFIED"
    RETRYING = "RETRYING"
    AWAITING_HUMAN_REVIEW = "AWAITING_HUMAN_REVIEW"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ExecutionRulesProps(BaseModel):
    stamp_paper_required: bool = Field(default=False)
    stamp_paper_denomination_inr: int | None = Field(default=None)
    notarization_required: bool = Field(default=False)
    signing_authority_rank: str = Field(default="Authorized Signatory")
    udin_required: bool = Field(default=False)

    @field_validator("stamp_paper_denomination_inr")
    @classmethod
    def validate_denomination(cls, v, values):
        return v


class ProvenanceProps(BaseModel):
    source_document_id: str = Field(..., min_length=1)
    source_file_name: str = Field(..., min_length=1)
    page_number: int = Field(..., ge=1)
    clause_reference: str = Field(..., min_length=1)
    verbatim_quote: str = Field(..., min_length=1, description="Verbatim quote from source text for grounding")
    confidence_score: float = Field(..., ge=0.0, le=1.0)


class CandidateComplianceItem(BaseModel):
    """Structured output schema expected from LLM reasoning."""
    category: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    execution_rules: ExecutionRulesProps
    provenance: ProvenanceProps


class VerifiedComplianceItem(BaseModel):
    """Compliance item that has passed deterministic verification."""
    category: str
    title: str
    description: str
    execution_rules: ExecutionRulesProps
    provenance: ProvenanceProps
    is_verified: bool = True
    verification_method: str = "EXACT_SUBSTRING_GROUNDING"

    def to_api_payload(self) -> dict[str, Any]:
        """Maps to apps/api ExtractedComplianceItemInput format."""
        return {
            "category": self.category,
            "title": self.title,
            "description": self.description,
            "executionRules": {
                "stampPaperRequired": self.execution_rules.stamp_paper_required,
                "stampPaperDenominationInr": self.execution_rules.stamp_paper_denomination_inr or 0,
                "notarizationRequired": self.execution_rules.notarization_required,
                "signingAuthorityRank": self.execution_rules.signing_authority_rank,
                "udinRequired": self.execution_rules.udin_required,
            },
            "provenance": {
                "sourceDocumentId": self.provenance.source_document_id,
                "sourceFileName": self.provenance.source_file_name,
                "pageNumber": self.provenance.page_number,
                "clauseReference": self.provenance.clause_reference,
                "verbatimQuote": self.provenance.verbatim_quote,
                "confidenceScore": self.provenance.confidence_score,
            },
        }


class AuditEvent(BaseModel):
    timestamp: str
    tenant_id: str
    user_id: str
    workflow_run_id: str
    action: str
    entity_type: str
    entity_id: str
    details: dict[str, Any] = Field(default_factory=dict)
