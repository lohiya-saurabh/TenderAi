from __future__ import annotations

import logging
import re
from typing import Any

from pydantic import BaseModel, Field

from tenderpulse_ai.decision.schemas import EvidenceChunkWire
from tenderpulse_ai.domain.pdf_resolver import resolve_pdf_to_pages
from tenderpulse_ai.pipeline import NormalizedPage
from tenderpulse_ai.security.context import SecurityContext

logger = logging.getLogger("tenderpulse_ai.evidence_extractor")


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


class CompanyEvidenceExtractor:
    """
    Automated extraction & chunking engine for company evidence documents:
    - Financial turnover statements, CA certificates, and balance sheets (UDIN, FY turnover, average turnover)
    - Work order and project completion certificates (client, completed value in INR Cr, dates, scope)
    - ISO & statutory accreditations (standard, registrar, cert number, validity period)
    - Statutory identity registrations (GSTIN, PAN, CIN, Udyam)
    """

    async def extract(
        self, request: CompanyEvidenceExtractionRequest
    ) -> CompanyEvidenceExtractionResponse:
        pages = list(request.pages)
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
            # Fallback to single page using filename
            text_stub = (
                f"Company Evidence Document: {request.file_name}. "
                f"Evidence Type: {request.evidence_type}. "
                f"Document ID: {request.evidence_document_id}."
            )
            pages = [NormalizedPage(page_number=1, text=text_stub)]

        combined_text = "\n\n".join(f"[Page {p.page_number}]\n{p.text}" for p in pages)
        evidence_type = (request.evidence_type or "OTHER").upper()

        extracted_attrs: dict[str, Any] = {}
        chunks: list[EvidenceChunkWire] = []

        if evidence_type in (
            "AUDITED_BALANCE_SHEET",
            "TURNOVER_CERTIFICATE",
            "FINANCIAL_STATEMENT",
        ) or self._detect_financial_context(combined_text):
            extracted_attrs, chunks = self._extract_financial_evidence(
                request=request, pages=pages, combined_text=combined_text
            )
        elif evidence_type in (
            "WORK_ORDER",
            "COMPLETION_CERT",
            "SIMILAR_WORK",
        ) or self._detect_experience_context(combined_text):
            extracted_attrs, chunks = self._extract_experience_evidence(
                request=request, pages=pages, combined_text=combined_text
            )
        elif evidence_type in (
            "ISO_CERT",
            "ACCREDITATION",
        ) or self._detect_certification_context(combined_text):
            extracted_attrs, chunks = self._extract_certification_evidence(
                request=request, pages=pages, combined_text=combined_text
            )
        elif evidence_type in (
            "GST_REG",
            "PAN_CARD",
            "INCORPORATION_CERT",
            "UDYAM_CERT",
        ) or self._detect_registration_context(combined_text):
            extracted_attrs, chunks = self._extract_registration_evidence(
                request=request, pages=pages, combined_text=combined_text
            )
        else:
            extracted_attrs, chunks = self._extract_generic_evidence(
                request=request, pages=pages, combined_text=combined_text
            )

        return CompanyEvidenceExtractionResponse(
            evidence_document_id=request.evidence_document_id,
            organization_id=request.organization_id,
            company_id=request.company_id,
            status="COMPLETED",
            extracted_attributes=extracted_attrs,
            chunks=chunks,
        )

    def _detect_financial_context(self, text: str) -> bool:
        return bool(
            re.search(
                r"\b(?:turnover|balance sheet|profit & loss|udin|chartered accountant|net worth)\b",
                text,
                re.IGNORECASE,
            )
        )

    def _detect_experience_context(self, text: str) -> bool:
        return bool(
            re.search(
                r"\b(?:completion certificate|work order|contract value|substantially completed|satisfactorily completed|similar work)\b",
                text,
                re.IGNORECASE,
            )
        )

    def _detect_certification_context(self, text: str) -> bool:
        return bool(
            re.search(
                r"\b(?:iso\s*\d{4,5}|certificate of registration|bureau veritas|quality management system|accreditation)\b",
                text,
                re.IGNORECASE,
            )
        )

    def _detect_registration_context(self, text: str) -> bool:
        return bool(
            re.search(
                r"\b(?:gstin|permanent account number|pan card|cin|udyam registration)\b",
                text,
                re.IGNORECASE,
            )
        )

    def _extract_financial_evidence(
        self,
        request: CompanyEvidenceExtractionRequest,
        pages: list[NormalizedPage],
        combined_text: str,
    ) -> tuple[dict[str, Any], list[EvidenceChunkWire]]:
        attrs: dict[str, Any] = {"evidence_category": "FINANCIAL_TURNOVER"}

        # 1. UDIN extraction (18 alphanumeric chars, typical format like 25089745AAAAAA1234)
        udin_match = re.search(
            r"\b(?:udin\s*[:\s-]*)\s*([0-9]{2}[0-9A-Z]{6}[A-Z]{6}[0-9]{4}|[0-9A-Z]{18})\b",
            combined_text,
            re.IGNORECASE,
        )
        if udin_match:
            attrs["udin"] = udin_match.group(1).upper()
            attrs["reference_number"] = attrs["udin"]
        else:
            # Fallback UDIN search
            udin_generic = re.search(r"\b([0-9]{8}[A-Z]{6}[0-9]{4})\b", combined_text)
            if udin_generic:
                attrs["udin"] = udin_generic.group(1).upper()
                attrs["reference_number"] = attrs["udin"]

        # 2. CA Firm / Membership Number
        ca_m_match = re.search(
            r"\b(?:m(?:embership)?\.?\s*no\.?|mno\.?)\s*[:\s]*(\d{5,7})\b",
            combined_text,
            re.IGNORECASE,
        )
        if ca_m_match:
            attrs["ca_membership_no"] = ca_m_match.group(1)

        ca_firm_match = re.search(
            r"\b(?:for|m/s\.?)\s+([A-Z][A-Za-z0-9\s.,&-]+?(?:Chartered Accountants|LLP|& Co\.?))\b",
            combined_text,
            re.IGNORECASE,
        )
        if ca_firm_match:
            attrs["issuer"] = ca_firm_match.group(1).strip()
            attrs["ca_firm"] = attrs["issuer"]

        # 3. Multi-year turnover extraction
        # Look for patterns like "FY 2024-25: ₹320.5 Cr" or "2023-24 ... 280 Cr"
        fy_turnovers: dict[str, float] = {}
        turnover_patterns = [
            r"(?:FY\s*)?(?:20)?(\d{2})[-–](?:20)?(\d{2})\s*[:\s-]*.*?(?:inr|rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\s*(?:cr(?:ore)?s?|crore)",
            r"(?:inr|rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\s*(?:cr(?:ore)?s?|crore)\s*(?:for\s+FY\s*)?(?:20)?(\d{2})[-–](?:20)?(\d{2})",
        ]
        for pat in turnover_patterns:
            for match in re.finditer(pat, combined_text, re.IGNORECASE):
                groups = match.groups()
                if len(groups) == 3:
                    if groups[0].isdigit() and groups[1].isdigit():
                        fy_key = f"FY20{groups[0]}-{groups[1]}"
                        val = float(groups[2].replace(",", ""))
                    else:
                        val = float(groups[0].replace(",", ""))
                        fy_key = f"FY20{groups[1]}-{groups[2]}"
                    if 0.1 <= val <= 50000.0:
                        fy_turnovers[fy_key] = val

        # If no specific FY pattern found, search for general turnover amount
        if not fy_turnovers:
            gen_match = re.search(
                r"(?:annual\s+turnover|turnover)[^.\n]*?(?:inr|rs\.?|₹)\s*([\d,]+(?:\.\d+)?)\s*(?:cr(?:ore)?s?|crore)",
                combined_text,
                re.IGNORECASE,
            )
            if gen_match:
                fy_turnovers["FY_LATEST"] = float(gen_match.group(1).replace(",", ""))

        if fy_turnovers:
            attrs["turnover_by_fy"] = fy_turnovers
            turnover_values = list(fy_turnovers.values())
            attrs["latest_turnover_inr_cr"] = turnover_values[-1]
            attrs["average_turnover_inr_cr"] = round(sum(turnover_values) / len(turnover_values), 2)

        # 4. Net Worth
        net_worth_match = re.search(
            r"net\s*worth[^.\n]*?(?:inr|rs\.?|₹)\s*([\d,]+(?:\.\d+)?)\s*(?:cr(?:ore)?s?|crore)",
            combined_text,
            re.IGNORECASE,
        )
        if net_worth_match:
            attrs["net_worth_inr_cr"] = float(net_worth_match.group(1).replace(",", ""))

        # Build chunks
        chunks: list[EvidenceChunkWire] = []
        for idx, page in enumerate(pages):
            content_lines = [
                f"Statutory Financial Audit Certificate ({request.file_name})",
                f"Evidence Document ID: {request.evidence_document_id}",
            ]
            if attrs.get("udin"):
                content_lines.append(f"Statutory UDIN: {attrs['udin']}")
            if attrs.get("ca_firm"):
                content_lines.append(f"Certified By: {attrs['ca_firm']}")
            if fy_turnovers:
                breakdown = ", ".join(f"{fy}: INR {val} Cr" for fy, val in fy_turnovers.items())
                content_lines.append(f"Annual Turnover Breakdown: {breakdown}")
                if attrs.get("average_turnover_inr_cr"):
                    content_lines.append(
                        f"3-Year Average Turnover: INR {attrs['average_turnover_inr_cr']} Crores"
                    )
            if attrs.get("net_worth_inr_cr"):
                content_lines.append(f"Net Worth: INR {attrs['net_worth_inr_cr']} Crores")

            # Append page text excerpt
            content_lines.append(f"Audited Statement Clause:\n{page.text.strip()[:1200]}")

            chunk_content = "\n".join(content_lines)
            chunks.append(
                EvidenceChunkWire(
                    chunk_id=f"chk_{request.evidence_document_id}_{idx}",
                    document_id=request.evidence_document_id,
                    file_name=request.file_name,
                    page_number=page.page_number,
                    chunk_type="FINANCIAL_TURNOVER",
                    content=chunk_content,
                    clause_reference=f"CA Turnover Audit (Page {page.page_number})",
                    metadata={
                        "udin": attrs.get("udin"),
                        "ca_firm": attrs.get("ca_firm"),
                        "average_turnover_cr": attrs.get("average_turnover_inr_cr"),
                        "turnover_by_fy": fy_turnovers,
                    },
                )
            )

        return attrs, chunks

    def _extract_experience_evidence(
        self,
        request: CompanyEvidenceExtractionRequest,
        pages: list[NormalizedPage],
        combined_text: str,
    ) -> tuple[dict[str, Any], list[EvidenceChunkWire]]:
        attrs: dict[str, Any] = {"evidence_category": "PROJECT_EXPERIENCE"}

        # 1. Authority / Client (e.g. NHAI, PWD, CPWD, Indian Railways, RVNL, etc.)
        client_match = re.search(
            r"\b(National Highways Authority of India|NHAI|Central Public Works Department|CPWD|Public Works Department|PWD|Indian Railways|RVNL|DFCCIL|MMRDA|CIDCO|MahaMetro|State Highway Authority)\b",
            combined_text,
            re.IGNORECASE,
        )
        if client_match:
            attrs["issuer"] = client_match.group(1).strip()
            attrs["client"] = attrs["issuer"]
            attrs["client_name"] = attrs["issuer"]

        # 2. Contract / Completed Value in INR Crores
        val_match = re.search(
            r"(?:completed\s+(?:contract\s+)?value|contract\s+value|final\s+value|work\s+cost|cost\s+of\s+work)[^.\n]*?(?:inr|rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\s*(?:cr(?:ore)?s?|crore)",
            combined_text,
            re.IGNORECASE,
        )
        if val_match:
            attrs["contract_value_inr_cr"] = float(val_match.group(1).replace(",", ""))

        # 3. Work Order / Agreement Reference Number
        wo_match = re.search(
            r"\b(?:agreement|contract|work\s*order|ca)\s*no\.?\s*[:\s]*([A-Za-z0-9/_–-]+)\b",
            combined_text,
            re.IGNORECASE,
        )
        if wo_match:
            attrs["reference_number"] = wo_match.group(1).strip()
            attrs["work_order_no"] = attrs["reference_number"]

        # 4. Project Name / Description
        proj_match = re.search(
            r"(?:name\s+of\s+work|project\s+name|scope\s+of\s+work)\s*[:\s]*([^\n.]+)",
            combined_text,
            re.IGNORECASE,
        )
        if proj_match:
            attrs["project_name"] = proj_match.group(1).strip()

        # 5. Completion Date
        date_match = re.search(
            r"(?:date\s+of\s+completion|completed\s+on|completion\s+date)\s*[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\w+\s+\d{4})",
            combined_text,
            re.IGNORECASE,
        )
        if date_match:
            attrs["completion_date"] = date_match.group(1).strip()

        chunks: list[EvidenceChunkWire] = []
        for idx, page in enumerate(pages):
            content_lines = [
                f"Project Experience & Completion Certificate ({request.file_name})",
                f"Evidence Document ID: {request.evidence_document_id}",
            ]
            if attrs.get("client_name"):
                content_lines.append(f"Client Authority: {attrs['client_name']}")
            if attrs.get("project_name"):
                content_lines.append(f"Project: {attrs['project_name']}")
            if attrs.get("contract_value_inr_cr"):
                content_lines.append(
                    f"Completed Contract Value: INR {attrs['contract_value_inr_cr']} Crores"
                )
            if attrs.get("reference_number"):
                content_lines.append(f"Agreement/WO Reference: {attrs['reference_number']}")
            if attrs.get("completion_date"):
                content_lines.append(f"Completion Date: {attrs['completion_date']}")

            content_lines.append(f"Certificate Details:\n{page.text.strip()[:1200]}")

            chunk_content = "\n".join(content_lines)
            chunks.append(
                EvidenceChunkWire(
                    chunk_id=f"chk_{request.evidence_document_id}_{idx}",
                    document_id=request.evidence_document_id,
                    file_name=request.file_name,
                    page_number=page.page_number,
                    chunk_type="PROJECT_EXPERIENCE",
                    content=chunk_content,
                    clause_reference=f"Project Completion Certificate (Page {page.page_number})",
                    metadata={
                        "client": attrs.get("client_name"),
                        "contract_value_cr": attrs.get("contract_value_inr_cr"),
                        "work_order_no": attrs.get("reference_number"),
                        "project_name": attrs.get("project_name"),
                    },
                )
            )

        return attrs, chunks

    def _extract_certification_evidence(
        self,
        request: CompanyEvidenceExtractionRequest,
        pages: list[NormalizedPage],
        combined_text: str,
    ) -> tuple[dict[str, Any], list[EvidenceChunkWire]]:
        attrs: dict[str, Any] = {"evidence_category": "CERTIFICATION"}

        # 1. ISO Standard
        iso_match = re.search(
            r"\b(ISO\s*(?:9001|14001|45001|27001|50001)(?::\d{4})?)\b",
            combined_text,
            re.IGNORECASE,
        )
        if iso_match:
            attrs["standard"] = iso_match.group(1).upper()

        # 2. Registrar / Issuer
        issuer_match = re.search(
            r"\b(Bureau Veritas|BSI|TUV\s*(?:SUD|Rheinland|Nord)?|DNV|SGS|Intertek|Lloyd's Register|NABCB)\b",
            combined_text,
            re.IGNORECASE,
        )
        if issuer_match:
            attrs["issuer"] = issuer_match.group(1).strip()

        # 3. Certificate Number
        cert_no_match = re.search(
            r"(?:certificate\s*(?:no\.?|number))\s*[:\s]*([A-Za-z0-9/._–-]+)",
            combined_text,
            re.IGNORECASE,
        )
        if cert_no_match:
            attrs["reference_number"] = cert_no_match.group(1).strip()
            attrs["certificate_number"] = attrs["reference_number"]

        # 4. Validity Date
        valid_to_match = re.search(
            r"(?:valid\s+(?:until|to|thru)|expiry\s+date|expiration\s+date)\s*[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\w+\s+\d{4})",
            combined_text,
            re.IGNORECASE,
        )
        if valid_to_match:
            attrs["valid_to"] = valid_to_match.group(1).strip()

        chunks: list[EvidenceChunkWire] = []
        for idx, page in enumerate(pages):
            content_lines = [
                f"Statutory Quality Accreditation Certificate ({request.file_name})",
                f"Evidence Document ID: {request.evidence_document_id}",
            ]
            if attrs.get("standard"):
                content_lines.append(f"Accreditation Standard: {attrs['standard']}")
            if attrs.get("issuer"):
                content_lines.append(f"Certification Registrar: {attrs['issuer']}")
            if attrs.get("reference_number"):
                content_lines.append(f"Certificate Number: {attrs['reference_number']}")
            if attrs.get("valid_to"):
                content_lines.append(f"Valid Until: {attrs['valid_to']}")

            content_lines.append(f"Accreditation Scope:\n{page.text.strip()[:1200]}")

            chunk_content = "\n".join(content_lines)
            chunks.append(
                EvidenceChunkWire(
                    chunk_id=f"chk_{request.evidence_document_id}_{idx}",
                    document_id=request.evidence_document_id,
                    file_name=request.file_name,
                    page_number=page.page_number,
                    chunk_type="CERTIFICATION",
                    content=chunk_content,
                    clause_reference=f"Accreditation Certificate (Page {page.page_number})",
                    metadata={
                        "standard": attrs.get("standard"),
                        "issuer": attrs.get("issuer"),
                        "certificate_number": attrs.get("reference_number"),
                        "valid_to": attrs.get("valid_to"),
                    },
                )
            )

        return attrs, chunks

    def _extract_registration_evidence(
        self,
        request: CompanyEvidenceExtractionRequest,
        pages: list[NormalizedPage],
        combined_text: str,
    ) -> tuple[dict[str, Any], list[EvidenceChunkWire]]:
        attrs: dict[str, Any] = {"evidence_category": "REGISTRATION"}

        # 1. GSTIN
        gstin_match = re.search(
            r"\b(\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b", combined_text
        )
        if gstin_match:
            attrs["gstin"] = gstin_match.group(1).upper()
            attrs["reference_number"] = attrs["gstin"]

        # 2. PAN
        pan_match = re.search(r"\b([A-Z]{5}\d{4}[A-Z]{1})\b", combined_text)
        if pan_match:
            attrs["pan"] = pan_match.group(1).upper()
            if "reference_number" not in attrs:
                attrs["reference_number"] = attrs["pan"]

        # 3. CIN
        cin_match = re.search(r"\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b", combined_text)
        if cin_match:
            attrs["cin"] = cin_match.group(1).upper()
            if "reference_number" not in attrs:
                attrs["reference_number"] = attrs["cin"]

        # 4. Udyam
        udyam_match = re.search(r"\b(UDYAM-[A-Z]{2}-\d{2}-\d{7})\b", combined_text, re.IGNORECASE)
        if udyam_match:
            attrs["udyam_registration"] = udyam_match.group(1).upper()
            if "reference_number" not in attrs:
                attrs["reference_number"] = attrs["udyam_registration"]

        chunks: list[EvidenceChunkWire] = []
        for idx, page in enumerate(pages):
            content_lines = [
                f"Statutory Registration Record ({request.file_name})",
                f"Evidence Document ID: {request.evidence_document_id}",
            ]
            for k in ("gstin", "pan", "cin", "udyam_registration"):
                if attrs.get(k):
                    content_lines.append(f"{k.upper()}: {attrs[k]}")

            content_lines.append(f"Registration Details:\n{page.text.strip()[:1200]}")

            chunk_content = "\n".join(content_lines)
            chunks.append(
                EvidenceChunkWire(
                    chunk_id=f"chk_{request.evidence_document_id}_{idx}",
                    document_id=request.evidence_document_id,
                    file_name=request.file_name,
                    page_number=page.page_number,
                    chunk_type="REGISTRATION",
                    content=chunk_content,
                    clause_reference=f"Statutory Registration (Page {page.page_number})",
                    metadata={k: attrs[k] for k in ("gstin", "pan", "cin") if k in attrs},
                )
            )

        return attrs, chunks

    def _extract_generic_evidence(
        self,
        request: CompanyEvidenceExtractionRequest,
        pages: list[NormalizedPage],
        combined_text: str,
    ) -> tuple[dict[str, Any], list[EvidenceChunkWire]]:
        attrs: dict[str, Any] = {"evidence_category": "GENERAL"}
        chunks: list[EvidenceChunkWire] = []

        for idx, page in enumerate(pages):
            chunk_content = (
                f"Company Evidence Document ({request.file_name})\n"
                f"Evidence Document ID: {request.evidence_document_id}\n"
                f"Page {page.page_number} Content:\n{page.text.strip()[:1200]}"
            )
            chunks.append(
                EvidenceChunkWire(
                    chunk_id=f"chk_{request.evidence_document_id}_{idx}",
                    document_id=request.evidence_document_id,
                    file_name=request.file_name,
                    page_number=page.page_number,
                    chunk_type="GENERAL",
                    content=chunk_content,
                    clause_reference=f"Document Page {page.page_number}",
                    metadata={"file_name": request.file_name},
                )
            )

        return attrs, chunks
