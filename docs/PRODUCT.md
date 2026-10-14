# Product Strategy & Definition: TenderPulse AI

**Version:** 2.0 — Bidder-Side Pivot (2026-10-04)
**Supersedes:** v1.0 (compliance-extraction-centric definition)
**Companion document:** `docs/CURRENT_STATE.md` (engineering audit of what exists today)

---

## 1. Product Vision

**TenderPulse AI is a Tender Intelligence & Bid Readiness Platform for Indian MSMEs, contractors, and service providers.**

The platform works for the **bidder**, not the procurement officer. It answers five questions that decide whether a contractor wins or loses money:

1. **Should I pursue this tender?** (Bid / No-Bid decision)
2. **What exactly does this tender require?** (Requirement extraction)
3. **Do we have the required evidence?** (Company evidence matching)
4. **What could cause rejection?** (Risk analysis)
5. **Are we ready to submit?** (Bid readiness)

### The pivot in one sentence

> v1.0 asked: _"What does this tender demand?"_
> v2.0 asks: _"What does this tender demand **of us specifically**, and can we prove it?"_

The single most important differentiator is the **persistent Company Capability Profile** — a reusable, structured, versioned record of the company's registrations, certifications, finances, experience, equipment, people, geography, and past bid evidence. Every new tender is evaluated **against this profile**, so qualification work done once is reused across every future bid.

---

## 2. Market Context (unchanged from v1.0 — still valid)

- Indian public procurement: **₹5–10 Lakh Crore/year** across GeM, CPPP, state portals (MahaTenders, Karnataka eProc), IREPS (Railways), MES, CPWD, and PSU portals.
- **Two-packet system**: disqualification in Packet 1 (technical) means Packet 2 (financial) is **never opened**. An estimated **15–30% of bids are rejected at the technical stage** on procedural defects — wrong stamp paper denomination, missing ICAI UDIN, wrong signing authority rank, a corrigendum missed 36 hours before closure.
- **Cost of a disqualification**: ₹25,000–75,000 sunk preparation cost, EMD (1–3% of tender value) frozen for 60–120 days, and 5–10 lost engineering days.
- **Buying criterion remains ROI**: preventing one technical disqualification per quarter pays for the subscription many times over.

---

## 3. The Core User Questions → Product Stages

The product workflow is an 11-stage pipeline. Each stage maps to one user question:

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. Tender Discovery          (What's out there?)                   │
│ 2. Tender-to-Company Matching (Is this ours to win?)               │
│ 3. Bid/No-Bid Decision       → Q1: Should I pursue this tender?    │
│ 4. Requirement Extraction    → Q2: What exactly is required?       │
│ 5. Company Evidence Matching → Q3: Do we have the evidence?        │
│ 6. Compliance Analysis       (Gap register)                        │
│ 7. Risk Analysis             → Q4: What could cause rejection?     │
│ 8. Missing Evidence          (Acquisition list)                    │
│ 9. Human Review              (AI proposes, human confirms)         │
│ 10. Bid Readiness            → Q5: Are we ready to submit?         │
│ 11. Submission Preparation   (Packet 1 pack assembly)              │
│ ─────────────────────────────────────────────────────────────────── │
│ 12. Corrigendum / Requirement Change Monitoring (continuous)       │
└──────────────────────────────────────────────────────────────────────┘
```

### Stage-by-stage product definition

| #   | Stage                          | What the system does                                                                                                                                                                                                                                                           | Deterministic vs AI                                                                                     |
| :-- | :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| 1   | **Tender Discovery**           | User registers a tender opportunity (manual upload of NIT/RFP package, or paste portal metadata: tender number, authority, est. value, deadline, EMD, fee). Optional saved searches of user-maintained watchlists.                                                             | Manual by design (anti-scope: no scraping). NIT metadata extraction is AI-assisted.                     |
| 2   | **Tender-to-Company Matching** | Extracted eligibility criteria are matched against the Company Capability Profile (turnover vs. threshold, experience vs. similar-work requirement, certifications, geography, OEM empanelment). Produces a **Match Scorecard**.                                               | Deterministic threshold arithmetic. AI only structures the criteria; **math is never done by the LLM**. |
| 3   | **Bid/No-Bid Decision**        | Go / Conditional-Go / No-Go recommendation with reasons: hard eligibility failures (INELIGIBLE), conditional gaps (missing certificate, expired document), commercial attractiveness (EMD lockup vs. liquidity, LD exposure). Decision and rationale are stored on the tender. | Deterministic rules + human final call.                                                                 |
| 4   | **Requirement Extraction**     | Full Packet-1 requirement register: annexures, declarations, affidavits, certificates — each with execution rules (stamp paper ₹, notarization, UDIN, signing rank) and **verbatim provenance** (file, page, clause, quote).                                                   | AI extraction + deterministic grounding verification.                                                   |
| 5   | **Company Evidence Matching**  | Each requirement is matched to an asset in the company's Evidence Vault (e.g., "CA Turnover Certificate FY24-25 with UDIN"). Match states: `MATCHED` / `EXPIRED` / `PARTIAL` / `MISSING` / `NOT_APPLICABLE`.                                                                   | Deterministic attribute matching + expiry-date comparison.                                              |
| 6   | **Compliance Analysis**        | Consolidated gap register: requirement ↔ evidence ↔ status, with per-item execution rules and provenance. This replaces v1.0's "compliance matrix" but is now **bidder-centric**: every row answers "what must we produce, and do we have it?"                                 | Deterministic state machine.                                                                            |
| 7   | **Risk Analysis**              | Commercial trap radar: LD %/day and cap, DLP length, PBG %, payment milestones/retention, bid validity vs. EMD lockup, unusually aggressive SCC clauses — each cited verbatim with a severity rating.                                                                          | AI surfaces + classifies; deterministic severity rules.                                                 |
| 8   | **Missing Evidence**           | Prioritized acquisition list: what must be obtained (new stamp paper, notary, UDIN, board resolution, OEM letter), owner, and deadline countdown.                                                                                                                              | Deterministic scheduling.                                                                               |
| 9   | **Human Review**               | Every AI-proposed requirement, match, and risk is confirmed, edited, or waived by the Bid Manager. Immutable record of who approved what.                                                                                                                                      | Human-in-the-loop (4-tier decision matrix, `docs/HUMAN_REVIEW.md`).                                     |
| 10  | **Bid Readiness**              | Readiness score: % of requirements evidence-complete, open risks, days-to-deadline, EMD availability check. Explicit `READY_TO_SUBMIT` gate requires human sign-off.                                                                                                           | Deterministic rollup + human gate.                                                                      |
| 11  | **Submission Preparation**     | Exportable, audit-ready Packet-1 preparation pack (PDF/Excel): checklist with checkboxes, owners, citations, evidence references. **No auto-submission, no DSC handling.**                                                                                                     | Deterministic rendering.                                                                                |
| 12  | **Corrigendum Monitoring**     | When a corrigendum is uploaded (or requirement changes are detected), the system diffs requirements, re-runs matching against the Company Profile, and alerts on new/changed requirements that affect the bid decision.                                                        | Deterministic diff + re-evaluation.                                                                     |

---

## 4. The Company Capability Profile (the differentiator)

The persistent, reusable core of the product. Maintained once, enriched over time, and evaluated against every new tender. Owned by the tenant organization; versioned; fully auditable.

### 4.1 Profile sections

| Section                     | Structured data examples                                                                                                     |
| :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| **Registrations**           | Udyam (MSME) registration, GSTIN, PAN, Shops & Establishments, ISO, NSIC, PF/ESI, professional body memberships              |
| **Certifications**          | ISO 9001/14001/45001, CMMI, LEED, industry-specific certs — with **issuer, number, issue/expiry dates**                      |
| **Financial information**   | Audited turnover (FY-wise), net worth, working capital, bank solvency/limit letters, CA certificates (with **UDIN**)         |
| **Experience / Projects**   | Completed & ongoing works: scope, value, client, location, completion certificate, reference contact                         |
| **Work orders**             | Framed work orders, supply orders — value, period, issuing authority                                                         |
| **Completion certificates** | Certificates issued by client engineers (with **signing authority rank**: AE/EE/SE) — the single most common Packet-1 defect |
| **OEM relationships**       | OEM authorizations, dealer/distributor agreements, letters of intent, partnership certificates                               |
| **Employees**               | Key personnel: qualifications, experience, roles (project manager, safety officer), certificates                             |
| **Equipment**               | Owned/leased plant & machinery with capacity specs (required for "essential plant undertaking" clauses)                      |
| **Geographic presence**     | Offices, project sites, service regions, regional registration (state-specific eligibility)                                  |
| **Previous bid evidence**   | Past bid outcomes (won/lost/withdrawn), disqualification reasons, EMD lockup history — feeds learning and risk scoring       |

### 4.2 Product properties

1. **Persistent & reusable** — captured once; every tender evaluation reuses it. The profile is the reason a 10th tender is faster than the 1st.
2. **Evidence-backed** — every profile attribute links to a stored source document (certificate PDF, CA letter) with expiry tracking.
3. **Deterministic evaluation** — tender threshold vs. profile value is pure arithmetic (e.g., _required avg. turnover ₹4.5 Cr; profile FY23–25 avg. ₹4.2 Cr → shortfall ₹30 L → INELIGIBLE_). The LLM never computes money.
4. **Versioned & auditable** — profile changes are logged; bid decisions are reproducible against the profile version used at decision time.
5. **Confidential** — the profile is the company's crown jewels; tenant isolation and access control are first-class (see `docs/SECURITY_MODEL.md`).

---

## 5. Architectural Principles (carried forward, extended)

The v1.0 ironclad philosophy stands and is extended by the profile:

1. **Source of truth is deterministic code.** Authorization, profile arithmetic, state machines, eligibility math, expiry checks — pure, testable functions.
2. **Every AI claim has a proof token.** No requirement or risk is stated without file name, page number, and verbatim quote.
3. **AI proposes, human confirms.** The AI drafts the requirement register, matches, and risks; the Bid Manager approves. Immutable audit trail of who confirmed what.
4. **Zero AI financial math.** Turnover shortfalls, EMD affordability, LD exposure arithmetic — deterministic only.
5. **NEW — The Company Profile is an aggregate, not a document.** It is queryable structured data with evidence links, so matching is exact, reproducible, and testable — not another pile of PDFs.

---

## 6. Existing Capability → New Product Role (explicit mapping)

Everything below exists in the repository today (see `docs/CURRENT_STATE.md`). **Nothing is thrown away**; the pivot re-centers the product around the Company Profile and adds the decision/matching/risk/readiness stages.

### 6.1 Existing features that remain valuable (KEEP)

| Existing capability                                                                                                                                                       | New product role                                                                                                                                          |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presigned direct upload (GCS/S3) + confirm handshake                                                                                                                      | Tender package ingestion **and** Evidence Vault ingestion (same port, two uses)                                                                           |
| PDF text extraction (`DocumentContentNormalizer`, multi-zone page selection for 200+ page tenders)                                                                        | Tender document parsing (Stage 4 input)                                                                                                                   |
| 16-domain Indian procurement taxonomy extraction (EMD, PBG, turnover, PoA, JV, experience, personnel, plant, validity, LD, DLP, integrity pact, Make-in-India, GSTIN/PAN) | Requirement Extraction (Stage 4) — **extended** to capture eligibility _thresholds_ (turnover value, work-order count, solvency limit) that feed matching |
| Execution rules (stamp paper ₹, notarization, UDIN, signing rank)                                                                                                         | Compliance Analysis (Stage 6) and Submission Preparation (Stage 11)                                                                                       |
| Verbatim provenance + 100% grounding verification                                                                                                                         | Core invariant across all AI surfaces — the product's trust foundation                                                                                    |
| Multi-page dedup + most-restrictive rule fusion                                                                                                                           | Requirement consolidation (Stage 4)                                                                                                                       |
| Human review lifecycle (READY/FLAGGED/WAIVED, optimistic concurrency, LangGraph interrupt/resume)                                                                         | Human Review (Stage 9)                                                                                                                                    |
| `ComplianceItem` aggregate + status state machine                                                                                                                         | Gap register entity (Stage 6) — **adapted** to carry evidence-match state                                                                                 |
| `IngestionJob` aggregate, async pipeline design, SQS/PubSub adapters, DLQ, leases, retries                                                                                | Processing backbone (Stages 2, 4, 12)                                                                                                                     |
| Domain events + `InMemoryEventBus` + audit logging                                                                                                                        | Decision audit, corrigendum change notifications (Stage 12)                                                                                               |
| Two-phase cascade deletion + storage prefix pruning                                                                                                                       | Data hygiene, right-to-erasure for tenant data                                                                                                            |
| RBAC permission matrix + `TenantContextHolder` (AsyncLocalStorage)                                                                                                        | Multi-user MSME teams; reviewer/approver separation                                                                                                       |
| AI security tooling (secret scrubber, injection neutralization, scoped retrieval, network guard)                                                                          | All AI stages — unchanged                                                                                                                                 |
| AI evaluation framework (12-dimension scorecard, regression gates in CI)                                                                                                  | Quality gate for extraction & matching models                                                                                                             |
| React SPA (login, dashboard, uploader, SSE progress, audit timeline)                                                                                                      | Frontend shell — **extended** with Match Scorecard, Readiness, and Profile screens                                                                        |
| Terraform modules (AWS + GCP), docker-compose, CI quality gates                                                                                                           | Delivery infrastructure — unchanged                                                                                                                       |

### 6.2 Features that must be ADAPTED

| Existing feature                               | Adaptation required                                                                                                                                         |
| :--------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BidProject` aggregate (tender-centric record) | Becomes **TenderOpportunity** (discovery metadata + decision) + **BidCase** (active pursuit). Decision fields (go/no-go, rationale, profile version) added. |
| Compliance matrix UI (tender-only rows)        | Re-centered: each row shows requirement ↔ profile attribute ↔ evidence asset ↔ match state.                                                                 |
| SSE extraction progress                        | Extended to job types: extraction, matching, corrigendum re-evaluation.                                                                                     |
| Hardcoded single-tenant demo data              | Replaced by multi-tenant organizations + per-tenant Company Profiles (see audit P0).                                                                        |
| Keyword-based extraction (regex)               | Retained as the deterministic baseline; eligibility-threshold extraction added; LLM adapter optional behind the same contract.                              |

### 6.3 Capabilities that are NEW (currently missing — the pivot's core)

1. **Company Capability Profile** — aggregate, sections per §4.1, evidence links, versioning. _(The differentiator.)_
2. **Evidence Vault** — company document repository with expiry tracking and attribute linkage.
3. **Tender-to-Company Matching engine** — deterministic eligibility evaluation producing a Match Scorecard.
4. **Bid/No-Bid decision record** — go/conditional/no-go with stored rationale.
5. **Risk Analysis** — commercial trap radar with severity and EMD-liquidity check.
6. **Missing Evidence acquisition list** — prioritized, owned, deadline-driven.
7. **Bid Readiness score + sign-off gate.**
8. **Corrigendum diff + requirement-change re-evaluation.**
9. **Submission Preparation export** (PDF/Excel Packet-1 pack).

### 6.4 What is explicitly de-emphasized

- The "procurement-officer verification system" framing of v1.0. The platform never verifies bids for authorities; it prepares bids for bidders.
- Tender-side analytics for buyers (never in scope).

---

## 7. MVP Scope (Phase 1) vs. Future

| Area                   | MVP (Phase 1)                                                                        | Post-MVP                                                                            |
| :--------------------- | :----------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| Tender Discovery       | Manual package upload + NIT metadata extraction                                      | Watchlists, saved searches, portal feed integrations (no scraping)                  |
| Company Profile        | All §4.1 sections, manual entry + document upload, expiry tracking                   | Auto-enrichment from past bid history, team collaboration on profile                |
| Matching               | Deterministic eligibility matching (turnover, experience, certifications, geography) | Semantic matching of scope-of-work descriptions, win-probability modeling           |
| Bid/No-Bid             | Go/Conditional/No-Go with hard-failure reasons + rationale storage                   | Portfolio optimization across simultaneous tenders                                  |
| Requirement Extraction | 16-domain taxonomy + thresholds, verbatim grounding                                  | OCR for scanned PDFs, section/layout segmentation                                   |
| Evidence Matching      | Attribute + expiry matching, MATCHED/EXPIRED/PARTIAL/MISSING states                  | Semantic diff of past experience certificates vs. required scope                    |
| Risk Analysis          | LD, DLP, PBG, payment terms, bid validity, EMD lockup                                | Subcontractor quote comparison, price-variation clause modeling                     |
| Corrigendum            | Manual corrigendum upload → requirement diff → re-match                              | Automated change alerts via portal polling (where legally permissible)              |
| Submission Prep        | PDF/Excel Packet-1 pack with citations                                               | Assisted drafting of annexures (Phase 2), DSC workflow guidance (no token handling) |

### Anti-scope (unchanged, reinforced)

1. **No automated bid submission / bot upload** on GeM/CPPP with user DSC tokens.
2. **No portal scraping or captcha bypass** — contractors download official packages and upload them.
3. **No BOQ pricing / bid-price prediction** — legal and commercial trap.
4. **No legal guarantee** — decision support only; human sign-off is mandatory before submission.

---

## 8. Success Criteria

1. **Decision quality**: ≥95% of hard eligibility failures correctly flagged on benchmark tenders (false-negative rate ≈ 0 — missing an INELIGIBLE signal is the worst outcome).
2. **Grounding**: 100% of extracted requirements and risks carry verbatim citation.
3. **Reuse**: the 5th+ tender in a quarter requires <50% of the profile-entry effort of the 1st (profile reuse is measurable).
4. **Speed**: 150-page package → Match Scorecard + requirement register in <3 minutes.
5. **Zero cross-tenant leakage** of Company Profiles (the most sensitive data in the system).

---

## 9. Implications for the Domain Model (design language, not code)

The pivot introduces first-class concepts the current schema lacks (currently `users`, `bids`, `tender_documents`, `compliance_items`, `audit_logs`):

- **CompanyProfile** (tenant-owned aggregate) → **ProfileSection** → **CapabilityEntry** (registrations, certifications, financials, experience, work orders, completion certificates, OEM, employees, equipment, geography) → **EvidenceAsset** (stored document + validity window).
- **TenderOpportunity** (discovery metadata + source package) → **BidDecision** (go/conditional/no-go, rationale, profile version used).
- **Requirement** (extracted, grounded) → **EvidenceMatch** (requirement ↔ capability/evidence, match state) → **GapItem**.
- **RiskFinding** (commercial trap, severity, citation) → **ReadinessAssessment** (score, open items, sign-off).
- **CorrigendumEvent** → requirement diff → re-evaluation chain.

Existing aggregates (`TenderDocument`, `IngestionJob`, `ComplianceItem`→`Requirement`, `AuditLog`, domain events) map cleanly onto this model — see §6. The next phase (design, not implementation) should produce the updated LLD and ADRs for the Company Profile and Matching engine.

---

## 10. Decision Summary

- **WHY the pivot:** v1.0 answered one question ("what does the tender require?") with a checklist. The bidder's real cost is disqualification, and disqualification is prevented by knowing whether _we specifically_ can prove _what this tender demands_. The persistent Company Capability Profile is the moat: it compounds in value with every bid, which a checklist cannot.
- **WHAT changes:** product center of gravity moves from tender → requirement, to company profile → tender match → decision → readiness.
- **HOW:** reuse the ingestion, extraction, grounding, review, async, security, and delivery foundations wholesale; add Profile, Matching, Decision, Risk, Evidence, Readiness, and Corrigendum stages.
- **WHY NOT build the profile later:** without it, every bid re-enters company data from scratch, matching is impossible, and the product is a feature (checklist) rather than a platform.
- **TRADE-OFFS:** profile maintenance is real user work; mitigated by evidence-linked entry, expiry tracking, and measurable reuse. Deterministic matching is less "intelligent" than semantic matching but is auditable, testable, and legally defensible — the correct default for government compliance.
- **FAILURE MODES:** stale profile data → false GO decisions (mitigated by expiry tracking and decision-time profile versioning); over-confident matching (mitigated by hard-fail determinism + human confirmation gate).

_Stop point reached: product direction only. No features implemented, per PROMPT 1._
