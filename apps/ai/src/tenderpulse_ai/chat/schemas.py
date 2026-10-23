from __future__ import annotations

import datetime
from enum import Enum
from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from tenderpulse_ai.security.context import SecurityContext


class ChatMessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"
    SYSTEM = "system"


class CitationSourceType(str, Enum):
    TENDER_DOCUMENT = "TENDER_DOCUMENT"
    COMPANY_EVIDENCE = "COMPANY_EVIDENCE"


class CitationDto(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    citation_id: str = Field(..., validation_alias=AliasChoices("citation_id", "citationId"))
    source_type: CitationSourceType = Field(
        ..., validation_alias=AliasChoices("source_type", "sourceType")
    )
    document_id: str = Field(..., validation_alias=AliasChoices("document_id", "documentId"))
    document_name: str = Field(..., validation_alias=AliasChoices("document_name", "documentName"))
    page_number: int = Field(default=1, validation_alias=AliasChoices("page_number", "pageNumber"))
    clause_reference: str | None = Field(
        default=None, validation_alias=AliasChoices("clause_reference", "clauseReference")
    )
    verbatim_quote: str = Field(
        ..., validation_alias=AliasChoices("verbatim_quote", "verbatimQuote")
    )
    confidence_score: float = Field(
        default=0.95, validation_alias=AliasChoices("confidence_score", "confidenceScore")
    )
    bounding_box: dict[str, Any] | None = Field(
        default=None, validation_alias=AliasChoices("bounding_box", "boundingBox")
    )

    def to_camel_dict(self) -> dict[str, Any]:
        return {
            "citationId": self.citation_id,
            "sourceType": self.source_type.value
            if hasattr(self.source_type, "value")
            else str(self.source_type),
            "documentId": self.document_id,
            "documentName": self.document_name,
            "pageNumber": self.page_number,
            "clauseReference": self.clause_reference,
            "verbatimQuote": self.verbatim_quote,
            "confidenceScore": self.confidence_score,
            "boundingBox": self.bounding_box,
        }


class ToolCallDto(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tool_name: str = Field(..., validation_alias=AliasChoices("tool_name", "toolName"))
    arguments: dict[str, Any] = Field(default_factory=dict)
    result: Any | None = None

    def to_camel_dict(self) -> dict[str, Any]:
        return {
            "toolName": self.tool_name,
            "arguments": self.arguments,
            "result": self.result,
        }


class FinancialSummaryCardDto(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    evaluated: bool = True
    metric_name: str = Field(..., validation_alias=AliasChoices("metric_name", "metricName"))
    required_value: str = Field(
        ..., validation_alias=AliasChoices("required_value", "requiredValue")
    )
    actual_value: str = Field(..., validation_alias=AliasChoices("actual_value", "actualValue"))
    verdict: str = "PASS"  # PASS, FAIL, REVIEW
    udin: str | None = None
    details: str | None = None

    def to_camel_dict(self) -> dict[str, Any]:
        return {
            "evaluated": self.evaluated,
            "metricName": self.metric_name,
            "requiredValue": self.required_value,
            "actualValue": self.actual_value,
            "verdict": self.verdict,
            "udin": self.udin,
            "details": self.details,
        }


class ChatMessageDto(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    conversation_id: str = Field(
        ..., validation_alias=AliasChoices("conversation_id", "conversationId")
    )
    organization_id: str = Field(
        ..., validation_alias=AliasChoices("organization_id", "organizationId")
    )
    role: ChatMessageRole
    content: str
    tool_calls: list[ToolCallDto] | None = Field(
        default=None, validation_alias=AliasChoices("tool_calls", "toolCalls")
    )
    citations: list[CitationDto] | None = None
    financial_summary: FinancialSummaryCardDto | None = Field(
        default=None, validation_alias=AliasChoices("financial_summary", "financialSummary")
    )
    metadata: dict[str, Any] | None = None
    created_at: str = Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC).isoformat(),
        validation_alias=AliasChoices("created_at", "createdAt"),
    )

    def to_camel_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "conversationId": self.conversation_id,
            "organizationId": self.organization_id,
            "role": self.role.value if hasattr(self.role, "value") else str(self.role),
            "content": self.content,
            "toolCalls": [t.to_camel_dict() for t in self.tool_calls] if self.tool_calls else None,
            "citations": [c.to_camel_dict() for c in self.citations] if self.citations else None,
            "financialSummary": self.financial_summary.to_camel_dict()
            if self.financial_summary
            else None,
            "metadata": self.metadata,
            "createdAt": self.created_at,
        }


class ChatQueryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    security_context: SecurityContext = Field(
        ..., validation_alias=AliasChoices("security_context", "securityContext")
    )
    query: str
    bid_id: str | None = Field(default=None, validation_alias=AliasChoices("bid_id", "bidId"))
    company_id: str | None = Field(
        default=None, validation_alias=AliasChoices("company_id", "companyId")
    )
    conversation_id: str | None = Field(
        default=None, validation_alias=AliasChoices("conversation_id", "conversationId")
    )
    history: list[dict[str, Any]] = Field(default_factory=list)
    context: dict[str, Any] | None = None


class ChatQueryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    conversation_id: str = Field(
        ..., validation_alias=AliasChoices("conversation_id", "conversationId")
    )
    message: ChatMessageDto
    suggested_followups: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("suggested_followups", "suggestedFollowups"),
    )
    audit_events: list[dict[str, Any]] = Field(
        default_factory=list, validation_alias=AliasChoices("audit_events", "auditEvents")
    )
