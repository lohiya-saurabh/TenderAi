# Comprehensive Frontend & UX Audit: TenderPulse AI

**Date:** 2026-10-05  
**Scope:** `apps/web` (React 18 + Vite), `@tenderpulse/ui`, API Integration, Workflow UX  
**Companion Documents:** `AGENTS.md`, `docs/PRODUCT.md`, `docs/STATUS.md`, `docs/frontend.md`

---

## Executive Summary

TenderPulse AI has transitioned from a procurement-officer compliance checker into a **bidder-side Tender Intelligence & Bid Readiness platform for Indian MSMEs and contractors**.

The frontend features strong foundational elements:
- A complete **13-stage bidding workflow** reflecting real Indian procurement steps (NIT, EMD, PBG, BOQ, CA UDIN, stamp paper rules).
- **Dual-sided evidence inspection** connecting tender clauses with corporate capability proof documents.
- **Role-based human review** with Optimistic Concurrency Control (OCC) and audit-grade override justifications.
- **Native JWT authentication** with in-memory token security and silent background refreshing.

However, the UI currently exhibits several critical architectural and usability gaps:
1. **Monolithic state in `BidDetailPage.tsx` (740 lines)** with stage selection confined to transient React state rather than URL routing.
2. **Read-only mock presentation** of the central product differentiator—the **Company Capability Profile**.
3. **Severe desktop/mobile responsive breakage**, where a fixed 260px sidebar and 13-stage pill stepper cause horizontal overflow and cognitive fatigue on compact screens.
4. **Emoji-dependent iconography and pervasive inline styles** preventing consistent theme scaling, accessibility, and WCAG AA compliance.
5. **Absence of core operational surfaces** (Settings, Multi-document batch upload, Toast notifications, and Corrigendum diff viewers).

---

## 1. Audit Across 20 Key Dimensions

### 1. Navigation
* **Current State:** [Sidebar.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/layout/Sidebar.tsx) has 3 static links: "Tender Bids" (`/bids`), "New Bid Project" (`/bids/new`), and "Company Profile" (`/company-profile`).
* **Issues:**
  - Fixed width `260px` with no mobile drawer toggle or collapse mode.
  - No active bid breadcrumb or sub-navigation context in sidebar when reviewing a specific bid.
  - Missing links to Settings, Team, or Notifications.
* **Classification:** **High Priority** | **REFACTOR**

---

### 2. Dashboard
* **Current State:** [DashboardPage.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/pages/DashboardPage.tsx) renders a search bar, action header, and responsive grid of [BidCard.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/bid/BidCard.tsx).
* **Issues:**
  - Missing executive KPI strip: Total active pipeline value (₹ Cr), urgent submissions (<72h), open human reviews, and average readiness score.
  - Search filter operates solely in client memory; lacks status pill filters (`DRAFT`, `ANALYZING`, `REVIEW_READY`, `FINALIZED`), authority dropdown, or sorting.
* **Classification:** **High Priority** | **REFACTOR**

---

### 3. Tender List
* **Current State:** [BidCard.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/bid/BidCard.tsx) presents title, reference, authority, estimated value (INR), deadline, and requirement counts.
* **Issues:**
  - Card grid only; no compact list/table view for contractors managing 20+ tenders.
  - No pagination or virtual windowing; all bids render simultaneously.
* **Classification:** **Medium Priority** | **REFACTOR**

---

### 4. Tender Detail & Stage Navigation
* **Current State:** [BidDetailPage.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/pages/BidDetailPage.tsx) controls 13 workflow stages via [WorkflowStageStepper.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/workflow/WorkflowStageStepper.tsx).
* **Issues:**
  - Monolithic single-file container (739 lines) handling modals, downloads, citation drawer, review actions, and deletions.
  - Stage selection stored in `useState<WorkflowStageId>('tender-overview')`. Browser reload resets user to overview; stages cannot be deep-linked or shared.
  - 13 stage pills cause visual wrap clutter on viewports <1400px.
* **Classification:** **Critical UX Problem** | **REFACTOR / ARCHITECT**

---

### 5. Requirement / Compliance Matrix
* **Current State:** [ComplianceTable.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/compliance/ComplianceTable.tsx) & [ComplianceRow.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/compliance/ComplianceRow.tsx) with expandable cards displaying [ProvenanceCard](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/compliance/ProvenanceCard.tsx) and [ExecutionRulesCard](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/compliance/ExecutionRulesCard.tsx).
* **Issues:**
  - Lacks category filtering (`FINANCIAL`, `TECHNICAL`, `STATUTORY`, `EXECUTION`, `LEGAL`).
  - Lacks bulk review actions ("Mark all READY items as Reviewed").
  - Lacks column sorting (sort by page number, clause ref, or status).
* **Classification:** **High Priority** | **REFACTOR**

---

### 6. Evidence Screens & Verification Drawer
* **Current State:** [EvidenceCitationDrawer.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/workflow/EvidenceCitationDrawer.tsx) slide-over drawer displaying tender clause vs company proof document.
* **Issues:**
  - Backed by frontend synthetic derivations rather than live backend evidence matching API endpoints.
  - Text-only citation display; lacks embedded PDF page viewer or bounding-box highlights.
  - Drawer close button lacks accessible ARIA label.
* **Classification:** **High Priority** | **REFACTOR**

---

### 7. Commercial & Legal Risk Radar
* **Current State:** [RiskRadarCard.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/workflow/RiskRadarCard.tsx) displays Liquidated Damages (LD) caps, cash lock-in, and aggressive SCC terms.
* **Issues:**
  - Static display without interactive mitigation actions ("Mark as Clarification Item for Pre-Bid Meeting").
  - Financial cash exposure values are hardcoded in frontend data derivation.
* **Classification:** **Medium Priority** | **REFACTOR**

---

### 8. Human Review & Decision Workflow
* **Current State:** [HumanReviewTaskCard.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/workflow/HumanReviewTaskCard.tsx) implements 5 reviewer roles, OCC version conflict checks, mandatory 10-char justification for overrides, and threaded comments.
* **Issues:**
  - Standalone page [ComplianceReviewPage.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/pages/ComplianceReviewPage.tsx) (`/bids/:id/compliance/:itemId`) is disconnected from the 13-stage workflow stepper.
  - OCC conflict errors render as a generic error string rather than offering an interactive "Reload & Compare Changes" diff viewer.
* **Classification:** **Medium Priority** | **KEEP CORE / REFACTOR**

---

### 9. Company Capability Profile
* **Current State:** [CompanyProfilePage.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/pages/CompanyProfilePage.tsx) & [CompanyProfileSection.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/workflow/CompanyProfileSection.tsx) displaying 4 credential tabs.
* **Issues:**
  - **Entirely read-only mock presentation.** The "Edit Credentials" and "Export Profile" buttons have no handlers.
  - No forms to input GSTIN, PAN, turnover records, or work orders.
  - No document upload capability to store supporting certificates in the Company Evidence Vault.
* **Classification:** **Critical UX Problem** | **REPLACE WITH INTERACTIVE REPO**

---

### 10. Document Intake & Upload Flow
* **Current State:** [DocumentUploader.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/bid/DocumentUploader.tsx) with drag-and-drop, client-side validation, direct S3 upload via XMLHttpRequest, and progress tracking.
* **Issues:**
  - Single-file upload only. Contractors receive tender packages containing 3 to 10 files (NIT, BOQ, GCC, SCC, Corrigenda); uploading individually is tedious.
  - No automatic document type classifier based on filename keywords (e.g., "NIT", "BOQ", "Corrigendum").
* **Classification:** **High Priority** | **REFACTOR TO BATCH UPLOAD**

---

### 11. Authentication & Session Flow
* **Current State:** [LoginPage.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/pages/LoginPage.tsx), [AuthProvider.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/auth/AuthProvider.tsx), and [ProtectedRoute.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/auth/ProtectedRoute.tsx) with native RFC 7519 HMAC-SHA256 JWTs.
* **Issues:**
  - No "Forgot Password" or "Reset Password" workflow.
  - Hardcoded mock login credential helper on the login card looks like an internal prototype rather than a production enterprise SaaS.
* **Classification:** **Medium Priority** | **KEEP CORE / POLISH**

---

### 12. Settings & Organization Administration
* **Current State:** **Completely Missing.**
* **Issues:**
  - No interface to view organization details, invite team members, assign RBAC roles, or configure notification webhooks.
* **Classification:** **High Priority** | **MISSING**

---

### 13. Loading States & Perceived Performance
* **Current State:** [LoadingSkeleton.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/common/LoadingSkeleton.tsx) with shimmer CSS animation.
* **Issues:**
  - Workflow stage switching does not use suspense or stage-level skeletons, creating abrupt visual pops.
* **Classification:** **Medium Priority** | **REFACTOR**

---

### 14. Empty States
* **Current State:** [EmptyState.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/common/EmptyState.tsx) component with icon, heading, description, and call-to-action button.
* **Issues:**
  - Inconsistent usage: used in `DashboardPage` and `ComplianceTable`, but missing in document lists (shows plain `<p>`), missing in `AuditTimeline`, and missing in `MissingEvidenceSection`.
* **Classification:** **Medium Priority** | **REFACTOR**

---

### 15. Error States & Recovery
* **Current State:** [ErrorBanner.tsx](file:///Users/belikesaurabh/main/TenderAi/apps/web/src/components/common/ErrorBanner.tsx) with dismiss and retry buttons.
* **Issues:**
  - Global action errors push the entire layout down instead of using a non-intrusive toast notification system.
  - Network timeouts during S3 uploads do not support chunked resume.
* **Classification:** **Medium Priority** | **REFACTOR**

---

### 16. Responsive Behavior
* **Current State:** Designed desktop-first for wide screens.
* **Issues:**
  - Desktop sidebar (`--sidebar-width: 260px`) has no mobile collapse toggle; breaks layouts on screens <768px.
  - Stepper pills wrap into multi-line vertical blocks on tablet/mobile screens.
  - Two-cover submission checklist and dual-side evidence drawer overflow horizontally on compact viewports.
* **Classification:** **Critical UX Problem** | **REFACTOR**

---

### 17. Accessibility (WCAG 2.1 AA)
* **Current State:** High-contrast dark theme.
* **Issues:**
  - Non-semantic clickable elements: multiple interactive rows use `<div onClick={...}>` without `role="button"`, `tabIndex={0}`, or keyboard listeners (`onKeyDown`).
  - Text color `--color-surface-subtle: #64748b` on dark background (`#0f172a`) yields a ~3.5:1 contrast ratio, failing the 4.5:1 threshold for normal text.
  - Status badges rely exclusively on color without distinguishable icons or screen-reader announcements.
* **Classification:** **High Priority** | **REFACTOR**

---

### 18. Reusable Components & Architecture
* **Current State:** Components grouped under `src/components/common` and feature folders.
* **Issues:**
  - Package `@tenderpulse/ui` is an empty shell with only `tokens.ts`; no components are exported from the shared design system.
  - Heavy reliance on inline CSS `style={{ ... }}` blocks, duplicating code and preventing clean CSS media queries or pseudo-class states.
* **Classification:** **High Priority** | **REFACTOR**

---

### 19. Design Consistency & Visual Aesthetics
* **Current State:** Slate dark mode (`#0f172a`), indigo primary tones (`#6366f1`).
* **Issues:**
  - System emoji icons (`📋`, `🏢`, `⚠️`, `✅`, `❌`, `🔍`, `🗑️`, `📄`, `📦`, `🚦`) render with platform-dependent artifacts (Apple vs Windows vs Linux emoji fonts).
  - Inconsistent typographic hierarchy across workflow headers (`1.15rem` vs `1.25rem` vs `1.35rem`).
* **Classification:** **High Priority** | **REFACTOR WITH SVG ICONS**

---

### 20. API / UI Integration & Real Data Binding
* **Current State:** Bids CRUD, Document Upload/Download, Audit Trail, and SSE progress stream are wired to real NestJS backend endpoints.
* **Issues:**
  - Stages 4 to 13 (Deadlines, Eligibility Factors, Bid Decision, Evidence Mapping, Risks, Missing Evidence, Human Review Task, Bid Readiness, Submission Checklist) rely heavily on client-side synthetic generators in `workflowData.ts` instead of querying backend domain endpoints.
  - While this allowed building the UX ahead of the backend pivot, these screens must be progressively bound to the newly implemented FastAPI endpoints (`/api/v1/agent/analyze-requirements`, `/api/v1/agent/bid-decision`, and review manager).
* **Classification:** **Critical UX Problem** | **REFACTOR & INTEGRATE**

---

## 2. Component Categorization Matrix

| Component | File Path | Classification | Recommendation & Action Plan |
| :--- | :--- | :--- | :--- |
| **DocumentUploader** | `components/bid/DocumentUploader.tsx` | **KEEP** | Retain direct S3 XHR upload; extend to support multi-file batch uploads. |
| **ExtractionProgress** | `components/progress/ExtractionProgress.tsx` | **KEEP** | Excellent real-time SSE progress consumer with connection resilience. |
| **EvidenceCitationDrawer** | `components/workflow/EvidenceCitationDrawer.tsx` | **KEEP** | Core UX highlight; wire to real backend evidence matches and add keyboard navigation. |
| **HumanReviewTaskCard** | `components/workflow/HumanReviewTaskCard.tsx` | **KEEP** | Robust 5-role review, OCC protection, and justification requirements. |
| **BidReadinessGauge** | `components/workflow/BidReadinessGauge.tsx` | **KEEP** | 4-pillar readiness breakdown; clear visual rollup for contractor leadership. |
| **AppShell & Header** | `components/layout/AppShell.tsx`, `Header.tsx` | **KEEP** | Clean tenant branding, active organization pill, and user profile display. |
| **BidDetailPage** | `pages/BidDetailPage.tsx` | **REFACTOR** | Decompose 740-line monolith into dedicated sub-stage views; bind active stage to URL query param (`?stage=`). |
| **WorkflowStageStepper** | `components/workflow/WorkflowStageStepper.tsx` | **REFACTOR** | Replace 13 inline pill buttons with collapsible milestone accordion and progress bar. |
| **Sidebar** | `components/layout/Sidebar.tsx` | **REFACTOR** | Add mobile hamburger toggle, collapse mode, and settings navigation item. |
| **ComplianceTable & Row** | `components/compliance/ComplianceTable.tsx`, `ComplianceRow.tsx` | **REFACTOR** | Add requirement category filtering, keyboard navigation, and bulk approval actions. |
| **CompanyProfileSection** | `components/workflow/CompanyProfileSection.tsx` | **REPLACE** | Replace static mock display with interactive forms, certificate uploaders, and backend profile persistence. |
| **workflowData.ts (Mock)** | `utils/workflowData.ts` | **REPLACE** | Gradually replace client-side synthetic generators with typed API hooks querying backend endpoints. |
| **Settings Page** | *None* | **MISSING** | Create `/settings` page for organization details, team roles, and webhook configurations. |
| **Batch Multi-file Intake**| *None* | **MISSING** | Create unified drag-and-drop intake for complete tender package (NIT, BOQ, GCC, Corrigenda). |
| **Toast Notification Hub** | *None* | **MISSING** | Create global toast provider for non-intrusive action feedback, copy-to-clipboard, and download alerts. |

---

## 3. Top 10 UI Problems

1. **Monolithic `BidDetailPage.tsx` (740 lines):** Combines 13 separate business workflows into one massive component, causing unnecessary re-renders and making code maintenance difficult.
2. **Transient Workflow Stage State:** Active stage stored purely in local React memory (`useState`); refreshing the page resets the contractor back to the overview stage.
3. **Static, Non-Editable Company Profile:** The single most critical differentiator of the product pivot cannot be created, updated, or enriched by the user.
4. **Desktop-Only Fixed Sidebar (260px):** Layout breaks on mobile viewports (<768px); sidebar cannot be collapsed or toggled.
5. **13-Pill Stepper Cognitive Overload:** Displaying 13 separate pills horizontally causes visual wrap, fatigue, and confusing navigation on tablet viewports.
6. **Inconsistent Icon System:** Raw operating system emojis render inconsistently across platforms and cannot be styled with CSS.
7. **Single-File Upload Bottleneck:** Contractors must repeat the upload cycle 5+ times for multi-document tender packages.
8. **Missing Organization Settings:** No ability to view organization configuration, manage team members, or assign roles.
9. **Accessibility Deficits:** Interactive cards lack keyboard listeners, ARIA roles, and some text colors fail WCAG AA contrast thresholds.
10. **Inline Style Duplication:** Pervasive inline styles with ad-hoc RGBA colors bypass design tokens and prevent media queries.

---

## 4. Biggest UX Problems

1. **Lost Context on Refresh:** Contractors evaluating a 200-page tender must click through to Stage 8 (Evidence Mapping), but any browser reload or shared link drops them back at Stage 3 (Tender Overview).
2. **False Presentation of Enterprise Capability Profile:** Contractors see detailed GSTIN, turnover, and railway experience, but cannot edit values, add new work orders, or upload certificates.
3. **Cluttered Stage Navigation:** 13 sequential steps displayed simultaneously feel overwhelming for an MSME user who wants to answer: *"Can I bid, and what must I do today?"*
4. **Mobile Inoperability:** Field contractors checking tender deadlines on phones or tablets experience broken layout wrapping and overflowing tables.

---

## 5. Recommended Implementation Order

To improve the frontend without regressions, the work should be structured in four sequential phases:

### Phase 1: Navigation, Routing & Architecture Foundation (P0)
1. **URL-Synchronized Workflow Routing:** Bind active workflow stages to URL query parameters (`/bids/:id?stage=eligibility-summary`) so stages can be bookmarked and refreshed.
2. **Decompose `BidDetailPage.tsx`:** Split the 740-line monolith into focused container components for each milestone.
3. **Responsive AppShell & Sidebar:** Add mobile hamburger drawer toggle, collapsed icon rail mode, and active bid context indicator.
4. **SVG Icon Migration:** Replace raw emojis with a clean, accessible SVG icon set (Lucide/Heroicons).

### Phase 2: Workflow Stepper & Presentation Polish (P1)
1. **Redesign WorkflowStageStepper:** Implement a streamlined 5-Milestone Stepper with an expandable drawer for sub-stages, reducing visual clutter.
2. **Interactive Company Profile Manager:** Build editable forms for Registrations, Turnover, Experience, and Certifications.
3. **Multi-Document Batch Uploader:** Allow dragging multiple tender files (NIT + BOQ + Specs) into a single intake queue with auto-detected document types.
4. **Global Toast Notification Hub:** Replace intrusive full-page error banners with clean toast notifications for action confirmations.

### Phase 3: Matrix, Evidence & Review Enhancements (P2)
1. **Requirement Matrix Filters & Bulk Actions:** Add category tabs (`FINANCIAL`, `TECHNICAL`, etc.) and bulk review controls.
2. **Enhanced Evidence Citation Drawer:** Add keyboard navigation (`ArrowLeft`/`ArrowRight`), copy-to-clipboard for clause quotes, and direct jump to matching requirement.
3. **Audit-Grade Concurrency Conflict Diff Viewer:** Replace generic OCC error text with an interactive side-by-side resolver.

### Phase 4: Enterprise Settings & Real Backend Wiring (P3)
1. **Settings Screen (`/settings`):** Implement organization profile, team member invitations, and role management.
2. **Backend Domain Integration:** Progressively replace synthetic derivations in `workflowData.ts` with live API client hooks connecting to FastAPI analysis and review endpoints.
3. **Accessibility & Contrast Hardening:** Enforce WCAG 2.1 AA compliance across all components with full keyboard accessibility.

---

## 6. Design System Architecture & Foundation Decisions

Following the frontend audit, the core design token system and reusable primitives have been formalized without altering existing business page implementations.

### 6.1 Technology Stack & Architectural Decision
* **UI Stack:** React 18 + TypeScript + Vite.
* **Styling Framework:** Native CSS Variables (`:root` in `apps/web/src/index.css`) paired with typed design tokens in `@tenderpulse/ui/src/tokens.ts`.
* **Zero External Component Frameworks:** Avoided introducing Tailwind, MUI, Ant Design, or Chakra. The native CSS variable approach maintains instantaneous Vite HMR (<50ms), zero runtime stylesheet overhead, full accessibility control, and complete flexibility for MSME enterprise procurement workflows.

### 6.2 Token Taxonomy
| Category | Token Set / Range | Purpose |
| :--- | :--- | :--- |
| **Typography Scale** | `--text-2xs` (0.65rem) to `--text-4xl` (2.25rem) | 9-step harmonic scale with strict weights (400, 500, 600, 700) and line heights. |
| **Spacing Scale** | `--space-0-5` (2px) to `--space-16` (64px) | Consistent 4px modular grid across all padding, margins, and gaps. |
| **Radii** | `--radius-none` (0) to `--radius-full` (9999px) | Standardized cards (`--radius-lg`), buttons/inputs (`--radius-md`), pills (`--radius-full`). |
| **Elevations** | `--shadow-xs` to `--shadow-xl`, `--shadow-glow` | Subtle dark-mode layering with glowing status and risk highlights. |
| **Layout Metrics** | `--sidebar-width` (260px), `--sidebar-collapsed-width` (68px), `--header-height` (64px), `--content-max-width` (1440px) | Base metrics for desktop and responsive layouts. |

### 6.3 Semantic Statuses (Canonical Set)
To prevent contractor confusion and ensure absolute clarity on tender requirements, the design system standardizes on 5 canonical statuses:

| Semantic Status | Meaning in Contractor Workflow | Visual Colors (Bg / Text / Border) | Accessible SVG Icon | ARIA Announcement |
| :--- | :--- | :--- | :--- | :--- |
| **`PASS`** | Requirement fully satisfied with verified corporate evidence. | Emerald (`rgba(16,185,129,0.12)` / `#10b981` / `rgba(16,185,129,0.3)`) | `PassIcon` (Circle Checkmark) | `role="status"` "Status: Pass" |
| **`FAIL`** | Hard disqualifier (e.g. negative turnover, blacklisting clause). | Crimson (`rgba(239,68,68,0.12)` / `#ef4444` / `rgba(239,68,68,0.3)`) | `FailIcon` (Circle X-Cross) | `role="status"` "Status: Fail" |
| **`MISSING`** | Document or proof required from contractor (e.g. CA certificate). | Amber (`rgba(245,158,11,0.12)` / `#f59e0b` / `rgba(245,158,11,0.3)`) | `MissingIcon` (Circle Dash/Alert) | `role="status"` "Status: Missing" |
| **`REVIEW_REQUIRED`**| Ambiguous clause or human officer override needed. | Purple (`rgba(139,92,246,0.15)` / `#a78bfa` / `rgba(139,92,246,0.35)`) | `ReviewRequiredIcon` (Inspection Clock) | `role="status"` "Status: Review Required" |
| **`NOT_APPLICABLE`** | Requirement waived or not relevant to bidder category. | Slate (`rgba(100,116,139,0.12)` / `#94a3b8` / `rgba(100,116,139,0.3)`) | `NotApplicableIcon` (Proscribed Slash) | `role="status"` "Status: N/A" |

*Legacy aliases (`READY`, `FLAGGED`, `PENDING`, `WAIVED`, `ANALYZING`, `SUBMITTED`) remain supported seamlessly through `StatusBadge.tsx`.*

### 6.4 Semantic Risk Levels
Commercial and legal tender risks are categorized into 4 actionable tiers:

| Risk Tier | Financial / Operational Impact | Styling & Contrast | Visual SVG Icon |
| :--- | :--- | :--- | :--- |
| **`CRITICAL`** | Immediate disqualification or uncapped financial liability (e.g. uncapped LD, forfeiture of PBG). | Crimson Red (`#dc2626` / `#f87171`) | `CriticalRiskIcon` (Shield Alert) |
| **`HIGH`** | Severe cash lock-in (>10% EMD/PBG) or adverse SCC clauses (<30 day execution penalty). | Orange (`#f97316` / `#fb923c`) | `HighRiskIcon` (Alert Triangle) |
| **`MEDIUM`** | High stamp paper denomination (>₹500), mandatory physical UDIN verification within 48h. | Amber (`#f59e0b` / `#fbbf24`) | `MediumRiskIcon` (Alert Circle) |
| **`LOW`** | Standard tender terms (standard GST declaration, routine GCC payment milestones). | Emerald (`#10b981` / `#34d399`) | `LowRiskIcon` (Shield Check) |

### 6.5 The "Do Not Rely Only on Color" Enforcement
In compliance with WCAG 2.1 AA (Guideline 1.4.1 Use of Color):
1. **Geometric Distinction:** Every status and risk level pairs a distinct SVG icon geometry (Check, Cross, Dash, Clock, Slash, Shield, Triangle) with its badge.
2. **Text Equivalency:** Explicit textual labels accompany or screen-read every status badge.
3. **High Contrast:** All token text-to-background combinations achieve a minimum contrast ratio of 4.5:1 on dark surfaces.
4. **Accessible Roles:** Elements declare `role="status"`, `role="alert"`, or `aria-label` for assistive screen readers.

### 6.6 Reusable Design-System Primitives Implemented
All primitives reside in `apps/web/src/components/common/` with clean barrel exports via `index.ts`:

1. **`Button` (`Button.tsx`):** Variants (`primary`, `secondary`, `outline`, `danger`, `success`, `ghost`), sizes (`sm`, `md`, `lg`), `startIcon`/`endIcon`, `fullWidth`, accessible `isLoading` spinner with `aria-busy`.
2. **`Input` (`Input.tsx`):** Accessible form input with `label`, `error`, `helperText`, `startIcon`, `endIcon`, `required`, and automatic `aria-invalid`/`aria-describedby` wiring.
3. **`StatusBadge` (`StatusBadge.tsx`):** Semantic statuses with embedded SVG icons, legacy alias normalization, and size variants.
4. **`RiskBadge` (`RiskBadge.tsx`):** 4-tier risk indicators with dedicated shield/triangle icons and semantic tokens.
5. **`Badge` (`Badge.tsx`):** General-purpose count and category pill badges with dot indicator option.
6. **`Card` (`Card.tsx`):** Composable `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter` with `default`, `interactive`, `bordered`, and `flat` variants.
7. **`Table` (`Table.tsx`):** Semantic `TableContainer`, `Table`, `TableHead`, `TableBody`, `TableRow`, `TableHeader`, and `TableCell` with `striped`, `hoverable`, and `compact` modes.
8. **`Tabs` (`Tabs.tsx`):** Accessible `Tabs` and `TabPanel` with keyboard navigation (ArrowLeft/ArrowRight/Home/End), badge counts, and `line`/`pills` presentation.
9. **`Modal` (`Modal.tsx`):** Accessible `role="dialog"` modal with backdrop blur, size presets (`sm`, `md`, `lg`, `xl`, `full`), focus handling, and Escape key listeners.
10. **`Drawer` (`Drawer.tsx`):** Slide-over panel primitive with customizable width, `right`/`left` positions, and backdrop overlay.
11. **`Tooltip` (`Tooltip.tsx`):** Hover and keyboard-focus tooltip with `role="tooltip"`, `aria-describedby`, and 4-way positioning (`top`, `bottom`, `left`, `right`).
12. **`Alert` (`Alert.tsx`):** Contextual alert banner (`info`, `success`, `warning`, `danger`) with automatic SVG icons, dismiss action, and custom action slots.
13. **`LoadingSkeleton` & `Spinner` (`LoadingSkeleton.tsx`, `Spinner.tsx`):** Shimmer skeleton with `text`, `rect`, and `circle` shapes; accessible SVG `Spinner` and full `LoadingState` containers.
14. **`EmptyState` (`EmptyState.tsx`):** Structured empty screen with primary and secondary action slots.
15. **`ErrorBanner` & `ErrorState` (`ErrorBanner.tsx`):** Inline alert banners with retry/dismiss actions and expandable technical error accordions; full-page `ErrorState` containers.
16. **`PageLayout` (`PageLayout.tsx`):** Consistent layout hierarchy via `PageContainer`, `PageHeader` (with breadcrumbs and action slots), `SectionHeader`, and `PageGrid`.
17. **`Icons` (`Icons.tsx`):** Zero-dependency accessible SVG icon library for statuses, risks, and common UI actions.

