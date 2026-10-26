"""LLM extraction of company evidence documents (CA turnover certificates, balance sheets,
work orders / completion certificates, ISO certificates, statutory registrations).

Every attribute comes from the model together with the verbatim quote it was read from;
an attribute whose quote (or value) is not found on the stated page is dropped. Amounts are
parsed from the quoted text, never estimated. There is no regex/rule fallback: when no model
answers, the response is status=FAILED with the reason.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import BaseModel, Field

from tenderpulse_ai.decision.schemas import EvidenceChunkWire
from tenderpulse_ai.domain.pdf_resolver import resolve_pdf_to_pages
from tenderpulse_ai.extraction.metrics import extract_monetary_amounts
from tenderpulse_ai.pipeline import NormalizedPage
from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.security.sanitizer import UNTRUSTED_DATA_DIRECTIVE, SecretSanitizer

logger = logging.getLogger("tenderpulse_ai.evidence_extractor")

EVIDENCE_CATEGORIES = (
    "FINANCIAL_TURNOVER",
    "PROJECT_EXPERIENCE",
    "CERTIFICATION",
    "REGISTRATION",
    "GENERAL",
)
TEXT_ATTRIBUTES = (
    "issuer",
    "reference_number",
    "valid_from",
    "valid_to",
    "udin",
    "ca_firm",
    "ca_membership_no",
    "client_name",
    "project_name",
    "work_order_no",
    "scope",
    "start_date",
    "completion_date",
    "standard",
    "certificate_number",
    "registered_name",
    "gstin",
    "pan",
    "cin",
    "udyam_registration",
)
# Amount attributes: the model copies the amount as written; crores are parsed from it.
AMOUNT_ATTRIBUTES = ("net_worth", "contract_value", "completed_value")

SYSTEM_PROMPT = (
    "You extract facts from an Indian company's evidence document (CA turnover certificate, audited "
    "balance sheet, work order / completion certificate, ISO or other accreditation, GST/PAN/CIN/Udyam "
    "registration).\n"
    "Rules:\n"
    "- Report only facts printed in the document. Never infer, estimate, convert or complete a value.\n"
    "- Copy every value exactly as written, and give the complete sentence or table row it appears in "
    "as 'verbatim_quote', copied character for character from the page it is on.\n"
    "- Omit any attribute the document does not state.\n"
    "- " + UNTRUSTED_DATA_DIRECTIVE + "\n"
    "Respond with one JSON object:\n"
    "{\n"
    '  "evidence_category": "FINANCIAL_TURNOVER" | "PROJECT_EXPERIENCE" | "CERTIFICATION" | '
    '"REGISTRATION" | "GENERAL",\n'
    '  "attributes": [{"name": <one of: ' + ", ".join(TEXT_ATTRIBUTES + AMOUNT_ATTRIBUTES) + ">, "
    '"value": "as written", "page_number": int, "verbatim_quote": "..."}],\n'
    '  "turnover_by_fy": [{"financial_year": "as written, e.g. 2023-24", "amount": "as written, e.g. '
    'Rs. 320.50 Crore", "page_number": int, "verbatim_quote": "..."}]\n'
    "}"
)


class CompanyEvidenceExtractionRequest(BaseModel):
    security_context: SecurityContext
    organization_id: str
    company_id: str
    evidence_document_id: str
    file_name: str
    evidence_type: str = "OTHER"
    download_url: str | None = None
    pages: list[NormalizedPage] = Field(default_factory=list)


class CompanyEvidenceExtractionResponse(BaseModel):
    evidence_document_id: str
    organization_id: str
    company_id: str
    status: str
    extracted_attributes: dict[str, Any] = Field(default_factory=dict)
    chunks: list[EvidenceChunkWire] = Field(default_factory=list)
    error: str | None = None


def _norm(text: Any) -> str:
    return " ".join(str(text or "").lower().split())


def _grounded(entry: dict[str, Any], page_text: dict[int, str], value: Any) -> int | None:
    """Page number holding the entry's quote and value, or None (dropped as ungrounded)."""
    quote, val = _norm(entry.get("verbatim_quote")), _norm(value)
    if not quote or not val or val not in quote:
        return None
    stated = entry.get("page_number")
    pages = ([stated] if stated in page_text else []) + [p for p in page_text if p != stated]
    return next((p for p in pages if quote in page_text[p]), None)


def _crores(amount_text: str) -> float | None:
    amounts = extract_monetary_amounts(amount_text)
    return round(amounts[0]["value_in_inr"] / 1e7, 2) if amounts else None


def parse_evidence_response(data: dict[str, Any], pages: list[NormalizedPage]) -> dict[str, Any]:
    """Validates the model's JSON and keeps only page-grounded attributes."""
    choices = data.get("choices") or [{}]
    content = str((choices[0].get("message") or {}).get("content") or "").strip()
    content = content.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    parsed = json.loads(content)  # invalid JSON raises -> next model
    if not isinstance(parsed, dict) or not isinstance(parsed.get("attributes", []), list):
        raise ValueError(f"Evidence response is not the expected object: {content[:200]!r}")

    page_text = {p.page_number: _norm(p.text) for p in pages}
    category = str(parsed.get("evidence_category") or "GENERAL").upper()
    attrs: dict[str, Any] = {
        "evidence_category": category if category in EVIDENCE_CATEGORIES else "GENERAL"
    }
    sources: dict[str, int] = {}

    for entry in parsed.get("attributes") or []:
        if not isinstance(entry, dict):
            continue
        name, value = str(entry.get("name") or ""), entry.get("value")
        page = _grounded(entry, page_text, value)
        if page is None:
            continue
        if name in TEXT_ATTRIBUTES:
            attrs[name] = str(value).strip()
        elif name in AMOUNT_ATTRIBUTES and (crores := _crores(str(value))) is not None:
            attrs[f"{name}_inr_cr"] = crores
        else:
            continue
        sources[name] = page

    turnover: dict[str, float] = {}
    for entry in parsed.get("turnover_by_fy") or []:
        if not isinstance(entry, dict):
            continue
        amount = entry.get("amount")
        year = str(entry.get("financial_year") or "").strip()
        if year and _grounded(entry, page_text, amount) is not None:
            crores = _crores(str(amount))
            if crores is not None:
                turnover[year] = crores
    if turnover:
        attrs["turnover_by_fy"] = turnover
        latest = sorted(turnover)[-1]
        attrs["latest_turnover_inr_cr"] = turnover[latest]
        attrs["average_turnover_inr_cr"] = round(sum(turnover.values()) / len(turnover), 2)

    if "udin" in attrs:
        attrs.setdefault("reference_number", attrs["udin"])
    if "ca_firm" in attrs:
        attrs.setdefault("issuer", attrs["ca_firm"])
    attrs["_sources"] = sources
    return attrs


class CompanyEvidenceExtractor:
    """LLM-only extraction & chunking of company evidence documents."""

    def __init__(self, llm_client: Any | None = None):
        self._llm_client = llm_client

    def _client(self) -> Any:
        if self._llm_client is None:
            from tenderpulse_ai.config import settings
            from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
                OpenAICompatibleLlmClient,
            )

            self._llm_client = OpenAICompatibleLlmClient.create_from_settings(settings)
        return self._llm_client

    async def extract(
        self, request: CompanyEvidenceExtractionRequest
    ) -> CompanyEvidenceExtractionResponse:
        # Raw PDF bytes decoded as text ("%PDF-1.7 ...") are not page text.
        pages = [p for p in request.pages if not p.text.lstrip().startswith("%PDF")]
        if not pages and request.download_url:
            try:
                pages = await resolve_pdf_to_pages(
                    download_url=request.download_url,
                    document_id=request.evidence_document_id,
                    file_name=request.file_name,
                )
            except Exception as exc:
                logger.warning(
                    "Could not stream PDF from download URL for evidence doc %s: %s",
                    request.evidence_document_id,
                    exc,
                )
        if not pages:
            return self._failed(
                request, "Document contains no extractable text or downloadable pages."
            )

        user_prompt = "\n\n".join(
            SecretSanitizer.wrap_untrusted_data(
                document_id=request.evidence_document_id,
                page_number=p.page_number,
                content=SecretSanitizer.scrub(p.text)[0],
            )
            for p in pages
        )
        # The uploader chooses the file name and declared type, so they are untrusted too.
        upload_info = SecretSanitizer.wrap_untrusted_context(
            "upload_metadata",
            f"Evidence type declared by the uploader: {request.evidence_type or 'OTHER'}\n"
            f"File name: {request.file_name}",
        )
        user_prompt = f"{upload_info}\n\n{user_prompt}"
        try:
            attrs = await self._client().complete_structured(
                SYSTEM_PROMPT,
                user_prompt,
                parse=lambda data: parse_evidence_response(data, pages),
            )
        except Exception as exc:  # noqa: BLE001 - LLM-only: report, never fall back
            logger.error(
                "LLM evidence extraction failed for doc %s: %s",
                request.evidence_document_id,
                exc,
                extra={
                    "event": "evidence.extraction.failed",
                    "error_code": "ERR_LLM_EXTRACTION_FAILED",
                },
            )
            return self._failed(request, f"LLM extraction failed: {exc}")

        sources: dict[str, int] = attrs.pop("_sources", {})
        category = attrs["evidence_category"]
        chunks = [
            EvidenceChunkWire(
                chunk_id=f"chk_{request.evidence_document_id}_{idx}",
                document_id=request.evidence_document_id,
                file_name=request.file_name,
                page_number=page.page_number,
                chunk_type=category,
                content=page.text.strip(),
                clause_reference=f"{request.file_name} (Page {page.page_number})",
                metadata={
                    "file_name": request.file_name,
                    **{
                        k: attrs[k]
                        for k, p in sources.items()
                        if p == page.page_number and k in attrs
                    },
                    **(
                        {
                            "turnover_by_fy": attrs["turnover_by_fy"],
                            "average_turnover_cr": attrs["average_turnover_inr_cr"],
                        }
                        if "turnover_by_fy" in attrs
                        else {}
                    ),
                },
            )
            for idx, page in enumerate(pages)
            if page.text.strip()
        ]
        return CompanyEvidenceExtractionResponse(
            evidence_document_id=request.evidence_document_id,
            organization_id=request.organization_id,
            company_id=request.company_id,
            status="COMPLETED",
            extracted_attributes=attrs,
            chunks=chunks,
        )

    @staticmethod
    def _failed(
        request: CompanyEvidenceExtractionRequest, reason: str
    ) -> CompanyEvidenceExtractionResponse:
        return CompanyEvidenceExtractionResponse(
            evidence_document_id=request.evidence_document_id,
            organization_id=request.organization_id,
            company_id=request.company_id,
            status="FAILED",
            error=reason,
        )
