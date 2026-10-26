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
    source_document_id: str = Field(default="doc-general")
    source_file_name: str = Field(default="NIT_Document.pdf")
    page_number: int = Field(default=1, ge=1)
    clause_reference: str = Field(default="Clause Reference")
    source_block_id: str | None = Field(default=None)
    verbatim_quote: str = Field(
        default="",
        description="Verbatim quote from source text for grounding",
    )
    confidence_score: float = Field(default=0.95, ge=0.0, le=1.0)

    @field_validator("source_document_id", mode="before")
    @classmethod
    def validate_doc_id(cls, v: Any) -> str:
        return str(v) if v and str(v).strip() else "doc-general"

    @field_validator("source_file_name", mode="before")
    @classmethod
    def validate_file_name(cls, v: Any) -> str:
        return str(v) if v and str(v).strip() else "NIT_Document.pdf"

    @field_validator("clause_reference", mode="before")
    @classmethod
    def validate_clause_ref(cls, v: Any) -> str:
        return str(v) if v and str(v).strip() else "Clause Reference"

    @field_validator("verbatim_quote", mode="before")
    @classmethod
    def validate_quote(cls, v: Any) -> str:
        return str(v).strip() if v else ""

    @field_validator("page_number", mode="before")
    @classmethod
    def validate_page(cls, v: Any) -> int:
        try:
            val = int(v)
            return val if val >= 1 else 1
        except (ValueError, TypeError):
            return 1


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
                "sourceBlockId": self.provenance.source_block_id,
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


# ==============================================================================
# Node 1 - 8 Workflow Domain Schemas
# ==============================================================================


class DoclingBlock(BaseModel):
    block_id: str = Field(..., min_length=1)
    type: str = Field(default="paragraph", description="heading, paragraph, list_item, table")
    level: int | None = Field(default=None, description="Heading level 1, 2, 3...")
    text: str = Field(..., min_length=1)
    page_number: int = Field(default=1, ge=1)
    bbox: list[float] | None = Field(default=None)
    is_deleted: bool = Field(default=False)
    spans_next_page: bool = Field(
        default=False, description="Text was stitched across a physical page break"
    )


class DoclingTable(BaseModel):
    table_id: str = Field(..., min_length=1)
    page_number: int = Field(default=1, ge=1)
    headers: list[str] = Field(default_factory=list)
    rows: list[list[str]] = Field(default_factory=list)
    caption: str | None = Field(default=None)
    row_key_map: dict[str, str] = Field(default_factory=dict)

    def to_markdown(self) -> str:
        """Serializes the table into a standard GitHub-flavored Markdown table string."""
        if not self.headers and not self.rows:
            return ""

        headers = (
            self.headers
            if self.headers
            else [f"Col {i + 1}" for i in range(len(self.rows[0]) if self.rows else 0)]
        )
        header_row = "| " + " | ".join(headers) + " |"
        separator_row = "| " + " | ".join(["---"] * len(headers)) + " |"

        row_lines: list[str] = []
        for row in self.rows:
            # Pad or truncate row to match header length
            padded = row + [""] * (len(headers) - len(row))
            row_lines.append("| " + " | ".join(padded[: len(headers)]) + " |")

        return "\n".join([header_row, separator_row] + row_lines)

    def to_dict_records(self) -> list[dict[str, str]]:
        """Converts table rows into a list of dictionaries mapping header name to cell value."""
        if not self.headers or not self.rows:
            return []
        records: list[dict[str, str]] = []
        for row in self.rows:
            rec: dict[str, str] = {}
            for idx, h in enumerate(self.headers):
                rec[h] = row[idx] if idx < len(row) else ""
            records.append(rec)
        return records

    def get_cell(self, row_idx: int, col_name: str) -> str | None:
        """Retrieves a cell value by row index and column header name."""
        records = self.to_dict_records()
        if 0 <= row_idx < len(records):
            return records[row_idx].get(col_name)
        return None


class DoclingParsedDocument(BaseModel):
    document_id: str = Field(..., min_length=1)
    file_name: str = Field(default="document.pdf")
    pages: list[dict[str, Any]] = Field(default_factory=list)
    blocks: list[DoclingBlock] = Field(default_factory=list)
    tables: list[DoclingTable] = Field(default_factory=list)


class SectionNode(BaseModel):
    node_id: str = Field(..., min_length=1)
    number: str = Field(..., description="PART I, Section 1, 1.1, Clause 4.2.3")
    title: str = Field(default="")
    level: int = Field(default=1)
    parent_id: str | None = Field(default=None)
    block_ids: list[str] = Field(default_factory=list)


class DocumentStructureTree(BaseModel):
    document_id: str
    nodes: list[SectionNode] = Field(default_factory=list)
    block_paths: dict[str, str] = Field(
        default_factory=dict,
        description="block_id -> positional clause path (e.g. 'Clause 5(xix)', 'Clause 13.C(3)')",
    )


class CandidatePassage(BaseModel):
    candidate_id: str = Field(..., min_length=1)
    section_number: str = Field(default="Unassigned")
    section_path: str = Field(default="Document")
    text: str = Field(..., min_length=1)
    page_number: int = Field(default=1, ge=1)
    block_id: str
    matched_rules: list[str] = Field(default_factory=list)
    priority_score: float = Field(default=0.5, ge=0.0, le=1.0)
    is_table_cell: bool = Field(default=False)
    extraction_tier: str = Field(default="PRIMARY")
    context_path: str = Field(default="")


class AssembledClauseContext(BaseModel):
    candidate_id: str
    section_path: str
    clause_reference: str
    current_clause: str
    previous_clause: str | None = None
    following_clause: str | None = None
    relevant_definitions: dict[str, str] = Field(default_factory=dict)
    referenced_clauses: list[str] = Field(default_factory=list)
    page_number: int = 1
    hydrated_context: str | None = None


class NodeValidationCheck(BaseModel):
    citation_supported: bool = True
    referenced_clause_exists: bool = True
    numbers_preserved: bool = True
    shall_must_correct: bool = True
    exceptions_retained: bool = True
    confidence_score: float = Field(default=1.0, ge=0.0, le=1.0)
    discrepancies: list[str] = Field(default_factory=list)


class ConfidenceTier(str, Enum):
    AUTO_ACCEPT = "AUTO_ACCEPT"  # >= 95%
    REVIEWER_VERIFICATION = "REVIEWER_VERIFICATION"  # 80-94%
    MANDATORY_HUMAN_REVIEW = "MANDATORY_HUMAN_REVIEW"  # < 80%
