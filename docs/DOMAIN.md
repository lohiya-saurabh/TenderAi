# Domain Knowledge: Indian Government Public Procurement

## 1. Legal and Regulatory Framework

Public procurement in India is not governed by a single overarching procurement act at the central level. Instead, it is governed by an interlocking system of statutory rules, ministerial manuals, and vigilance oversight:

1. **General Financial Rules (GFR), 2017**:
   Issued by the Ministry of Finance (Department of Expenditure). GFR Rules 144 to 175 establish the core principles of public procurement: transparency, fairness, competition, and value for money.
2. **Manuals for Procurement (Goods, Works, Consultancy & Other Services)**:
   Published by the Ministry of Finance, providing step-by-step procedures for government departments and Public Sector Undertakings (PSUs).
3. **Central Vigilance Commission (CVC) Guidelines**:
   Anti-corruption and fair-play directives. Mandates absolute transparency, forbids post-tender negotiations (except under narrow circumstances with L1), and enforces strict rejection rules for non-conforming bids.
4. **Public Procurement (Preference to Make in India) Order (PPP-MII), 2017**:
   Mandates local content percentages to favor domestic manufacturers (Class I: $\ge 50\%$ local content; Class II: $20\%-50\%$; Non-local: $< 20\%$).
5. **Micro, Small and Medium Enterprises Development (MSMED) Act, 2006 & Public Procurement Policy for MSEs Order, 2012**:
   Provides benefits to registered MSEs (Udyam Registration), including exemption from Tender Fees and Earnest Money Deposit (EMD), and price purchase preference policies.

---

## 2. Institutional Procurement Portals

Government tenders in India are published across multiple national and state digital portals:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Indian Public Procurement Portals                    │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ Central Portals   │ State Portals     │ Specialized Department Portals │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ • GeM             │ • MahaTenders     │ • IREPS (Indian Railways)      │
│   (Govt e-Market) │ • Karnataka eProc │ • MES (Military Engineer Serv.)│
│ • CPPP            │ • WB Tenders      │ • CPWD e-Tenders               │
│   (eProcure.gov)  │ • Tamil Nadu eProc│ • IOCL / ONGC / NTPC Portals   │
└───────────────────┴───────────────────┴────────────────────────────────┘
```

1. **GeM (Government e-Marketplace - gem.gov.in)**:
   - A specialized Special Purpose Vehicle (SPV) under the Ministry of Commerce.
   - Mandatory for all Central Ministries, Departments, and Central Public Sector Enterprises (CPSEs) for purchasing common-use goods and services.
   - Highly standardized digital workflows, dynamic price discovery, reverse auctions, and custom bid modules.
2. **CPPP (Central Public Procurement Portal - eprocure.gov.in)**:
   - Operated by the National Informatics Centre (NIC).
   - Used for high-value tenders, civil works, infrastructure EPC (Engineering, Procurement, Construction), defense procurement, and multi-stage projects.
   - Typically hosts large Standard Bidding Documents (SBD) packaged as zip files containing multiple dense PDF documents and password-protected Excel BOQ sheets.
3. **State e-Procurement Portals (NIC instances)**:
   - State-specific variants of the NIC eProcure engine (e.g., `mahatenders.gov.in`, `wbtenders.gov.in`).
   - Heavily utilized by Public Works Departments (PWD), Water Resources (WRD), Irrigation, Municipal Corporations, and State Discoms (Electricity Boards).

---

## 3. Anatomy of a Tender Package

When a contractor downloads a tender, they do not receive a clean, organized manual. They typically download a `.zip` archive containing multiple disparate documents totaling 100 to 500+ pages:

```
Tender_Package_NIT_84_2026.zip
├── 01_NIT_Summary.pdf               (~5-15 pages: Deadlines, EMD, Tender Fee, Pre-bid meeting)
├── 02_RFP_Standard_Bidding_Doc.pdf  (~80-200 pages: Eligibility, Evaluation, Annexure formats)
├── 03_GCC_General_Conditions.pdf    (~50-100 pages: Standard legal clauses, boilerplate)
├── 04_SCC_Special_Conditions.pdf    (~20-50 pages: Project-specific penalties, payment terms)
├── 05_Technical_Specifications.pdf  (~50-200 pages: Engineering specs, drawings, BOM)
├── 06_BOQ_Financial_Schedule.xls    (Protected spreadsheet: Item-rate or Percentage-rate)
└── Corrigenda/ (Released later)
    ├── Corrigendum_No_1.pdf         (Clarifications from pre-bid meeting)
    └── Corrigendum_No_2.pdf         (Extension of submission deadline & revised criteria)
```

### Breakdown of Sections:

1. **Notice Inviting Tender (NIT)**:
   The legal announcement. Summarizes estimated cost, bid validity period (e.g., 90 to 180 days), earnest money deposit, tender document fee, dates for pre-bid queries, and closing submission deadlines.
2. **General Conditions of Contract (GCC)**:
   Standard contract language used repeatedly by the department (e.g., CPWD GCC Form 7/8). Contains standard arbitration, force majeure, termination, and payment delay clauses.
3. **Special Conditions of Contract (SCC)**:
   **The highest risk section.** The SCC overrides the GCC. If the GCC allows a 30-day grace period for milestone completion, but the SCC specifies liquidated damages starting on Day 1, the SCC takes legal precedence.
4. **Bill of Quantities (BOQ)**:
   The commercial financial template. In CPPP, this is a macro-enabled, locked Microsoft Excel sheet (`.xls`). Bidders can only type their rates or percentage markup in specified green/white unlocked cells.
5. **Corrigenda / Addenda**:
   Amendments published by the tendering authority after releasing the initial tender. Often published only a few days or hours before bid closing. **Missing a corrigendum is one of the leading causes of technical disqualification.**

---

## 4. The Two-Packet Bidding Lifecycle

Government procurement mandates a strict separation between technical qualification and commercial pricing to eliminate corruption and favoritism:

```
                           ┌────────────────────────┐
                           │ Contractor Submits Bid │
                           └───────────┬────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
     ┌───────────────────────┐                     ┌─────────────────────┐
     │ Packet 1: Technical   │                     │ Packet 2: Financial │
     │ & Pre-Qualification   │                     │ Envelope (BOQ)      │
     └──────────┬────────────┘                     └──────────┬──────────┘
                │                                             │
      Evaluated by Tender Committee                           │ (Locked & Encrypted)
                │                                             │
        ┌───────┴───────┐                                     │
        ▼               ▼                                     │
   [ Qualified ]   [ REJECTED ]                               │
        │               │                                     │
        │               └──> Packet 2 is NEVER OPENED! ───────┘
        │                    (Bidder eliminated from tender)
        ▼
   Packet 2 Opened
   (L1 / Lowest Evaluated Bidder Determined)
        │
        ▼
   Contract Awarded
```

### Why Packet 1 Compliance is Life or Death

If a contractor bids ₹4.0 Crore on a project where competitors bid ₹4.8 Crore, but forgets to attach an affidavit on a ₹100 stamp paper in Packet 1:

1. The Tender Evaluation Committee marks the bidder **"Technically Non-Responsive"**.
2. Packet 2 is never opened or decrypted.
3. The client awards the contract to the higher-priced competitor.
4. The contractor loses the deal, wastes weeks of work, and forfeits their preparation expenses.

---

## 5. Domain Terminology Glossary

| Term                              | Full Name                             | Definition & Business Meaning                                                                                                                                                                                  |
| :-------------------------------- | :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NIT**                           | Notice Inviting Tender                | The formal notice announcing the tender, key milestones, values, and primary requirements.                                                                                                                     |
| **EMD**                           | Earnest Money Deposit (Bid Security)  | A cash deposit, Bank Guarantee, or FDR (typically 1%–3% of estimated cost) pledged to ensure the bidder does not withdraw or alter their bid during the validity period.                                       |
| **PBG / ePBG**                    | Performance Bank Guarantee            | A bank guarantee (typically 3%–10% of contract value) furnished by the winning bidder to guarantee contract execution and performance.                                                                         |
| **BOQ**                           | Bill of Quantities                    | The standardized schedule of items, quantities, and rates forming the financial bid.                                                                                                                           |
| **Two-Cover System**              | Two-Packet / Two-Envelope             | Submission architecture where Technical/Pre-qualification documents (Cover 1) are evaluated independently prior to opening financial pricing (Cover 2).                                                        |
| **Corrigendum**                   | Amendment / Addendum                  | Official addendum modifying the original tender terms, criteria, quantities, or deadlines.                                                                                                                     |
| **L1**                            | Lowest Bidder                         | The lowest compliant financial bidder in cost-based selection. In India, most tenders are awarded strictly to L1 among technically qualified bidders.                                                          |
| **QCBS**                          | Quality and Cost Based Selection      | Evaluation method combining technical score (e.g., 70% weight) and financial score (e.g., 30% weight), common in consulting and complex IT bids.                                                               |
| **UDIN**                          | Unique Document Identification Number | An 18-digit unique number generated on the ICAI portal by practicing Chartered Accountants for every certificate/audit report. **A CA certificate without a valid UDIN is treated as unverified and invalid.** |
| **Non-Judicial Stamp Paper**      | Stamp Paper                           | State-issued legal paper used for executing affidavits, undertakings, and Powers of Attorney, requiring specific rupee values (e.g., ₹50, ₹100, ₹500) and notary attestation.                                  |
| **Udyam Registration**            | MSME Certificate                      | Official registration issued to Indian Micro, Small, and Medium Enterprises, used to claim statutory exemptions (EMD and Tender Fee waivers under GFR Rule 170).                                               |
| **PPP-MII**                       | Public Procurement (Make in India)    | Statutory preference order requiring certification of percentage of local value addition manufactured within India.                                                                                            |
| **Solvency Certificate**          | Bank Solvency Certificate             | A formal letter from a scheduled commercial bank certifying the contractor is financially sound up to a specified financial limit.                                                                             |
| **Liquidated Damages (LD)**       | Contract Delay Penalties              | Pre-agreed damages deducted from contractor payments for project delays (e.g., 0.5% to 1% of contract value per week of delay, capped at 10%).                                                                 |
| **Defect Liability Period (DLP)** | Warranty / Maintenance Period         | A contractual period (1 to 5 years) post-completion during which the contractor must fix defects at their own expense; PBG is held until DLP expires.                                                          |
| **DSC**                           | Digital Signature Certificate         | Cryptographic USB token (Class 3) used by the bidder's authorized representative to cryptographically sign and encrypt bids during portal upload.                                                              |

---

## 6. The Three Pillars of Technical Qualification

A bidder must satisfy three distinct pillars to pass Packet 1:

```
                            ┌─────────────────────────────────┐
                            │ Packet 1 Technical Eligibility  │
                            └────────────────┬────────────────┘
                                             │
         ┌───────────────────────────────────┼───────────────────────────────────┐
         ▼                                   ▼                                   ▼
 ┌───────────────┐                   ┌───────────────┐                   ┌───────────────┐
 │ 1. Financial  │                   │ 2. Technical  │                   │ 3. Statutory  │
 │    Capacity   │                   │    Experience │                   │    Compliance │
 └───────────────┘                   └───────────────┘                   └───────────────┘
  • Avg Annual Turnover               • The "3-2-1" Rule                  • Non-blacklisting
  • Net Worth / Solvency              • Similar Work Match                • Valid GSTIN & PAN
  • Audited Balance Sheets            • Client Completion Certs           • EPFO & ESIC Registrations
  • CA Certificate + UDIN             • Signing Authority verification    • Make-in-India declaration
```

### Pillar 1: Financial Capacity

1. **Average Annual Turnover**:
   Usually calculated over the last 3 or 5 financial years. Tender typically mandates turnover of at least $30\%-50\%$ of the estimated project value. Must be certified by a CA with an ICAI UDIN.
2. **Net Worth**:
   Must be positive; certain large civil/defence tenders mandate minimum net worth equal to $10\%-15\%$ of tender value.
3. **Bank Solvency**:
   Bank certificate stating the bidder is solvent up to $20\%-40\%$ of the tender value, issued within a specific window (e.g., not older than 6 months or 12 months from the date of NIT).

### Pillar 2: Technical & Past Experience (The Standard "3-2-1" Rule)

In Indian public works and services, the most common qualification formula requires that during the last 7 years, the contractor has successfully completed "similar works" conforming to one of the following thresholds:

- **Three similar completed works**, each costing not less than **40%** of the estimated tender cost, **OR**
- **Two similar completed works**, each costing not less than **50%** of the estimated tender cost, **OR**
- **One similar completed work**, costing not less than **80%** of the estimated tender cost.

> **Crucial Catch: Definition of "Similar Work"**
> If a tender is for _“Construction of Multi-storey RCC Hospital Building”_, an experience certificate for _“Construction of Commercial Steel Warehouse”_ will be rejected by the technical committee because it fails the strict definition of "similar work", even if the monetary value was higher.

### Pillar 3: Statutory & Formal Undertakings

1. **Declarations & Affidavits**:
   - Affidavit of Non-Blacklisting / Non-Debarment on Non-Judicial Stamp Paper.
   - Undertaking that no near-relatives are employed in the tendering department.
   - Power of Attorney (PoA) accompanied by a certified copy of the Board Resolution or Partnership Deed.
   - Integrity Pact signed on each page.
2. **Tax & Labor Registrations**:
   - Valid GSTIN with latest filing returns (GSTR-3B).
   - Permanent Account Number (PAN).
   - EPFO (Provident Fund) and ESIC (Employee State Insurance) registration codes.

---

## 7. The Disqualification Graveyard: Realistic Case Studies

To understand why contractors are desperate for TenderPulse AI, examine these real-world failure patterns:

### Case Study A: The ₹100 vs. ₹50 Stamp Paper Trap

- **Tender**: State PWD Road Construction (Estimated value: ₹8.5 Crore).
- **Clause**: Annexure-B mandates an affidavit of non-blacklisting executed on a _“Non-Judicial Stamp Paper of minimum ₹100 denomination, duly attested by a First-Class Magistrate or Notary Public.”_
- **What Happened**: The contractor’s junior clerk purchased a ₹50 stamp paper because local vendors were out of ₹100 stamp papers. The affidavit was notarized and submitted.
- **Result**: During technical evaluation, the committee rejected the bid as _“Non-responsive: Stamp paper denomination non-compliant with NIT Clause 14.2.”_ The contractor's financial bid was never opened.

### Case Study B: The Missing UDIN on CA Certificate

- **Tender**: Municipal Solid Waste Management (Estimated value: ₹14.0 Crore).
- **Clause**: Turnover certificate must be issued by a practicing Chartered Accountant and contain a valid UDIN.
- **What Happened**: The contractor’s CA issued the turnover certificate on their letterhead on the day of bid submission, promising to generate the UDIN later in the week. The certificate was uploaded without the 18-digit UDIN string.
- **Result**: In line with ICAI directives and CVC procurement mandates, the technical committee disqualified the bidder immediately for submitting an unverified financial certificate.

### Case Study C: The Wrong Signatory on Completion Certificate

- **Tender**: CPWD Electrical Substation Installation (Estimated value: ₹3.2 Crore).
- **Clause**: Past work completion certificates must be issued by an officer _“not below the rank of Executive Engineer (EE) or equivalent.”_
- **What Happened**: The contractor submitted a pristine completion certificate for an earlier project, but it was signed by the Assistant Engineer (AE) / Sub-Divisional Officer (SDO).
- **Result**: Disqualified. In CPWD hierarchy, an AE is subordinate to an EE. The certificate did not meet the rank threshold specified in the NIT.

### Case Study D: The Unnoticed Corrigendum

- **Tender**: Metro Rail Telecommunication Cabling (Estimated value: ₹6.0 Crore).
- **What Happened**: Three days before submission, the authority published _Corrigendum No. 3_, updating the format of Annexure-VII (Declaration on Foreign Border Sharing Nations as per Ministry of Finance Order F.No.6/18/2019-PPD). The contractor submitted the original Annexure-VII from the main RFP.
- **Result**: Disqualified. Submitting an obsolete format constitutes non-compliance with the revised terms of the tender.

### Case Study E: Price Disclosure in Technical Packet

- **Tender**: Smart City IT Infrastructure (Estimated value: ₹12 Crore).
- **What Happened**: While uploading technical datasheets and OEM authorization letters, the contractor inadvertently included a vendor quotation that mentioned unit prices in Cover 1.
- **Result**: **Instant Summary Disqualification.** Disclosing financial pricing inside Packet 1 is strictly forbidden across all government portals (CPPP, GeM) to prevent biasing the technical evaluation.

---

## 8. Procurement Rule Patterns & The 20+ Candidate Detection Categories

TenderPulse AI translates the complex statutory rules of Indian procurement into an automated, high-recall candidate detection and extraction engine (ADR 0028). 

Because government departments express mandatory obligations across varied vocabularies (sometimes without explicit words like `shall` or `must`), our domain rules map directly to **20+ standardized procurement categories**:

```
┌────────────────────────────────────────────────────────────────────────┐
│             20+ Procurement Candidate Categories & Weights             │
├──────────────────────────┬────────┬────────────────────────────────────┤
│ Category                 │ Weight │ Statutory Scope                    │
├──────────────────────────┼────────┼────────────────────────────────────┤
│ FINANCIAL_SECURITY       │  0.95  │ EMD, PBG, Bid Security, Bank BG    │
│ ELIGIBILITY_RESTRICTION  │  0.95  │ Debarment, Blacklisting, Insolvency│
│ EXECUTION_RULE           │  0.90  │ Stamp Paper, Notarization, UDIN    │
│ DEONTIC_MODAL            │  0.85  │ Shall, Must, Covenants, Mandated to│
│ FINANCIAL_THRESHOLD      │  0.85  │ Turnover, Net Worth, Solvency, W/C │
│ MANDATORY_DOCUMENTS      │  0.85  │ PoA, Board Resolution, Integrity   │
│ DAMAGES_PENALTY          │  0.85  │ Liquidated Damages, Forfeiture     │
│ SHORT_INSTRUCTION        │  0.85  │ Compact imperatives (Submit EMD)   │
│ NEGATIVE_COVENANTS       │  0.80  │ Shall not, Prohibited from         │
│ TECHNICAL_CRITERIA       │  0.80  │ Similar Works, 3-2-1 Rule, Plants  │
│ DEADLINE                 │  0.75  │ Bid validity, Closing dates        │
│ MAINTENANCE_SLA          │  0.75  │ Defect Liability Period (DLP)      │
│ CONSTRUCTION_MILESTONES  │  0.75  │ Work schedules, Project phases     │
│ STATUTORY_PERMITS        │  0.70  │ Environmental, Labor, Mining, PESO │
│ DISPUTE_RESOLUTION      │  0.70  │ SAROD, Arbitration, Courts         │
│ ESCROW_WATERFALL         │  0.70  │ Concessionaire revenue routing     │
└──────────────────────────┴────────┴────────────────────────────────────┘
```

### 8.1 Debarment & Disqualification Restrictions (P0 Signal)

Under **GFR 2017 Rule 151** and CVC guidelines, a firm can be debarred from public procurement across three tiers:
1. **Departmental Blacklisting**: Specific to a Ministry or state department (e.g. disqualified by CPWD for 2 years).
2. **Cross-Departmental Debarment**: By Ministry of Finance / Department of Expenditure, binding on all Central Ministries.
3. **Integrity Pact Violations**: Immediate forfeiture of EMD and 3-year commercial ban.

Crucially, debarment clauses are frequently formulated **without deontic modals**:
> *"Bids submitted by firms appearing on the debarred list maintained by MoRTH or NHAI will be rejected."*
> *"Any entity undergoing Corporate Insolvency Resolution Process (CIRP) under the IBC 2016 is ineligible."*

In TenderPulse AI, these passages receive a top-tier **0.95 priority score**, ensuring they are immediately extracted into Packet 1 eligibility checks.

### 8.2 Execution & Statutory Rules: Stamp Paper, Notarization, and UDIN (P0 Signal)

1. **State Stamp Act Invariants**:
   Under the **Indian Stamp Act, 1899** and state-specific amendments (e.g., *Maharashtra Stamp Act 1958*, *Karnataka Stamp Act 1957*), legal instruments must bear stamp duty commensurate with state law:
   - Delhi: Minimum ₹100 for affidavits / ₹50 for undertakings.
   - Maharashtra: Minimum ₹500 for Powers of Attorney and Affidavits (Article 4 of Schedule I).
   - Under-stamped documents are legally inadmissible in evidence (Section 35) and cause instant bid rejection.
2. **Chartered Accountant UDIN Requirement**:
   Per ICAI Council Mandate (effective 1st July 2019) and Ministry of Finance directives, all certificates issued by practicing Chartered Accountants for government tenders must carry an **18-digit Unique Document Identification Number (UDIN)**. The portal rejects certificates with pending or omitted UDINs.

### 8.3 Technical Experience & "Similar Works" Scoring

Tenders structure technical qualification using tiered completion equations:
- **3-2-1 Rule**: 3 works of 40% cost, OR 2 works of 50% cost, OR 1 work of 80% cost.
- **Lookback Window**: Typically the last 7 years ending on the last day of the month previous to the one in which NIT is invited.
- **Escalation Factor**: To equalize past projects against inflation, tender authorities allow a compounded annual indexing factor (typically $7\%$ to $10\%$ per annum) on past financial values:
  $$\text{Indexed Value} = \text{Past Value} \times (1 + r)^n$$

### 8.4 Context Fusion: Bridging Layout Blocks to Document Hierarchy

Tender documents frequently place operative instructions in terse bullet points or table cells:
> Block text: `"₹15,00,000"` (appearing in a table cell or short bullet).

A naive keyword search ignores this block. However, TenderPulse AI's **Context Fusion** links the block to its parent `SectionNode` AST:
$$\text{Lineage: } \text{Document} > \text{SECTION 3: INSTRUCTIONS TO BIDDERS} > \text{Clause 3.1: Earnest Money Deposit}$$
The fused text `[SECTION 3: EARNEST MONEY DEPOSIT] - [₹15,00,000]` activates candidate scoring, assigning a 0.95 priority score and ensuring 100% extraction recall.

---

---

# Part B — Software Domain Model & Ubiquitous Language

**Scope:** the bidder-side Tender Intelligence & Bid Readiness product (see `docs/PRODUCT.md` v2.0).
**Status:** design document only. No database changes are implied or authorized by this document.

## 9. The Business Domain in Plain English

Our customer is an Indian MSME or contractor that earns revenue by winning government tenders. Their economics are brutal:

- They spend **5–10 engineering days** and ₹25,000–75,000 preparing each bid.
- They pledge **1–3% of tender value** as EMD, frozen for 60–120 days.
- **15–30% of bids are disqualified in Packet 1** on procedural defects — not on price or capability.

The platform's job is to make the bidder **informed before they commit**:

1. **Should I pursue this tender?** — Can this company _prove_ it meets the eligibility bar?
2. **What exactly does this tender require?** — Every annexure, declaration, stamp paper value, signing rank, threshold.
3. **Do we have the required evidence?** — Which of our certificates/documents satisfy which requirement, and which are missing or expired?
4. **What could cause rejection?** — Commercial traps (LD, DLP, PBG) and evidence gaps.
5. **Are we ready to submit?** — A readiness gate with human sign-off.

The **persistent Company Capability Profile** is the moat: everything a company has done once (registrations, certifications, financials, past projects, completion certificates, OEM letters, people, equipment, geography, past bid evidence) is captured once and re-evaluated against every future tender.

> **The one-sentence domain:** _A Tender is evaluated against a pinned version of a Company Capability Profile, producing a BidDecision, a gap register, a risk register, and a readiness verdict — all grounded in verbatim citations and all confirmable by a human._

## 10. Concept Derivation

From the candidate concept list, derived by asking "what does the business actually have, do, and decide?":

**Things the business has (entities/values):** Tenant, User, Company, CompanyProfile, Capability (registration, certification, financial record, experience, project, work order, completion certificate, OEM relationship, employee, equipment, geographic presence), EvidenceDocument, Tender, TenderDocument, TenderRequirement, TenderAmendment, Evidence, Risk, GeneratedArtifact.

**Things the business does (processes):** Workflow/WorkflowRun (ingest → extract → match → assess), ComplianceAssessment, BidDecision, ReviewTask/ReviewDecision, Corrigendum monitoring.

**Things the business decides with (evaluations):** EvidenceMatch, MatchState, EligibilityVerdict, ReadinessScore.

**Rules the business enforces (values):** Permission, Role, ExecutionRules, Provenance, Money, validity windows, signing-authority ranks.

## 11. Classification

### 11.1 Aggregates (transactional & consistency boundaries)

| Aggregate root            | Contains                                                                                                                                         | Invariant                                                                                                                                         |
| :------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| **CompanyProfile**        | CapabilityEntry entities (all 11 sections), each linked to EvidenceDocument IDs                                                                  | One ACTIVE version per company at a time; every edit creates a new immutable version; every capability claim must reference ≥0 evidence documents |
| **Tender**                | TenderDocument, TenderRequirement, TenderAmendment entities                                                                                      | A requirement without provenance (file/page/clause/verbatim quote) cannot exist; amendments supersede requirements, never mutate them silently    |
| **BidCase** (the pursuit) | EvidenceMatch, RiskFinding, ComplianceAssessment result, BidDecision, ReadinessAssessment; references Tender + **pinned** CompanyProfile version | The profile version is frozen at case creation so decisions are reproducible; a BidDecision is only valid after human confirmation                |
| **ReviewTask**            | ReviewDecision history                                                                                                                           | One open task per (subject, reviewer) at a time; every resolution records who/when/what changed                                                   |
| **WorkflowRun**           | step states, retry count, lease                                                                                                                  | At-least-once execution with idempotent completion (existing `IngestionJob` is today's incarnation)                                               |
| **AuditEvent**            | —                                                                                                                                                | Immutable, append-only; never updated or deleted                                                                                                  |

### 11.2 Domain entities (with identity & lifecycle, living inside aggregates)

- **Tenant** (a.k.a. Organization) — the account, billing, and data-isolation boundary.
- **User** — a human; joins tenants via **Membership** (bridge entity carrying a Role). A user can belong to multiple tenants (e.g., a bid consultant).
- **Company** — the legal entity the profile describes. Distinct from Tenant: a tenant _accesses_ the system; a company _is evaluated_. MVP: 1 tenant : 1 company, but modeled separately so a group or consultancy can manage several profiles later.
- **CapabilityEntry** and its specializations: **Registration, Certification, FinancialRecord, Experience/Project, WorkOrder, CompletionCertificate, OEMRelationship, Employee, Equipment, GeographicPresence** — each has identity, issuance data, and an expiry/validity window, so they can expire, be renewed, or be revoked.
- **EvidenceDocument** — a stored document (certificate, CA letter, work-order PDF) with metadata and a validity window. Its own small aggregate because one certificate can back several capability entries and several bids.
- **TenderDocument, TenderRequirement, TenderAmendment** — inside Tender.
- **EvidenceMatch, RiskFinding** — inside BidCase.
- **GeneratedArtifact** — an exported, audit-ready Packet-1 pack (PDF/Excel) generated from a BidCase.

### 11.3 Value objects (immutable, no identity, embedded — not tables)

- **Permission** — atomic string (`bids:create`, `compliance:review`). Code checks permissions, never role names.
- **ExecutionRules** — stamp paper required/denomination, notarization, UDIN, signing-authority rank. _(Exists in code today.)_
- **Provenance** — source file, page, clause reference, verbatim quote. _(Exists in code today; the product's trust foundation.)_
- **Money** — rupees, no float math. _(Exists in code today.)_
- **Criterion** — a structured eligibility test: type (turnover / experience-count / certification / geography / OEM…), operator, threshold, unit, lookback window.
- **EligibilityVerdict** — ELIGIBLE / CONDITIONALLY_ELIGIBLE / INELIGIBLE + structured shortfall detail (e.g., _required ₹4.5 Cr avg turnover; profile ₹4.2 Cr; shortfall ₹30 L_).
- **MatchState** — MATCHED / PARTIAL / EXPIRED / MISSING / NOT_APPLICABLE.
- **AssessmentState** — PASS / FAIL / MISSING_EVIDENCE / REVIEW_REQUIRED; the requirement-level rollup of criterion results (§57), distinct from MatchState (per-criterion) and EligibilityVerdict (per-tender).
- **EvidenceRef** — company-side citation: documentId, pages, section, verbatim quote of the extracted fact, verificationTier, extractionMethod. The company-side twin of Provenance (§53).
- **ConflictRecord** — same-field value collision: the conflicting EvidenceRefs, the resolution policy applied, and the resolution (resolved-by-policy | UNRESOLVED) (§54c).
- **ProfileVersionRef** — the pinned (companyId, version) a BidCase was evaluated against.
- **DecisionRationale, ReadinessScore, Severity, SigningAuthorityRank, ValidityWindow**.

### 11.4 Workflow / process concepts (not tables)

- **Workflow** — the process definition (ingest → parse → extract → match → assess → review → readiness).
- **WorkflowRun** — one execution of a workflow; _is_ an aggregate root (see 11.1) because it has transactional state (lease, retries, DLQ).
- **ComplianceAssessment** — the _process_ of evaluating a Tender against a profile, plus its recorded _result_ inside the BidCase. The process is orchestration; the result is data.
- **BidReadiness** — the rollup process producing the readiness score and gate.
- **CorrigendumMonitoring** — the loop that diffs amendments and re-evaluates.
- **MatchScorecard** — the output document of matching (Go / Conditional-Go / No-Go with reasons). A projection, not an entity.

### 11.5 Persistence concerns (not domain concepts)

- **Role** — reference data (static catalog in code today: `permissions.ts`). Only becomes a table if customers need custom roles.
- Table names, JSONB columns, storage paths, indexes — infrastructure, kept out of the domain (ports/adapters pattern, ADR 0008/0014).
- **Not every concept needs a table:** value objects embed in their parent's row (JSONB); processes and scorecards are either workflow state or computed projections; MatchScorecard and ReadinessScore are derived, never stored as truth.

### 11.6 Lifecycles & state transitions

| Concept              | States                                                                                                                                                                       |
| :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CompanyProfile       | DRAFT → ACTIVE → ARCHIVED (every edit mints a new version; old versions immutable)                                                                                           |
| EvidenceDocument     | PENDING → VERIFIED → EXPIRED → RENEWED / REVOKED                                                                                                                             |
| Tender               | DISCOVERED → REGISTERED → ANALYZING → ANALYZED → DECIDED → PURSUING → CLOSED (SUBMITTED / WITHDRAWN / AWARDED / LOST)                                                        |
| TenderRequirement    | EXTRACTED → PROPOSED → CONFIRMED → SUPERSEDED (by amendment)                                                                                                                 |
| TenderAmendment      | PENDING → APPLIED → ASSESSED                                                                                                                                                 |
| EvidenceMatch        | PENDING → MATCHED / PARTIAL / EXPIRED / MISSING / NOT_APPLICABLE                                                                                                             |
| ComplianceAssessment | UNASSESSED → ENGINE_ASSESSED (PASS / FAIL / MISSING_EVIDENCE / REVIEW_REQUIRED) → HUMAN_RESOLVED (CONFIRMED / OVERRIDDEN / WAIVED); engineVerdict retained on override (§56) |
| BidDecision          | AI_PROPOSED → UNDER_REVIEW → CONFIRMED (GO / CONDITIONAL_GO / NO_GO)                                                                                                         |
| ReviewTask           | OPEN → CLAIMED → RESOLVED (APPROVED / REJECTED / EDITED) / EXPIRED                                                                                                           |
| WorkflowRun          | PENDING → PROCESSING → COMPLETED / FAILED / DEAD_LETTER _(matches existing IngestionJob state machine)_                                                                      |
| BidCase              | CREATED → MATCHING → ASSESSED → IN_REVIEW → READY_TO_SUBMIT → SUBMITTED / ABANDONED                                                                                          |

### 11.7 Important relationships

```
Tenant 1──* Membership *──1 User            (Membership carries Role)
Tenant 1──* CompanyProfile                  (versioned; each version pins its CapabilityEntries)
CompanyProfile 1──* CapabilityEntry         (11 section specializations)
CapabilityEntry *──* EvidenceDocument       (evidence backs claims; validity tracked)
Tender 1──* TenderDocument / TenderRequirement / TenderAmendment
BidCase *──1 Tender
BidCase *──1 ProfileVersionRef              (pinned CompanyProfile version — reproducibility)
BidCase 1──* EvidenceMatch                  (each match: requirement ↔ capability/evidence)
BidCase 1──* RiskFinding, 1──1 BidDecision, 1──* ReviewTask, 1──* GeneratedArtifact
Every aggregate ──* AuditEvent              (append-only)
```

**Why these relationships matter:** the BidCase→ProfileVersionRef pin is the single most important relationship in the model — it makes every past decision reproducible against the exact profile state at decision time, which is what separates an audit-ready platform from a checklist app.

## 12. The Core Question: How a Tender Gets Evaluated Against a Company Capability Profile

This is the heart of the product. Ten steps, deterministic at every decision point:

**Phase 0 — Register the Tender.** User uploads the tender package (NIT/RFP/GCC/SCC/BOQ). Documents are parsed; NIT metadata (authority, est. value, deadline, EMD, fee) is extracted. The **Tender** aggregate is created.

**Phase 1 — Extract Requirements.** The 16-domain taxonomy extracts every Packet-1 requirement as a **TenderRequirement** with ExecutionRules and **Provenance** (file, page, clause, verbatim quote). Crucially, eligibility criteria are extracted as structured **Criteria** — _"average turnover ≥ ₹4.5 Cr over FY22–25"_, _"3 similar works ≥ 40% of est. value in last 7 years"_, _"ISO 9001 valid at bid date"_ — not as prose.

**Phase 2 — Pin the Profile.** A **BidCase** is created against the Tender and the **current CompanyProfile version N**. The pin is permanent: even if the profile is later edited, this case remains evaluated against version N.

**Phase 3 — Criterion-by-Criterion Matching (deterministic).** For each structured criterion, pure arithmetic/logic — **never LLM inference**:

| Pillar              | Tender criterion                      | Profile data evaluated                             | Deterministic test                                                                        |
| :------------------ | :------------------------------------ | :------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| Financial           | Avg turnover ≥ ₹4.5 Cr (FY22–25)      | FinancialRecords (FY-wise turnover)                | mean(turnover) ≥ 4.5 Cr; else shortfall = 4.5 − mean                                      |
| Financial           | Solvency ≥ 20% of est. value          | Bank solvency letters                              | letter limit ≥ 0.2 × est. value AND issued within window                                  |
| Experience          | 3 similar works ≥ 40% each, 7 yrs     | Experience/Project + CompletionCertificate entries | count(works where value ≥ 0.4 × est. value AND completed within 7y AND scope matches) ≥ 3 |
| Experience          | Completion cert signed by EE or above | CompletionCertificate.signingRank                  | rank ≥ EE in hierarchy (AE < EE < SE)                                                     |
| Statutory           | Valid GSTIN, PAN, Udyam               | Registrations                                      | present AND active AND unexpired at bid date                                              |
| Certification       | ISO 9001 valid at bid date            | Certifications                                     | issueDate ≤ bidDate ≤ expiryDate                                                          |
| Geographic          | State-specific registration           | GeographicPresence                                 | presence ∩ required region ≠ ∅                                                            |
| Commercial          | OEM authorization for supplied goods  | OEMRelationships                                   | authorization exists AND covers product line AND valid                                    |
| Personnel/Equipment | Key personnel / plant undertaking     | Employees, Equipment                               | named roles/capacities present                                                            |

**Phase 4 — Requirement-Level Match State.** Each TenderRequirement gets a **MatchState**: MATCHED (evidence satisfies it), PARTIAL (some sub-criteria met), EXPIRED (evidence exists but validity lapsed), MISSING (no evidence — must be produced), or NOT_APPLICABLE.

**Phase 5 — Eligibility Verdict & Match Scorecard.** Hard-fail criteria (INELIGIBLE arithmetic: turnover shortfall, too few similar works, expired mandatory registration) aggregate to an **EligibilityVerdict**:

- Any hard fail → **INELIGIBLE** → recommendation **NO-GO** (saves the EMD and 10 days).
- Only gaps/expiries → **CONDITIONALLY_ELIGIBLE** → **CONDITIONAL-GO** with the acquisition list.
- All clear → **ELIGIBLE** → **GO** candidate.

**Phase 6 — Risk Analysis.** Commercial traps extracted from SCC/GCC (LD %/day and cap, DLP length, PBG %, payment milestones, retention, bid validity) become **RiskFindings** with severity — plus an **EMD affordability check**: EMD amount (1–3% of est. value) vs. company liquidity, and lockup days vs. cash runway.

**Phase 7 — Missing Evidence List.** Every MISSING/EXPIRED/PARTIAL item becomes a prioritized acquisition task: what to obtain (₹100 stamp paper, notarized affidavit, UDIN-bearing CA certificate, EE-signed completion certificate, OEM letter), owner, and deadline countdown.

**Phase 8 — Human Review.** AI-proposed requirements, matches, verdicts, and risks become **ReviewTasks**. The Bid Manager approves, rejects, or edits (optimistic concurrency). The **BidDecision** (GO / CONDITIONAL-GO / NO-GO) is only valid once human-confirmed — _AI proposes, human confirms_.

**Phase 9 — Readiness Rollup.** ReadinessScore = f(% requirements evidence-complete, open risk severity, days-to-deadline, EMD availability). The `READY_TO_SUBMIT` gate requires human sign-off; then the **GeneratedArtifact** (Packet-1 preparation pack with citations) is exported.

**Phase 10 — Corrigendum Loop.** A **TenderAmendment** is uploaded → requirements are diffed → changed criteria re-run Phases 3–9 only → the BidCase re-enters MATCHING, and the BidDecision is re-validated or flagged for re-review. This is how "Corrigendum No. 3, published 36 hours before closure" stops being a disqualification.

### Design invariants (why this design)

1. **Deterministic arithmetic only.** Turnover shortfalls, experience counts, EMD affordability — pure functions. An LLM is never asked to compute money (a hallucinated "you're eligible" is a lost EMD).
2. **Every claim is grounded.** No requirement or risk exists without Provenance. 100% verbatim citation is a hard invariant, not a goal.
3. **Decisions are reproducible.** The pinned ProfileVersionRef means "why did we say GO on 12 March?" is always answerable.
4. **Hard-fail determinism.** The worst error is a false GO on an INELIGIBLE tender — so eligibility tests are strict and conservative; uncertainty surfaces as CONDITIONAL-GO, never as GO.
5. **Evidence ≠ requirement.** A requirement is satisfied either by existing profile evidence or by an attestation the bidder must still _produce_ (affidavit, stamp paper). The model tracks both.
6. **The profile compounds.** Every tender evaluated enriches the profile (past bid evidence, win/loss outcomes), making the next evaluation faster and smarter — the platform moat.

## 13. Mapping to Today's Codebase

| Today (code)                                 | Becomes (domain model)                                                                                                                                                                         |
| :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BidProject` aggregate                       | Split into **Tender** (opportunity + package) + **BidCase** (the pursuit/evaluation)                                                                                                           |
| `ComplianceItem`                             | **TenderRequirement** (extraction side) + **EvidenceMatch** (evaluation side)                                                                                                                  |
| `IngestionJob`                               | **WorkflowRun** (state machine carried forward)                                                                                                                                                |
| `TenderDocument`                             | **TenderDocument** (unchanged role)                                                                                                                                                            |
| `AuditLog`                                   | **AuditEvent** (append-only stream)                                                                                                                                                            |
| Python `HumanReviewManager`                  | **ReviewTask / ReviewDecision** aggregate                                                                                                                                                      |
| `users` table + `org_acme_infra_001` literal | **Tenant / User / Membership / Role** (multi-tenant, per-request resolution)                                                                                                                   |
| _(missing)_                                  | **CompanyProfile, CapabilityEntry (11 sections), EvidenceDocument, EvidenceMatch, RiskFinding, BidDecision, ReadinessAssessment, GeneratedArtifact, TenderAmendment** — the pivot's new domain |

## 14. Domain Model Glossary (Ubiquitous Language)

| Term                               | Definition                                                                                                                      |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| **Tenant**                         | The account/isolation boundary (an organization). Owns profiles, tenders, bid cases, audit events.                              |
| **User**                           | A human authenticated against a tenant; holds exactly one Role per tenant via Membership.                                       |
| **Membership**                     | Bridge between User and Tenant; carries the Role.                                                                               |
| **Role**                           | Named permission bundle (ADMIN, BID_MANAGER, REVIEWER, VIEWER). Reference data; code checks Permissions, not Roles.             |
| **Permission**                     | Atomic capability string (`bids:create`, `compliance:review`). The unit of authorization.                                       |
| **Company**                        | The legal business entity whose capability is modeled and evaluated.                                                            |
| **CompanyProfile**                 | Aggregate root: the persistent, versioned, structured record of everything the company can prove. The product's differentiator. |
| **CapabilityEntry**                | A single structured fact about the company, in one of 11 sections.                                                              |
| **Registration**                   | Statutory registration (Udyam, GSTIN, PAN, EPFO, ESIC, Shops & Establishments).                                                 |
| **Certification**                  | Issued certificate (ISO, CMMI, industry certs) with issuer, number, validity window.                                            |
| **FinancialRecord**                | FY-wise financial fact: audited turnover, net worth, working capital, solvency limit (with CA UDIN).                            |
| **Experience / Project**           | A completed or ongoing work: scope, value, client, location, period.                                                            |
| **WorkOrder**                      | A framed work/supply order received from a client.                                                                              |
| **CompletionCertificate**          | Client-issued proof a work was completed, carrying the signing officer's authority rank.                                        |
| **OEMRelationship**                | OEM authorization / dealership / distribution agreement covering product lines.                                                 |
| **Employee**                       | Key personnel with qualifications and role (project manager, safety officer).                                                   |
| **Equipment**                      | Owned/leased plant & machinery with capacity specs.                                                                             |
| **GeographicPresence**             | Offices, service regions, state registrations.                                                                                  |
| **PreviousBidEvidence**            | Past bid outcomes and disqualification reasons; feeds matching and risk learning.                                               |
| **EvidenceDocument**               | A stored source document (PDF/letter) backing one or more capability claims, with a validity window.                            |
| **Tender**                         | Aggregate root: a registered tender opportunity with its document package.                                                      |
| **TenderDocument**                 | One file of the tender package (NIT, RFP, GCC, SCC, specs, BOQ).                                                                |
| **TenderRequirement**              | One extracted Packet-1 requirement with ExecutionRules and Provenance.                                                          |
| **TenderAmendment**                | A corrigendum/addendum; diffs requirements and triggers re-evaluation.                                                          |
| **Evidence**                       | The body of a company's stored proof (capabilities + evidence documents) evaluated against requirements.                        |
| **EvidenceMatch**                  | The evaluated link between one TenderRequirement and the capability/evidence that satisfies it, with a MatchState.              |
| **ComplianceAssessment**           | The process (and its recorded result) of evaluating a Tender against a pinned CompanyProfile.                                   |
| **Risk**                           | A commercial trap or exposure (LD, DLP, PBG, payment terms, EMD lockup) with severity and citation.                             |
| **BidDecision**                    | The human-confirmed GO / CONDITIONAL-GO / NO_GO verdict with rationale, made against a pinned profile version.                  |
| **Workflow / WorkflowRun**         | The async process definition / one execution of it (ingest, extract, match, re-evaluate), with lease/retry/DLQ state.           |
| **ReviewTask / ReviewDecision**    | A unit of human review (approve / reject / edit) and its recorded resolution.                                                   |
| **GeneratedArtifact**              | An exported, audit-ready Packet-1 preparation pack generated from a BidCase.                                                    |
| **AuditEvent**                     | An immutable, append-only record of something that happened, attributable to a user or system process.                          |
| **MatchScorecard**                 | Derived output of matching: verdict, shortfalls, and Go/Conditional-Go/No-Go recommendation. A projection, not stored truth.    |
| **ReadinessScore / Bid Readiness** | Derived rollup of evidence completeness, open risks, and deadline pressure; gated by human sign-off.                            |

_(Business procurement terms — NIT, EMD, PBG, BOQ, UDIN, Corrigendum, LD, DLP, Two-Cover System, etc. — are defined in §5 above.)_

---

_Stop point reached: domain model and glossary only. No database or code changes implemented, per PROMPT 2._

---

---

# Part C — Company Capability Profile: Detailed Design

**Design prompt:** the most important product differentiator. A tender evaluation must never start from a blank PDF — it must ask _"What do we already know about this company?"_

## 15. The Ten Design Requirements

### 15.1 Company profile

- **Company** is the legal entity (legal name, GSTIN, Udyam ID, PAN, constitution, registered address). It is distinct from **Tenant** (the account): one tenant evaluates its own company in MVP, but the model allows a consultancy managing several client profiles.
- **CompanyProfile** is the aggregate root: an organized collection of capability entries grouped into **11 sections** — registrations, certifications, financial information, project experience, work orders, completion certificates, OEM authorization, staff, equipment, geographic capability, previous bid evidence.
- Every tenant has exactly one **ACTIVE** profile version at a time. Drafts are edited; publishing mints an immutable version and atomically swaps ACTIVE.

### 15.2 Capability representation (structured data first)

A **CapabilityEntry** is one typed, structured fact. The engine can only evaluate what is structured — so every attribute the matching engine needs is a typed field, never free text:

| Section                 | Subtype examples                      | Structured attributes                                                                                            |
| :---------------------- | :------------------------------------ | :--------------------------------------------------------------------------------------------------------------- |
| Registrations           | UDYAM, GSTIN, PAN, EPFO, ESIC         | registrationType, registrationNumber, issuingAuthority, validTo                                                  |
| Certifications          | ISO 9001/14001/45001, CMMI            | standard, certificateNumber, issuer, issueDate, expiryDate, scope                                                |
| Financial               | Audited turnover, net worth, solvency | financialYear, turnoverInr (paise), netWorthInr, workingCapitalInr, caUdin                                       |
| Experience              | Completed/ongoing works               | projectName, client, scopeDescription, contractValueInr, startDate, completionDate, location, workType           |
| Work orders             | Framed orders                         | orderNumber, client, valueInr, period, scope                                                                     |
| Completion certificates | Client-issued proof                   | projectRef, issuedBy, signingAuthorityRank (AE/EE/SE…), certificateDate                                          |
| OEM authorization       | Authorizations, dealerships           | oemName, authorizationType, productLines[], validFrom, validTo                                                   |
| Staff                   | Key personnel                         | name, role, qualification, experienceYears, certificates[]                                                       |
| Equipment               | Plant & machinery                     | name, type, capacity, owned/leased, quantity, year                                                               |
| Geographic capability   | Offices, service regions              | region/state, officeType, since                                                                                  |
| Previous bid evidence   | Win/loss history                      | tenderRef, authority, date, outcome (WON/LOST/WITHDRAWN/DISQUALIFIED), disqualificationReason, estimatedValueInr |

**Rule:** _if the matching engine must test it, it must be structured._ Attributes are validated per subtype by a JSON Schema at the domain boundary.

### 15.3 Evidence attachment

- **EvidenceDocument** is its own small aggregate: the stored blob (via `IStorageService`, path `tenants/{orgId}/profile/{entryId}/{evidenceId}/{fileName}`) plus metadata (file name, MIME, size, SHA-256, document kind, issuer, dates).
- **Many-to-many**: one certificate can back several capability entries (e.g., a CA certificate backing turnover _and_ net worth); one entry can be backed by several documents (e.g., ISO certificate + audit report).
- Attachment is a domain operation (`attachEvidence(entryId, evidenceId)`) that records an audit event — not a silent link update.

### 15.4 Evidence validity & expiry

- **ValidityWindow** value object: `validFrom`, `validTo` (nullable — undated proofs like PAN are open-ended).
- Validity is evaluated _at a point in time_: `isValidAt(date)`. Tender evaluation uses the **bid submission date**, not "today", so a certificate valid now but expiring before submission is correctly flagged.
- Expiry is a first-class domain event: entries transition VERIFIED → EXPIRED; a scheduled workflow scans 30/15/7-day horizons and emits `EvidenceExpiring` / `EvidenceExpired` events that drive notifications and the missing-evidence list.

### 15.5 Source provenance

Every capability entry and evidence document carries an immutable **source** record:

- `sourceType`: MANUAL_ENTRY | MANUAL_UPLOAD | DIGILOCKER | ACCOUNT_AGGREGATOR | GSP | MCA_AGGREGATOR | PAST_BID_IMPORT
- `fetchedAt`, `operatorUserId` (who), `consentReference` (for OAuth/consent-based sources), `externalReference` (e.g., DigiLocker document ID)
- This makes every claim traceable to an origin — critical when a qualification decision is challenged.

### 15.6 Verification status

Two distinct axes, kept separate:

1. **Verification tier** (proof quality): `AUTHORITY_VERIFIED` (DigiLocker/AA — digitally signed by the issuer) > `ISSUER_VERIFIED` (issuer letterhead, checkable) > `SELF_ATTESTED` (user upload, unverified) > `UNVERIFIED`.
2. **Verification status** (lifecycle): PENDING → VERIFIED / REJECTED / EXPIRED / REVOKED, with `verifiedBy`, `verifiedAt`, `verificationMethod` (AUTHORITY_API | DOCUMENT_CHECK | MANUAL_REVIEW).

The MatchScorecard displays the tier — a turnover figure backed by a DigiLocker CA certificate is stronger evidence than a self-attested spreadsheet, and the eligibility engine may require a minimum tier for high-stakes criteria.

### 15.7 Reusability across tenders

- **The profile is the cache**: every tender evaluation reads the same profile instead of re-entering company data. The 5th tender in a quarter costs a fraction of the 1st.
- **BidCase pins a profile version** (`ProfileVersionRef`): evaluations are reproducible even after the profile is edited.
- **Feedback loop**: when a tender closes, the outcome (won/lost/disqualified + reason) is written back as **PreviousBidEvidence** — the profile gets smarter with every bid, and disqualification patterns become visible (e.g., "3 losses on signing-rank defects").
- **Completeness score** per section (derived projection): drives onboarding ("your certifications section is 40% complete") and expansion.

### 15.8 Versioning

- Every publish creates an immutable **CompanyProfileVersion** (version number, createdBy, createdAt, changeSummary).
- Entries belong to a version; edits create new entry rows in a new version — history is never overwritten.
- **Diff** between versions is computable (added / updated / expired / removed entries) and shown to reviewers and in the audit trail.
- **Why**: legal defensibility ("what did we claim on 12 March?"), reproducibility of every past decision, and safe correction of mistakes without destroying history.

### 15.9 Authorization & tenant isolation

- **Tenant isolation**: `organization_id` is the leading column on every table + PostgreSQL RLS backstop (existing DATABASE.md policy, unchanged).
- **RBAC**: `profile:read` (all roles), `profile:manage` (ADMIN, BID_MANAGER), `profile:verify` (REVIEWER — verification actions). Financial-section edits may be gated to finance-authorized roles per tenant policy.
- **Evidence blobs** inherit the tenant path prefix; presigned URLs are tenant-scoped and short-lived (existing storage architecture).
- **Connector tokens** (DigiLocker/AA) are tenant-scoped secrets: encrypted at rest, never logged, never sent to the AI service.

### 15.10 Auditability

Every profile mutation emits an immutable **AuditEvent**: PROFILE_CREATED, PROFILE_VERSION_PUBLISHED, CAPABILITY_ADDED, CAPABILITY_UPDATED, CAPABILITY_EXPIRED, EVIDENCE_ATTACHED, EVIDENCE_DETACHED, EVIDENCE_VERIFIED, EVIDENCE_REJECTED, PROFILE_IMPORTED. Each event carries actor, timestamp, and a `{before, after}` diff — the audit_logs pattern already in production carries forward unchanged.

## 16. Structured Data vs. Documents — The Rule

|             | **Structured data**                                                                                                                             | **Documents**                                          |
| :---------- | :---------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------- |
| What        | Typed fields the engine tests (amounts, dates, counts, ranks, regions, codes, validity windows)                                                 | The PDFs/letters/certificates themselves               |
| Where       | `capability_entries.attributes` (JSONB, schema-validated per subtype)                                                                           | Object storage via `IStorageService`, referenced by ID |
| Role        | **The data the product reasons over**                                                                                                           | **The proof that backs the data**                      |
| Produced by | Human entry, connector import, or **one-time extraction at ingest** (e.g., OCR a CA certificate → turnover + UDIN → structured FinancialRecord) | Upload or connector fetch                              |

A document is never "the capability" — it is the evidence _for_ a capability. Extraction populates structured fields once; the engine then evaluates fields, not PDFs. This is what makes matching deterministic, testable, and fast.

## 17. From One-Shot Analyzer to Ongoing SaaS

**Without the profile (one-shot PDF analyzer):** every tender is stateless — the user re-enters company data each time, nothing remembers expiry, no learning from past bids, value is fixed per tender, no recurring engagement, zero switching cost.

**With the profile (ongoing SaaS):**

1. **Compounding reuse** — each evaluation is faster than the last; marginal cost per tender drops over time.
2. **Recurring touchpoints** — expiry monitoring (30/15/7-day digests) brings users back weekly without a new tender.
3. **Learning loop** — previous-bid evidence accumulates; disqualification patterns surface across tenders.
4. **Multi-user workflows** — admin owns the profile, finance attests financials, reviewers verify evidence, bid managers consume it.
5. **Expansion driver** — completeness scores motivate filling more sections; more sections → better matching → more value.
6. **Retention moat** — the longer the profile lives, the more expensive it is to leave; the data _is_ the product.

The profile converts TenderPulse from a tool you open per tender into a system of record you cannot bid without.

---

_Stop point reached: design only, per PROMPT 5. No code implemented._

---

---

# Part D — Tender Ingestion & Requirement Normalization

**Design prompt (PROMPT 6):** a tender is a **package of typed documents**, never a single PDF blob. The pipeline is: Tender → Tender Documents → Document Processing → Extraction → Requirement Detection → Normalization → Requirement Classification → Source Citation. Every normalized requirement must trace back to **document, page, section, and source text**. **Do not use an LLM where deterministic parsing is enough.**

## 25. The Document-Type Taxonomy

A tender package is decomposed into up to 17 document types, each with its own processing profile:

| Type                           | Processing profile                                                                                                         |
| :----------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **NIT**                        | Metadata mine: authority, tender number, est. value, deadline, EMD, fee, pre-bid dates — deterministic regex on short text |
| **RFP**                        | Instruction + eligibility extraction; section segmentation by TOC                                                          |
| **TECHNICAL_SPECS**            | Scope-of-work; LLM tier likely needed for semantic normalization                                                           |
| **ELIGIBILITY_CRITERIA**       | Structured criteria extraction (thresholds, counts, windows) — the Bid/No-Bid input                                        |
| **FINANCIAL_CRITERIA**         | Turnover/net-worth/solvency thresholds; amounts in paise                                                                   |
| **EXPERIENCE_REQUIREMENTS**    | Similar-work rules (3-2-1), completion-certificate requirements, signing-rank thresholds                                   |
| **CERTIFICATION_REQUIREMENTS** | Required certificates, validity windows, issuer requirements                                                               |
| **OEM_REQUIREMENTS**           | Authorization letters, product-line coverage                                                                               |
| **GEOGRAPHIC_REQUIREMENTS**    | Region/state presence, registration requirements                                                                           |
| **STAFFING_REQUIREMENTS**      | Key personnel, qualifications, experience years                                                                            |
| **EQUIPMENT_REQUIREMENTS**     | Plant/machinery undertakings, capacity specs                                                                               |
| **EMD_PBG_RULES**              | Percentages, amounts, validity, exemption rules (Udyam)                                                                    |
| **DECLARATIONS**               | Affidavit formats, stamp paper, notarization, UDIN                                                                         |
| **COMMERCIAL_CONDITIONS**      | LD, DLP, payment terms, retention — risk register input                                                                    |
| **BOQ**                        | Table extraction; locked sheets noted as unparseable (anti-scope: no pricing)                                              |
| **ANNEXURES**                  | Format requirements; each annexure becomes a submission requirement                                                        |
| **CORRIGENDUM**                | Amendment pipeline (§29) — never merged into the base package silently                                                     |

Document type is **auto-classified deterministically** (filename patterns, header/footer text, TOC matching, authority boilerplate fingerprints) and **user-confirmed** — misclassification degrades extraction quality, so it is a reviewable, auditable field.

## 26. The Pipeline (Domain Process View)

```
Tender (aggregate)
  └─ TenderDocument * (typed, per-document processing status)
        └─ WorkflowRun (async, ADR 0018)
              Stage 1  Document processing   format detection, text-layer detection, page count, dedup
              Stage 2  Extraction            native text (pdf-parse/pdfjs) or OCR fallback
              Stage 3  Section segmentation  TOC/heading detection → section tree
              Stage 4  Chunking              section-aware, page-aligned chunk registry
              Stage 5  Requirement detection deterministic tiers first, LLM tier only on ambiguity
              Stage 6  Normalization         canonical schema + dedup + rule fusion
              Stage 7  Classification        category / kind / criticality
              Stage 8  Source citation       provenance VO + deterministic grounding verification
              Stage 9  Persistence           TenderRequirement rows (PROPOSED) + events
```

Each stage is idempotent and per-document isolated: one corrupt PDF fails only that document, never the package.

## 27. Normalized Requirement Schema

```
TenderRequirement {
  id, tenderId, organizationId,
  // Traceability (the four anchors)
  documentId, pageNumber, sectionPath, clauseReference,
  // Classification
  category,          // 16-domain taxonomy: FINANCIAL / EXECUTION / TECHNICAL / LEGAL / STATUTORY / ANNEXURE_DECLARATION / COMMERCIAL_RISK
  kind,              // ELIGIBILITY_THRESHOLD | DOCUMENT_SUBMISSION | DECLARATION | FORMAT | COMMERCIAL_TERM | STATUTORY
  criticality,       // HARD_ELIGIBILITY | SUBMISSION_MANDATORY | INFORMATIONAL
  // Content
  title, description,
  executionRules: { stampPaperRequired, stampPaperDenominationInr, notarizationRequired,
                    signingAuthorityRank, udinRequired, formatRequired },
  criteria: [ { type, operator, threshold, unit, window, minimumVerificationTier } ],  // eligibility/financial/experience
  requiredDocuments: [ documentKind ],                                                // submission requirements
  // Provenance (see §28)
  provenance: { sourceDocumentId, sourceFileName, pageNumber, sectionPath, clauseReference,
                verbatimQuote, chunkId, extractionMethod, confidenceScore },
  detectionMethod: REGEX | STRUCTURAL | LLM,
  status: EXTRACTED → PROPOSED → CONFIRMED → SUPERSEDED,
  version, createdAt
}
```

**Design rules:**

- **Structured criteria wherever possible.** A requirement that _can_ be expressed as `{type: TURNOVER, operator: GTE, threshold: 4500000000 paise, window: "FY22-25"}` _must_ be — the EligibilityEngine consumes criteria, not prose (ADR 0019).
- **`criteria[].minimumVerificationTier`** lets a tender demand authority-verified evidence (e.g., UDIN-bearing CA certificate) — matched against the Company Profile's verification tiers.
- **Dedup + rule fusion** (existing, carried forward): requirements matching `(category, normalizedTitle)` merge; most-restrictive execution rules win (`stampPaperRequired: true`, `max(denomination)`, `notarizationRequired: true`); multi-page citations consolidate ("Clauses across Pages 7, 15, 22").

## 28. Source Provenance & Traceability

Every requirement carries a **Provenance** value object with four mandatory anchors:

1. **Document** — `sourceDocumentId` + `sourceFileName`
2. **Page** — `pageNumber` (or page range)
3. **Section** — `sectionPath` (e.g., `BDS → Section III → Evaluation Criteria → 3.2`)
4. **Source text** — `verbatimQuote`, an **exact substring** of the extracted page text, plus `chunkId` into the chunk registry

**Grounding invariant (hard, deterministic):** the grounding verifier checks `verbatimQuote ∈ pageText` as an exact character-sequence match before persistence. A requirement whose quote cannot be verified is **rejected** — never stored, never shown to the user — and surfaced as a processing exception for human inspection. This is the product's trust foundation (existing behavior, carried forward and made mandatory at this pipeline stage).

**Chunk registry:** section-aware chunks (§31) are persisted with `(chunkId, documentId, pageRange, sectionPath, charOffset)`, so any requirement can be re-retrieved, re-verified, or displayed side-by-side with its source text in the UI.

## 29. Amendment Handling (Corrigenda)

Corrigenda are first-class citizens, never merged silently:

1. Corrigendum uploaded as a **CORRIGENDUM** document → same pipeline.
2. **Deterministic diff** against existing requirements: keyword/clause/section matching produces ADDED / CHANGED / REMOVED candidates; the LLM tier may _suggest_ diffs for ambiguous cases, but the diff result is human-reviewed (gate).
3. Affected base requirements transition → **SUPERSEDED** (immutable history preserved — requirements are never mutated in place).
4. New/changed requirements enter as PROPOSED; affected **BidCases re-enter MATCHING** via an async re-evaluation workflow (only changed criteria re-run).
5. The **BidDecision is flagged for re-confirmation** — a corrigendum that changes eligibility invalidates a prior GO until a human re-confirms.

## 30. Idempotency

| Level           | Mechanism                                                                                                                                                                                                              |
| :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document**    | SHA-256 checksum; `UNIQUE (organization_id, checksum_sha256)` — identical re-uploads are deduplicated                                                                                                                  |
| **Requirement** | Deterministic requirement key = `hash(category, normalizedTitle, documentId, clauseReference)` — reprocessing a document yields the same keys; bulk ingest upserts by key; retries and re-runs produce zero duplicates |
| **Workflow**    | `WorkflowRun` completion is idempotent (existing at-least-once delivery pattern: duplicate deliveries acknowledged and deleted without duplicate rows)                                                                 |
| **Amendment**   | Corrigendum documents are checksummed like any document; a corrigendum applied twice diffs to an empty change set                                                                                                      |

## 31. Chunking Strategy

Section-aware, not blind fixed-size:

- Split on **detected section/heading boundaries** and **page boundaries**; never split mid-sentence.
- Target 1,500–3,000 characters per chunk (fits LLM context windows when the LLM tier runs); small overlap **only** at section boundaries to preserve context.
- Every chunk is registered with `(chunkId, documentId, pageRange, sectionPath, charOffset)` — the unit the LLM tier sees, and the anchor for verbatim verification.
- Tables (BOQ, annexure schedules) are chunked as row ranges with table headers attached.

## 32. Deterministic-First Boundary

**The rule: do not use an LLM where deterministic parsing is enough.** Execution order is always deterministic tiers first; the LLM tier runs only on sections the deterministic tiers could not confidently parse, and its output passes the _same_ normalization, dedup, and grounding verification as regex output.

| Concern                                         | Deterministic (tier 1–2)                     | LLM (tier 3, fallback only) |
| :---------------------------------------------- | :------------------------------------------- | :-------------------------- |
| Text extraction                                 | pdf-parse / pdfjs                            | —                           |
| OCR                                             | Tesseract / Textract                         | —                           |
| Section segmentation                            | TOC + heading + numbering detection          | —                           |
| NIT metadata (dates, amounts, EMD)              | regex on short text                          | —                           |
| Thresholds (₹, %, years, counts)                | numeric regex → structured criteria          | —                           |
| Clause references (ITB 11.2, Clause 6)          | structural regex                             | —                           |
| Stamp paper / notary / UDIN / signing rank      | keyword + pattern rules                      | —                           |
| Known requirement patterns (16-domain taxonomy) | keyword detection (existing regex extractor) | —                           |
| Dedup + rule fusion                             | `(category, normalizedTitle)` merge          | —                           |
| Verbatim verification                           | exact substring check                        | —                           |
| Scope-of-work normalization                     | —                                            | semantic structuring        |
| Ambiguous requirement phrasing                  | —                                            | proposal + provenance       |
| Near-duplicate clustering across documents      | —                                            | similarity suggestion       |
| Corrigendum diff suggestion                     | deterministic candidate matching             | ambiguous-case suggestion   |

`detectionMethod` is recorded per requirement so extraction quality is measurable **per tier** — the AI evaluation framework (`apps/ai` scorecards) extends to per-tier precision tracking.

## 33. Failure Handling

- **Per-document isolation**: a corrupt/encrypted PDF marks that document `FAILED`; the package completes with per-document statuses and a partial compliance register.
- **Workflow resilience**: `WorkflowRun` state machine (PENDING → PROCESSING → COMPLETED / FAILED / DEAD_LETTER), exponential backoff, DLQ for poison pills (existing, ADR 0018).
- **OCR failure**: document flagged `OCR_FAILED` → manual re-upload or human-review path; never silently zero-extracted (the "honest extraction invariant" — 0 items means 0 items, no fabricated mock data).
- **LLM failure**: degrade to the regex baseline (ADR 0018) — extraction continues deterministically.
- **Grounding failure**: requirement rejected pre-persistence, logged as a processing exception, surfaced for human inspection.
- **Timeout**: per-document processing timeout; large packages (200+ pages) use the multi-zone page selector (existing) to bound work.

## 34. Metadata Registry

Per document: `fileName`, `documentType` (auto-classified + user-confirmed), `pageCount`, `hasTextLayer`, `language`, `checksumSha256`, `sizeBytes`, `mimeType`, `uploadedBy`, `uploadedAt`, per-stage processing status, `ocrQualityScore`, and the **section map** (section tree discovered in stage 3). Per tender: authority, tender number, estimated value, deadline, EMD, fee — mined from the NIT deterministically where present.

---

_Stop point reached: design only, per PROMPT 6. No code implemented._

---

---

# Part E — Evaluation & Matching Engine (The Deterministic Core)

**Purpose:** specify _how_ a tender is evaluated against a pinned Company Profile version (ADR 0019). Pure functions, no I/O, no clock reads, no LLM — exhaustively unit-testable and legally defensible. This is the engine that answers _"Should I pursue this tender?"_

## 42. Criterion Evaluation Algorithms

Every eligibility criterion extracted from a tender is one of seven types. Each has a pure evaluator:

| Type               | Evaluator                | Inputs                                                                                                     | Result                                    |
| :----------------- | :----------------------- | :--------------------------------------------------------------------------------------------------------- | :---------------------------------------- |
| **THRESHOLD**      | numeric comparison       | operator (GTE/LTE/EQ), threshold, unit; profile attribute value                                            | SATISFIED / SHORTFALL with `delta`        |
| **COUNT**          | filtered count           | predicate over experience entries: `value ≥ p% × est. value` ∧ `completed within window` ∧ `scope matches` | SATISFIED / SHORTFALL (`found N of M`)    |
| **VALIDITY**       | date-window containment  | entry `valid_from`/`valid_to` vs. **evaluation date = bid submission date**                                | SATISFIED / EXPIRED / MISSING             |
| **SET_MEMBERSHIP** | set intersection         | profile regions ∩ required regions                                                                         | SATISFIED / SHORTFALL (`missing regions`) |
| **RANK**           | ordinal hierarchy        | profile signing rank vs. required minimum (AE < EE < SE < CE)                                              | SATISFIED / SHORTFALL                     |
| **PRESENCE**       | existence + active check | registration/certification of matching type and number                                                     | SATISFIED / MISSING                       |
| **RATIO**          | ratio computation        | limit ≥ p% × estimated tender value                                                                        | SATISFIED / SHORTFALL                     |

Each evaluator returns:

```
CriterionResult {
  state: SATISFIED | SHORTFALL | MISSING | EXPIRED | NOT_APPLICABLE,
  actual, expected, delta, unit,        // structured shortfall detail
  evidenceRef,                            // capability entry / evidence document ID
  tierSufficient: boolean                 // evidence tier >= criterion.minimumVerificationTier
}
```

**Scope matching for COUNT:** "similar work" is tested on declared work-type tags (not fuzzy prose) — a "Multi-storey RCC Hospital" experience does not satisfy "Commercial Steel Warehouse" scope unless work-type tags intersect. Conservative by design: when scope tags don't intersect, the entry is excluded (never assumed similar).

## 43. Matching Algorithm

```
for each TenderRequirement R in tender.requirements:
    if not applicable(R, profile):            → MatchState = NOT_APPLICABLE
    candidates = selectCandidates(R.criteria, profile)   // by (section, subtype) map
    for each criterion C in R.criteria:
        best = highest-tier candidate satisfying C's predicate
        if no candidate:                      C.state = MISSING
        elif best expired at submissionDate:  C.state = EXPIRED
        elif predicate fails:                 C.state = SHORTFALL (with delta)
        elif best.tier < C.minimumTier:       C.state = SHORTFALL (tier-insufficient)
        else:                                 C.state = SATISFIED
    aggregate per-requirement (worst state wins):
        any MISSING      → MATCH_STATE = MISSING
        else any EXPIRED → MATCH_STATE = EXPIRED
        else any SHORTFALL → MATCH_STATE = PARTIAL
        else all SATISFIED → MATCH_STATE = MATCHED
```

**Document/format requirements** (no testable criterion — e.g., "affidavit on ₹100 stamp paper"): matched if the required document kind exists in the Evidence Vault; otherwise they enter the **producible list** ("to produce before submission") rather than a hard fail — unless the tender makes them HARD_ELIGIBILITY.

## 44. Verdict Aggregation (Bid/No-Bid)

```
hardFails    = requirements where criticality == HARD_ELIGIBILITY
                 and MatchState ∉ {MATCHED, NOT_APPLICABLE}
gaps         = SUBMISSION_MANDATORY requirements with MatchState ∉ {MATCHED, NOT_APPLICABLE}

if hardFails non-empty:   verdict = INELIGIBLE        → recommendation NO_GO
elif gaps non-empty:      verdict = CONDITIONALLY_ELIGIBLE → CONDITIONAL_GO
else:                     verdict = ELIGIBLE          → GO candidate
```

**Conservative bias (ADR 0019):** ambiguity, tier insufficiency, and expired evidence never produce GO. The worst error is a false GO (lost EMD); uncertainty always surfaces as CONDITIONAL-GO.

## 45. Gap & Missing-Evidence Computation

Every non-satisfied criterion emits a structured **GapItem**:

```
GapItem {
  requirementId, criterion,
  expected, actual, delta, unit,
  requiredAction: OBTAIN_DOCUMENT | RENEW | UPGRADE_VERIFICATION_TIER | INCREASE_CAPACITY,
  deadline,                                        // submission date
  severity: CRITICAL (hard fail) | HIGH | MEDIUM
}
```

Sorted by `severity × days-to-deadline`. This is the product's acquisition list (workflow stage 8): "Obtain ISO 9001 certificate (expires in 12 days)" or "Turnover shortfall ₹30 L — INELIGIBLE at current FY26 figures."

## 46. Readiness Rollup

```
readinessScore =
    0.50 × evidenceCompleteness     // Σ(weight_i × [state_i == MATCHED]) / Σ(weight_i)
                                     //   HARD_ELIGIBILITY weight 3, SUBMISSION_MANDATORY 1
    + 0.20 × riskClearance          // 1 − normalized open-risk severity
    + 0.15 × deadlineBuffer         // min(1, daysRemaining / 14)
    + 0.15 × emdAffordability       // min(1, liquidity / emdAmount)

READY_TO_SUBMIT  ⟺  score ≥ threshold (default 0.90, tenant-configurable)
                    ∧ zero open hard gaps
                    ∧ human sign-off (gate 4)
```

## 47. Corrigendum Delta Evaluation

On corrigendum application: only **changed requirement keys** re-run (§29). The engine produces a **delta scorecard** — `{added, removed, verdictBefore → verdictAfter}` — and if any HARD_ELIGIBILITY requirement changed, the BidDecision automatically re-opens to UNDER_REVIEW for human re-confirmation. No full re-evaluation, no wasted work, no stale GOs.

## 48. Purity & Testability Guarantees

- **Pure functions:** `(criteria, profileVersion, evaluationDate) → results`. No I/O, no clock reads (evaluation date is always a parameter — so past decisions are re-computable exactly), no randomness, no tenant data beyond the pinned profile.
- **Determinism guarantee:** same inputs → byte-identical outputs. This is the property that makes verdicts reproducible in dispute.
- **Property-based tests:** evaluators are total (never throw; every input maps to a state) and deterministic.
- **Golden fixtures:** known tender archetypes (CPWD works, GeM services, Railways, State PWD) with hand-verified expected verdicts.
- **Mutation testing:** thresholds perturbed (₹4.5 Cr → ₹4.4 Cr) must flip the verdict — proving the engine actually reads the numbers.
- The AI evaluation framework (`apps/ai` scorecards) extends to engine determinism: identical inputs across runs, zero drift.

---

# Part F — Evidence & Compliance Engine (Evidence-Based Assessment)

**Purpose:** answer the product's core operational question — _"For this tender requirement, what evidence does the company have?"_ — with every assessment carrying its evidence. Part E specified _how criteria are computed_; Part F specifies _how evidence is found, linked, validated, explained, decided, and audited_. The two are deliberately separate: Part E is arithmetic, Part F is the evidence lifecycle around it.

## 49. The Evidence-First Principle

**Forbidden output:** `82% compliant`. A bare percentage is an untraceable claim — it cannot be defended in a CVC scrutiny, cannot be debugged when wrong, and hides exactly the requirements that disqualify bids.

**Required output:** one assessment record per tender requirement:

```
ComplianceAssessment {
  requirementId
  tenderEvidence:   { documentId, fileName, pageNumber, sectionPath, clauseReference, verbatimQuote }   // where the requirement came from (§28)
  companyEvidence:  [ { documentId, fileName, pages, section, verbatimQuote, verificationTier, extractionMethod } ]  // what the company has
  criterionResults: [ CriterionResult ]        // §42: SATISFIED / SHORTFALL / EXPIRED / MISSING (+ delta)
  conflicts:        [ ConflictRecord ]         // §54c: detected, resolved-by-policy, or unresolved
  engineVerdict:    PASS | FAIL | MISSING_EVIDENCE | REVIEW_REQUIRED
  explanation:      { narrative, modelId, modelVersion, claims[] }   // advisory, grounded (§55)
  finalVerdict:     PASS | FAIL | MISSING_EVIDENCE | REVIEW_REQUIRED // = engineVerdict unless human override
  override:         { actorId, reason, at } | null
  auditTrail:       [ auditEventIds ]
}
```

Scores are **derived summaries, never answers**. The readiness score (§46) is a rollup _of_ evidence-backed assessments — every point traceable to a requirement, a criterion, and a document page. If a user asks "why 82%?", the system answers with the 18% of weighted requirements that are not PASS, each with its evidence trail.

## 50. The Five-Stage Pipeline

```
TenderRequirement (normalized, §27)
  │
  ▼
[1] EVIDENCE RETRIEVAL ───── recall-oriented, tenant-scoped, deterministic
  │    out: CandidateEvidenceSet (deliberately over-retrieved, ranked)
  ▼
[2] EVIDENCE MATCH ───────── links requirement ↔ company evidence
  │    out: EvidenceMatch entities (dual-sided provenance)
  ▼
[3] DETERMINISTIC VALIDATION  pure evaluators (§42) + conflict/tier/date policy
  │    out: CriterionResult[] + ConflictRecord[] + EngineVerdict
  ▼
[4] AI EXPLANATION ───────── grounded narrative, advisory only
  │    out: Explanation (claims cite resultIds; cannot alter verdict)
  ▼
[5] HUMAN DECISION ───────── confirm / override / waive
       out: ComplianceAssessment (final, audited)
```

## 51. Why This Separation Matters

Five stages, five owners, five failure modes, five independent quality metrics:

| Stage                 | Owner              | May it judge?            | Quality metric                   | If it fails                                              |
| :-------------------- | :----------------- | :----------------------- | :------------------------------- | :------------------------------------------------------- |
| 1. Retrieval          | Deterministic code | No                       | recall@k on held-out tenders     | False MISSING_EVIDENCE — visible, recoverable via review |
| 2. Extraction (facts) | Code + grounded AI | No                       | grounding score (verbatim match) | Rejected pre-persistence (existing invariant, §28)       |
| 3. Rules              | Pure functions     | **Yes — the only place** | Property tests, mutation tests   | Unit-testable; deterministic replay                      |
| 4. Explanation        | LLM                | No                       | claim–result faithfulness        | Template fallback; verdict unaffected                    |
| 5. Decision           | Human              | Yes (override)           | Audit completeness               | Blocked without reason + permission                      |

**The reasons:**

1. **Defensibility.** Indian procurement is vigilance-auditable (CVC). "Why PASS?" must be answerable with documents, pages, and arithmetic. If an LLM produced the verdict, the answer is "the model said so" — legally worthless. A deterministic verdict plus a grounded explanation is defensible; a model verdict is not.
2. **Testability.** Each layer is measured with its own instrument — recall, grounding, determinism, faithfulness, audit completeness. A regression in one layer cannot hide inside another. You can fix retrieval without re-validating rules.
3. **Failure isolation.** A retrieval miss yields a _visible_ MISSING_EVIDENCE (human can supply the document); an AI hallucination yields wrong _prose_ (verdict intact); a human error yields an _audited_ override (attributable, reversible). No single-layer failure silently produces a false PASS.
4. **Security.** The AI stage receives only the deterministic result bundle for requirements the user is authorized to see (ADR 0011/0013). Company financials never enter prompts; tenant isolation is enforced at the retrieval port, before any AI boundary.
5. **Reproducibility.** Pinned profile version (§11.7) + explicit evaluation date (§48) ⇒ byte-identical verdicts on replay. The explanation may vary; the state cannot.

**Why not fewer layers?** A combined "AI assesses and explains" design is simpler — and fails all five properties above: untestable verdicts, unisolatable failures, company data in prompts, and no defensible answer in a dispute. **Why not more layers?** Splitting retrieval from matching, or validation from rollup, beyond what is described adds ceremony without a new failure mode to contain.

## 52. Stage 1 — Evidence Retrieval

- **Input:** TenderRequirement — its `criteria`, `requiredDocuments`, and `criteria[].minimumVerificationTier` (§27).
- **Sources** (all queried against the **pinned profile version**, never the live profile — reproducibility): structured `capability_entries` by subtype; `evidence_documents` metadata full-text search; ANN semantic search over chunk embeddings (tenant-filtered, §2.8).
- **Deterministic in v1.** No LLM in the retrieval path (ADR 0019); semantic ranking is advisory only and may suggest, never select.
- **Output:** `CandidateEvidenceSet { candidates: EvidenceRef[], retrievalMethod, queryId }` — deliberately over-retrieved (top-K = 20). Recall is _measured_ on evaluation fixtures, never assumed.
- **Tenant isolation** is enforced at the repository port (RLS + explicit `organizationId` filter) before any ranking — retrieval cannot leak across tenants even if downstream code is buggy.
- **Failure mode:** retrieval error or empty set → `MISSING_EVIDENCE` with reason `RETRIEVAL_EMPTY`. An empty retrieval is never treated as PASS.

## 53. Stage 2 — EvidenceMatch

- **Deterministic linking.** Candidate facts (extracted at profile-maintenance time under the structured-data-first rule, §16) are tested against criterion predicates — work-type tags, amounts, dates, certificate numbers, regions.
- **Dual-sided provenance.** Every EvidenceMatch carries the tender-side anchors (§28: document, page, section, clause, quote) **and** the company-side `EvidenceRef` (documentId, pages, section, verbatim quote of the fact, verificationTier, extractionMethod). Both sides are auditable: "requirement says X (NIT p.7 §3.1)" and "company shows Y (Audited A/c FY25 p.12)".
- **Many-to-many.** Multiple evidence documents may back one requirement (e.g., three GST filings, two completion certificates). All are linked; per-criterion **best selection** applies the recorded policy: highest verification tier → most recent effective date → most specific scope. The selection made — and the candidates not selected — are recorded, so the choice is reconstructible.
- **Cross-document dedup.** COUNT criteria dedupe by certificate / work-order number, not by document: one work evidenced in two files counts once.
- **MatchState** is computed here per Part E §43 — deterministically, never by LLM inference.

## 54. Stage 3 — Deterministic Validation

Runs the Part E §42 evaluators, then three domain policies — all pure functions:

**a. Expiry policy.** Validity-window containment tested at `evaluationDate = bid submission date` (an explicit parameter, never `now()` — §48). Evidence valid at submission date → SATISFIED; lapses before it → EXPIRED.

**b. Tier policy.** `evidence.verificationTier ≥ criterion.minimumVerificationTier`. Unmet **mandatory** tier → MISSING_EVIDENCE (the tender demands, e.g., a UDIN-bearing CA certificate; a self-declaration cannot substitute). Unmet **advisory** tier → REVIEW_REQUIRED (human may accept it with justification).

**c. Conflict policy** (ordered, deterministic — applied whenever the same field carries ≥2 values):

1. Highest verification tier wins (audited financials > CA-certified > bank letter > self-declared).
2. Tie → most recent effective date.
3. Tie → source authority: ITR/filed > bank letter > CA certificate > self-declaration.
4. Else → `UNRESOLVED` → REVIEW_REQUIRED, citing **all** conflicting refs. **Never silently pick one.**

**Date completeness.** A missing validity or issue date → `UNKNOWN_VALIDITY` → REVIEW_REQUIRED. Conservative by design: an undated certificate cannot _prove_ validity, so the engine never assumes it.

**Output:** `CriterionResult[]` (§42) + `ConflictRecord[]` + `EngineVerdict ∈ {PASS, FAIL, MISSING_EVIDENCE, REVIEW_REQUIRED}`.

## 55. Stage 4 — AI Explanation

- **Input:** the deterministic result bundle (criterion results, evidence refs, conflict records, verbatim quotes) for authorized requirements — **not** raw documents, not company data beyond scope.
- **The output schema has no verdict field.** The AI cannot express an assessment (contract boundary, ADR 0019). It produces a narrative such as: _"Requirement: average turnover ≥ ₹10 Cr (FY22–25), NIT p.7 §3.1. Company evidence: FY25 audited A/c (Doc A, pp. 12–13) ₹9.8 Cr; FY24 ₹10.4 Cr; FY23 ₹9.9 Cr; FY22 ₹10.1 Cr → average ₹10.05 Cr. Engine result: PASS, margin ₹5 L. Conflicting CA letter (Doc C, self-declared, no UDIN) resolved by tier policy in favour of the audited statement."_
- **Grounding of explanations.** Every claim cites a `resultId`/`evidenceRef`; a deterministic verifier checks each claim against the result bundle — the explanation may rephrase and connect, never assert new facts.
- **Failure handling.** Bounded retries → fallback to a deterministic template renderer. **The assessment stands without prose; prose never blocks verdicts.** Model id + version recorded; the explanation is stored immutably beside the verdict it explains.

## 56. Stage 5 — Human Decision & ComplianceAssessment

- `REVIEW_REQUIRED` assessments create **ReviewTask**s (existing aggregate, §11.1). Actions: **CONFIRM** (accept engine verdict), **OVERRIDE** (change finalVerdict), **WAIVE** (accept risk with justification), **REQUEST_EVIDENCE** (loop back to the company).
- **Override contract:** requires `compliance:override` permission, a mandatory reason, optimistic concurrency (`version`), and it **preserves the engine verdict immutably**. Dashboards always show both: `Engine: FAIL (shortfall ₹25 L) — Overridden by R. Sharma, 2026-10-05, "ITR filed figures superseded"`. An override can never delete evidence refs, conflicts, or the engine verdict.
- **ComplianceAssessment** is the recorded result inside the BidCase aggregate (§11.1), versioned for OCC, with its audit trail.

```
Assessment state machine:

UNASSESSED ──engine──► ENGINE_ASSESSED(PASS | FAIL | MISSING_EVIDENCE | REVIEW_REQUIRED)
REVIEW_REQUIRED ──human──► HUMAN_RESOLVED(CONFIRMED | OVERRIDDEN | WAIVED)
ENGINE_ASSESSED(any) ──human override──► OVERRIDDEN   (engineVerdict retained)
WAIVED ──evidence changes──► ENGINE_ASSESSED (re-opened)
```

## 57. Assessment Rollup Mapping

Criterion states (Part E §42) roll up to requirement-level assessment states — worst-first, deterministic:

| Criterion result                                        | Assessment                                           |
| :------------------------------------------------------ | :--------------------------------------------------- |
| All SATISFIED and tier-sufficient                       | **PASS**                                             |
| Any SHORTFALL (numeric / count / region / rank / ratio) | **FAIL** (structured delta attached)                 |
| Any EXPIRED (invalid at submission date)                | **FAIL** (reason = EXPIRED; drives RENEW gap action) |
| Any MISSING (no candidate evidence)                     | **MISSING_EVIDENCE**                                 |
| Tier unmet — mandatory                                  | **MISSING_EVIDENCE**                                 |
| Tier unmet — advisory                                   | **REVIEW_REQUIRED**                                  |
| Conflict UNRESOLVED                                     | **REVIEW_REQUIRED** (all conflicting refs cited)     |
| Ambiguous clause (no structured criteria extractable)   | **REVIEW_REQUIRED**                                  |
| Missing validity/issue date                             | **REVIEW_REQUIRED** (UNKNOWN_VALIDITY)               |

Mixed criteria → worst state wins, ordered **FAIL > MISSING_EVIDENCE > REVIEW_REQUIRED > PASS**: a proven negative outranks an unproven one, which outranks uncertainty.

## 58. Hard Cases — Design Table

| Case                                                            | Detection                          | Deterministic policy                                                            | Assessment outcome                                                                 |
| :-------------------------------------------------------------- | :--------------------------------- | :------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------- |
| **Conflicting evidence** (two documents, different turnover)    | Same field, ≥2 values              | Conflict policy §54c                                                            | Resolved with policy recorded, or REVIEW_REQUIRED if unresolvable                  |
| **Expired certificates**                                        | validity window ∌ evaluationDate   | Expiry policy §54a                                                              | FAIL (EXPIRED) + RENEW gap item (§45)                                              |
| **Insufficient evidence** (exists but below required tier)      | tier < minimumVerificationTier     | Tier policy §54b                                                                | MISSING_EVIDENCE (mandatory) / REVIEW_REQUIRED (advisory)                          |
| **Ambiguous clauses** ("good financial standing")               | No structured criteria extractable | AMBIGUOUS flag at extraction (§32)                                              | REVIEW_REQUIRED; AI may propose interpretations, marked advisory — never a verdict |
| **Missing dates**                                               | validity/issue date absent         | UNKNOWN_VALIDITY                                                                | REVIEW_REQUIRED — never assume valid                                               |
| **Contradictory company data** (profile entry vs. evidence doc) | entry.value ≠ evidence.fact        | Conflict policy; evidence outranks self-entered data when its tier ≥ entry tier | Resolved by policy, else REVIEW_REQUIRED                                           |
| **Multiple evidence documents**                                 | ≥2 candidates per criterion        | All linked; best-selected per §53 policy                                        | Assessment cites all; selection + non-selection recorded                           |
| **Manual override**                                             | Human action                       | OCC + `compliance:override` + mandatory reason                                  | OVERRIDDEN; both verdicts retained immutably                                       |
| **Audit trail**                                                 | Every stage                        | Append-only AuditEvent (§59)                                                    | Immutable; full reconstruction possible                                            |

## 59. Audit Trail

Every stage emits an immutable, append-only **AuditEvent** (existing pattern, §11.1):

`RETRIEVAL_EXECUTED` (queryId, method, candidate count) → `EVIDENCE_MATCHED` (match ids, selection policy applied) → `VALIDATION_COMPLETED` (rule inputs/outputs, conflict resolutions) → `EXPLANATION_GENERATED` (modelId, version, grounding check result) → `ASSESSMENT_FINALIZED` (engineVerdict) → `ASSESSMENT_OVERRIDDEN` / `ASSESSMENT_WAIVED` (actor, reason, before/after).

Payloads are **reference-only** (ids and structured values, never PDF binaries or full document text — existing event policy). This enables: dispute reconstruction ("show every assessment for requirement R over time"), override forensics, and per-stage quality measurement.

## 60. Worked Example (full trace)

**Requirement:** _"The bidder shall have an average annual turnover of at least ₹10,00,00,000 during FY22–FY25"_ — HARD_ELIGIBILITY, TURNOVER criterion, `{operator: GTE, threshold: 1,000,000,000, unit: INR, window: FY22-25, minimumVerificationTier: AUDITED}`.

- **Tender evidence:** `NIT_84_2026.pdf`, p. 7, `BDS → Section III → 3.1`, quote _"…average annual turnover of at least ₹10,00,00,000…"_ (grounding-verified, §28).
- **[1] Retrieval** (pinned profile v7, tenant-scoped): 6 candidates — FY22–FY25 audited statements, one CA letter, one ITR acknowledgement.
- **[2] Match:** audited A/c FY25 p. 12 → ₹9.8 Cr (AUDITED, UDIN); FY24 p. 12 → ₹10.4 Cr; FY23 → ₹9.9 Cr; FY22 → ₹10.1 Cr. CA letter claims FY25 = ₹11 Cr (SELF_DECLARED, no UDIN) → **conflict** on FY25 value.
- **[3] Validation:** mean(9.8, 10.4, 9.9, 10.1) = ₹10.05 Cr ≥ ₹10 Cr → SATISFIED, margin ₹5 L. Conflict resolved by §54c rule 1: AUDITED beats SELF_DECLARED → FY25 = ₹9.8 Cr. Tier policy: AUDITED ≥ AUDITED → sufficient.
- **[4] Explanation:** narrative as in §55, citing both the audited statement and the rejected CA letter; citation-verified.
- **[5] Assessment:** `PASS` — with tender evidence, four company evidence refs, the conflict record, the explanation, and five audit events.

**Variant B:** if FY22 were ₹8.9 Cr → mean ₹9.75 Cr → SHORTFALL ₹25 L → **FAIL** with `{expected: ₹10.0 Cr, actual: ₹9.75 Cr, delta: ₹25 L}` → drives INELIGIBLE / NO-GO (§44) and a gap item ("increase FY22–25 average by ₹25 L — not achievable before submission" → realistic NO-GO signal).

**Variant C:** if the CA letter were AUDITED-tier too (two audited figures for FY25) → rule 1 ties → rule 2 (recency) → rule 3 (source authority) → still tied → **UNRESOLVED** → REVIEW_REQUIRED citing both documents, with the human shown exactly which figures conflict and why the engine could not choose.

---

_Stop point reached: design only, per PROMPT 7. No code implemented._
