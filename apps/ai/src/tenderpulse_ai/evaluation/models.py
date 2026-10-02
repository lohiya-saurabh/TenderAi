from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class EvaluationCaseType(str, Enum):
    STANDARD_NIT = "STANDARD_NIT"
    PROMPT_INJECTION = "PROMPT_INJECTION"
    MALICIOUS_PDF = "MALICIOUS_PDF"
    MISLEADING_CONTENT = "MISLEADING_CONTENT"
    MISSING_INFORMATION = "MISSING_INFORMATION"
    CONFLICTING_DOCUMENTS = "CONFLICTING_DOCUMENTS"
    MALFORMED_DOCUMENT = "MALFORMED_DOCUMENT"
    UNAUTHORIZED_DOCUMENT = "UNAUTHORIZED_DOCUMENT"
    CROSS_TENANT_ACCESS = "CROSS_TENANT_ACCESS"


class ExpectedItem(BaseModel):
    category: str
    title: str
    description_keywords: list[str] = Field(default_factory=list)
    stamp_paper_required: bool = False
    stamp_paper_denomination_inr: int | None = None
    udin_required: bool = False
    clause_reference: str
    verbatim_quote: str


class SyntheticEvaluationCase(BaseModel):
    case_id: str
    case_type: EvaluationCaseType
    name: str
    description: str
    tenant_id: str
    target_document_id: str
    allowed_document_ids: list[str]
    page_number: int
    raw_page_text: str
    chunk_texts: list[str]
    clause_reference: str
    expected_items: list[ExpectedItem] = Field(default_factory=list)
    is_adversarial: bool = False
    adversarial_payload: str | None = None
    expected_security_exception: str | None = None
    allow_empty_extraction: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


@dataclass
class CaseEvaluationResult:
    case_id: str
    case_type: EvaluationCaseType
    passed: bool
    schema_valid: bool
    groundedness_score: float
    citation_correct: bool
    classification_correct: bool
    adversarial_neutralized: bool
    security_isolated: bool
    refusal_correct: bool
    extracted_count: int
    expected_count: int
    verified_count: int
    notes: list[str] = field(default_factory=list)


@dataclass
class EvaluationSuiteMetrics:
    total_cases: int = 0
    passed_cases: int = 0
    failed_cases: int = 0
    overall_pass_rate: float = 0.0

    # 1. Extraction Metrics
    true_positives: int = 0
    false_positives: int = 0
    false_negatives: int = 0
    extraction_precision: float = 0.0
    extraction_recall: float = 0.0
    extraction_f1: float = 0.0

    # 2. Classification & Schema
    classification_accuracy: float = 0.0
    schema_correctness_rate: float = 0.0

    # 3. Groundedness & Citations
    groundedness_rate: float = 0.0
    source_citation_accuracy: float = 0.0
    hallucination_suppression_rate: float = 0.0

    # 4. Adversarial & Refusal
    adversarial_neutralization_rate: float = 0.0
    refusal_correctness_rate: float = 0.0

    # 5. Security & Isolation (Zero Tolerance)
    tenant_isolation_enforcement_rate: float = 0.0
    document_isolation_enforcement_rate: float = 0.0

    # Regression indicator
    regression_detected: bool = False
    regression_details: list[str] = field(default_factory=list)
