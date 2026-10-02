# Minimum Viable Product (MVP) Specification: TenderPulse AI

## 1. MVP Objective & Philosophy

The objective of the TenderPulse AI MVP is to deliver **the thinnest vertical slice of software that reliably protects an Indian government contractor from Packet 1 (Technical Bid) disqualification.**

### The MVP North Star

> _"A Bid Manager can upload a 150-page Indian government tender PDF and receive, in under 3 minutes, an auditable, cited compliance checklist of every required document, stamp paper value, signing authority, and financial threshold—with zero hallucinations."_

---

## 2. End-to-End User Journey (MVP)

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 1. Upload       │       │ 2. Process      │       │ 3. Review       │
│ Tender Package  │ ────> │ Asynchronously  │ ────> │ Compliance      │
│ (NIT / RFP PDF) │       │ (OCR & Parsing) │       │ Dashboard       │
└─────────────────┘       └─────────────────┘       └────────┬────────┘
                                                             │
┌─────────────────┐       ┌─────────────────┐                │
│ 5. Export       │       │ 4. Match        │                │
│ Compliance Pack │ <──── │ Evidence / Docs │ <──────────────┘
│ (PDF / Excel)   │       │ (Gap Detection) │
└─────────────────┘       └─────────────────┘
```

### Step 1: Upload Tender Package

- User creates a new **Bid Project** (e.g., _"PWD Road Project - NIT 42"_).
- User uploads the tender documents (NIT, Standard Bidding Document, Corrigenda) as PDF files (up to 50MB per file, up to 300 pages total).

### Step 2: Asynchronous Ingestion & Document Processing

- Background worker extracts text via digital PDF extraction (PyMuPDF/pdfplumber) with OCR fallback (Tesseract/AWS Textract) for scanned notices.
- Text is normalized, segmented into logical sections (Eligibility, General Conditions, Special Conditions, Annexures), and indexed with exact page coordinates.

### Step 3: Compliance & Eligibility Extraction

- The system extracts:
  1. **Eligibility Thresholds**: Annual turnover, similar work criteria (3-2-1 rule), solvency requirement, net worth.
  2. **Document Checklist**: Complete list of annexures, affidavits, declarations, and certificates.
  3. **Execution Rules**: Specific stamp paper denomination (e.g., ₹100), notarization mandate, ICAI UDIN requirement, signing authority rank.
  4. **Risk Radar**: Liquidated damages percentage, Defect Liability Period (DLP), PBG percentage, bid validity days.
- **Mandatory Requirement**: Every single extracted item must include:
  - Source file name
  - Source page number
  - Verbatim excerpt from the document

### Step 4: Interactive Review & Document Mapping

- User reviews the extracted compliance items in a clean, categorized table:
  - **Required Documents & Formats** (Annexures I–X, Declarations)
  - **Financial Criteria** (Turnover, Solvency, Balance Sheets)
  - **Statutory & Registrations** (GSTIN, PAN, EPF, ESIC, UDIN)
  - **Commercial Risks** (Liquidated Damages, PBG, Warranty)
- User can toggle item status: `Pending`, `Ready`, `Waived (with note)`, or `Flagged`.
- User can associate stored master documents (e.g., _"Upload GST Certificate"_ or _"Select FY 2024-25 CA Certificate"_) against checklist items.

### Step 5: Export Compliance Pack

- One-click export of an **Audit-Ready Bid Preparation Checklist** (PDF and Excel format) containing:
  - Summary of tender details and deadlines
  - Complete checklist with check-boxes, assigned owners, and notes
  - Exact verbatim citations and page references from the original tender

---

## 3. System Architecture & Boundaries: AI vs. Deterministic

To guarantee software reliability, we strictly demarcate responsibilities between AI models and deterministic application code:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TenderPulse AI Platform                         │
├───────────────────────────────────┬────────────────────────────────────┤
│ Deterministic Boundaries (NestJS) │ AI Intelligence Boundary (FastAPI) │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Multi-tenant user auth & RBAC   │ • Document segmentation & layout   │
│ • S3 durable file storage         │ • Semantic clause identification   │
│ • PostgreSQL database of truth    │ • Structured JSON extraction       │
│ • State machine & job queues      │ • Evidence vs clause matching      │
│ • Turnover & threshold arithmetic │ • Direct verbatim quote extraction │
│ • Document expiry date comparison │ • Risk clause summarization        │
│ • Audit trails & immutable logs   │                                    │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Deterministic Code Handles:

- **Financial Comparisons**: If the tender asks for ₹4.5 Crore turnover and contractor has ₹4.2 Crore, pure deterministic math flags `INELIGIBLE: Shortfall of ₹30 Lakhs`. An LLM is **never** asked to calculate arithmetic differences.
- **Date Validations**: Comparing solvency certificate issue date against tender deadline is handled by standard ISO timestamp comparison.
- **State Transitions**: Bid state (`Draft` $\rightarrow$ `Extracting` $\rightarrow$ `Review` $\rightarrow$ `Ready`) is enforced by a PostgreSQL transactional state machine.

### AI Engine Handles:

- **Unstructured Extraction**: Converting messy bureaucratic legalese into structured JSON schemas.
- **Semantic Mapping**: Recognizing that _"Undertaking regarding non-blacklisting"_ and _"Debarment Declaration as per Annexure-IV"_ refer to the same statutory requirement.
- **Quote Extraction**: Isolating the exact clause sentence and page number for human verification.

---

## 4. MVP Data Schema: Compliance Item Contract

Every extracted compliance requirement follows a strict schema to prevent hallucinated or ungrounded data:

```json
{
  "item_id": "req_01h8x9p",
  "category": "ANNEXURE_DECLARATION",
  "title": "Affidavit of Non-Blacklisting",
  "description": "Declaration stating bidder has not been blacklisted or debarred by Central/State Govt or PSUs.",
  "execution_rules": {
    "stamp_paper_required": true,
    "stamp_paper_denomination_inr": 100,
    "notarization_required": true,
    "signing_authority": "Authorized Signatory with Board Resolution / PoA",
    "udin_required": false
  },
  "provenance": {
    "source_file": "NIT_Volume_1.pdf",
    "page_number": 42,
    "clause_reference": "Section 3, Clause 14.2(b)",
    "verbatim_quote": "The bidder shall submit an affidavit on non-judicial stamp paper of minimum Rs. 100/- duly notarized by a public notary affirming that the firm has never been blacklisted..."
  },
  "status": "PENDING",
  "verified_by_user": false
}
```

---

## 5. Scope: In-Scope vs. Explicit Anti-Scope for MVP

### In-Scope for MVP:

1. **Multi-Tenant User Management**: User registration, tenant isolation (Org ID), basic role assignment (`Admin`, `Bid Manager`).
2. **File Ingestion Pipeline**: Direct PDF upload to S3, asynchronous processing job dispatched via worker queue.
3. **Deterministic Text Extraction & OCR Fallback**: Support for text-based and scanned Indian tender PDFs.
4. **Structured Compliance Extractor**: Extraction of eligibility criteria, document checklist, stamp paper rules, and risk flags with citations.
5. **Interactive Compliance Matrix UI**: Table view with direct links to preview PDF pages side-by-side with extracted requirements.
6. **Master Document Vault (Basic)**: Tenant repository to store company PAN, GSTIN, Udyam certificate, standard declarations, and past work orders.
7. **Audit-Ready Export**: PDF/Excel export of the compliance matrix for internal management sign-off.

### Explicitly Excluded from MVP (Anti-Scope):

1. **No Portal Automation**: No auto-login, captcha cracking, or auto-submission on GeM/CPPP.
2. **No Hardware Token Integration**: No direct interaction with physical USB Class-3 DSC tokens.
3. **No Financial Bid / BOQ Calculation**: No unit pricing suggestions, no margin recommendations, no cost estimation.
4. **No Full Document Generation**: We will not automatically draft 50 pages of tender responses in MVP. We extract the requirements and checklists; drafting tools can follow in Phase 2.
5. **No Automated Live Scraping**: Users manually download and upload tender documents.

---

## 6. Success Criteria & Acceptance Metrics

The MVP will be considered successful and production-ready when:

1. **Precision of Extraction**: $\ge 95\%$ of all mandatory Packet 1 submission items and annexures are identified on benchmark Indian government tenders (CPPP & GeM).
2. **Zero Ungrounded Claims**: $100\%$ of extracted compliance items link to a valid source page number and verbatim excerpt.
3. **Processing Speed**: A 150-page tender package is processed and ready for user review in under 3 minutes.
4. **Zero Cross-Tenant Leakage**: Complete isolation of contractor bids and proprietary documents across tenants.
