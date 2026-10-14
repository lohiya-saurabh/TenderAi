# ADR 0026: High-Contrast Executive Dossier Design System & Non-Repeating Hierarchy

## Status

Accepted (2026-10-10)

## Context

TenderPulse AI serves procurement executives, bid managers, and legal reviewers evaluating multi-crore public tenders (CPPP, GeM, NHAI, MES, Railways). In the previous UI design:

1. **Visual Contrast & Ergonomic Fatigue**:
   - The light mode canvas used low-contrast off-white/beige tinting that degraded text legibility under typical enterprise display conditions, causing reading fatigue when reviewing 100+ page tender extracts.
2. **Redundant Visual Hierarchy & Content Duplication**:
   - The tender name, issuing authority, and submission deadline were repeated across multiple subordinate cards (e.g., in both the page header and the eligibility verdict card).
   - Compliance matrices and financial requirement tables were rendered in duplicate blocks, cluttering the screen and creating ambiguity as to which matrix was authoritative.
3. **Absence of Document Ingestion Visibility**:
   - Multi-document tender packages (comprising Request for Proposal [RFP], Notice Inviting Tender [NIT], Bill of Quantities [BOQ], and Corrigenda) had no dedicated file-level management view within the bid dossier. Reviewers could not inspect per-document Docling extraction status, clause counts, or raw downloads.
4. **Typography Alignment**:
   - Critical numerical figures (turnover thresholds, earnest money deposit values, liquidated damages percentages, and statutory deadlines) were rendered in proportional fonts, causing vertical column misalignment across comparison tables.

## Decision

We establish the **High-Contrast Executive Dossier Design System** for TenderPulse AI, enforcing strict information hierarchy and high-contrast ergonomics across both light and dark modes:

### 1. High-Contrast Semantic Design Tokens (`apps/web/src/index.css`)

- **Light Mode (`.light`)**:
  - Pure white base canvas (`--background: 0 0% 100%` / `#ffffff`) paired with crisp slate hairlines (`--border: 214.3 31.8% 91.4%` / `#e2e8f0`).
  - Deep ink typography: primary text (`#0f172a`), secondary/muted text (`#334155`), card surface backgrounds (`#ffffff`), and subtle secondary fills (`#f8fafc`).
- **Dark Mode (`:root`)**:
  - Obsidian slate canvas (`--background: 240 10% 3.9%` / `#09090b`) with refined card elevations (`#121215` / `#18181b`) and muted border hairlines (`#27272a`).
- **Semantic Status Signals**:
  - Success/Pursue: Emerald (`#059669` / `#10b981`).
  - Warning/Review: Amber (`#d97706` / `#f59e0b`).
  - Critical/No-Bid: Rose/Crimson (`#dc2626` / `#ef4444`).

### 2. Single Authoritative Header Principle (`TenderInfoHeader.tsx`)

- The tender title, authority badge, NIT identification number, EMD value, and submission countdown are rendered **exclusively** within the top Executive Memo Header (`TenderInfoHeader.tsx`).
- Subordinate evaluation cards (`BidVerdictCard.tsx`, `ObligationsCard.tsx`, `ExtractedComplianceMatrix.tsx`) are forbidden from repeating the tender name or authority header. Instead, they focus strictly on their domain responsibilities (verdicts, liability clauses, and line-item compliances).

### 3. Dedicated Ingested Tender Documents Section (`IngestedDocumentsSection.tsx`)

- A dedicated 2-column card grid displaying all uploaded PDFs (`NIT`, `RFP`, `BOQ`, `CORRIGENDUM`).
- Each document card displays:
  - Document type badge and file name.
  - File size and estimated extracted clause count.
  - Asynchronous processing badge (`PARSED`, `PROCESSING`, `FAILED`) linking directly to the Docling ingestion pipeline.
  - Direct actions: Download raw document, reprocess extraction, or delete document.

### 4. Dual-Font System: `Inter` + `JetBrains Mono`

- **Prose & Structure**: `Inter` is applied to all interface text, section headers, badges, and explanatory paragraphs.
- **Tabular & Statutory Data**: `JetBrains Mono` (`font-mono` / `.mono`) with `font-feature-settings: "tnum" 1` is strictly applied to:
  - Indian Rupee currency values (e.g., `₹4,50,00,000`).
  - NIT reference codes (e.g., `NIT-NHAI-2026-88421`).
  - Statutory dates and submission countdowns.
  - Clause citations (e.g., `Clause 15.2 (GCC)`).
  - Score percentages and ratios.

### 5. Sticky Bid Sign-Off Dock (`BidSignoffDock.tsx`)

- A non-intrusive sticky right-hand column providing:
  - Bid status quick indicator and review stage progress.
  - Direct jump navigation between the 7 dossier sections.
  - Key transaction actions: `Approve Bid Submission`, `Submit Pre-Bid Query`, and `Export Executive Memo`.

## Consequences & Trade-Offs

### Advantages

- **Cognitive Clarity**: Procurement executives can scan eligibility verdicts, financial liabilities, and compliance matrices in under 60 seconds without visual clutter or repetitive headers.
- **Enterprise Readability**: Pure white canvas with slate borders prevents eye fatigue during multi-hour review sessions.
- **Document Traceability**: The Ingested Documents grid provides transparent provenance linking extracted clauses back to source PDF files.
- **Zero API/Backend Disruption**: The refactoring was achieved completely through presentation-tier components and design tokens without changing backend API schemas or breaking existing unit/integration tests.

### Trade-Offs & Mitigations

- **Component Coordination**: Because the tender title is no longer repeated inside subordinate cards, child components must receive their context cleanly through props or React context rather than re-fetching full tender aggregates.
- **Test Safety in Isolated Renders**: `useTheme` was updated with safe fallback defaults so that unit tests rendering subcomponents without a top-level `ThemeProvider` execute without throwing context errors.

## Security Implications

- All document actions (`Download`, `Reprocess`, `Delete`) continue to route through authenticated API clients with RBAC permission checks (`BIDS_UPDATE`, `BIDS_DELETE`) and tenant-scoped paths (`/api/v1/bids/:id/documents/:docId`).
- Presigned download URLs are generated on-demand with short lifespans (15 minutes), preventing public exposure of proprietary bid attachments.
