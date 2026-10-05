# ADR 0016: Bidder-Side Pivot — Company Profile, Tender, and BidCase Aggregates

## Status

Accepted (2026-10-05)

## Context

The product pivoted from a tender-centric compliance checklist (`docs/PRODUCT.md` v1.0) to a bidder-side Tender Intelligence & Bid Readiness Platform (v2.0). The v1.0 domain model has a single `BidProject` aggregate that conflates two distinct business concepts:

1. **The tender opportunity** (what the authority published — metadata, package, requirements, amendments).
2. **The pursuit** (our evaluation of that tender against our company — matches, risks, decision, readiness).

It also lacks the product's differentiator entirely: the persistent **Company Capability Profile**.

### The Problem

1. **Conflated lifecycle**: a tender can be amended, closed, or awarded independently of whether we pursue it; a pursuit has its own lifecycle (matching → assessed → in review → ready). One aggregate cannot serve both state machines.
2. **No reusable capability model**: every evaluation re-enters company data from scratch; there is nothing to match against.
3. **Requirement ≠ satisfaction**: `ComplianceItem` mixes "what the tender demands" with "our state of satisfying it", making corrigendum re-evaluation and evidence matching awkward.
4. **Non-reproducible decisions**: without a pinned profile version, "why did we say GO on 12 March?" is unanswerable.

## Decision

1. **Split `BidProject` into two aggregate roots**:
   - **Tender** — opportunity metadata, `TenderDocument` entities, `TenderRequirement` entities (with ExecutionRules + Provenance), `TenderAmendment` entities.
   - **BidCase** — the pursuit: references one Tender and one **pinned CompanyProfile version**; contains `EvidenceMatch`, `RiskFinding`, `ComplianceAssessment` result, `BidDecision`, `ReadinessAssessment`.
2. **Introduce `CompanyProfile` as an aggregate root**: versioned (every edit mints an immutable new version), containing `CapabilityEntry` entities in 11 sections (registrations, certifications, financials, experience, work orders, completion certificates, OEM relationships, employees, equipment, geographic presence, previous bid evidence), each referencing `EvidenceDocument` IDs.
3. **`EvidenceDocument` is its own small aggregate** (stored blob metadata + validity window) because one certificate can back multiple capability entries and multiple bid cases.
4. **Split `ComplianceItem`** into `TenderRequirement` (extraction side) and `EvidenceMatch` (evaluation side, carrying `MatchState`).
5. **BidCase → ProfileVersionRef is mandatory**: a case evaluates against a frozen profile version forever, regardless of later profile edits.

## Consequences

- **Positive**:
  - Independent, explicit lifecycles for tender and pursuit; corrigendum re-evaluation re-runs matching without touching the Tender's own state.
  - Decisions are reproducible and audit-ready (profile version pin).
  - The profile compounds value across tenders — the product moat.
  - Clearer bounded contexts for the module map (`docs/ARCHITECTURE.md` §3).
- **Negative / Trade-offs**:
  - Migration from `BidProject`/`ComplianceItem` requires a data migration strategy (expand-and-contract: new aggregates alongside, backfill, then retire).
  - More aggregates = more transactional boundaries; BidCase transactions are larger (matches + risks + decision in one consistency boundary — deliberate, see ADR 0017 discussion).
- **Failure modes**: stale profile data produces false GOs — mitigated by expiry tracking, evidence validity windows, and decision-time version pinning.

## References

`docs/PRODUCT.md` v2.0, `docs/DOMAIN.md` Part B, `docs/CURRENT_STATE.md` §C.
