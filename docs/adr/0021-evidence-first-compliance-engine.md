# ADR 0021: Evidence-First Compliance Engine (Five-Stage Separation)

## Status

Accepted (2026-10-06)

## Context

The product's operational question is *"For this tender requirement, what evidence does the company have?"* The answer must be evidence-carrying: tender-side provenance (document, page, section, clause, verbatim quote), company-side evidence references, criterion results, and a final assessment of PASS / FAIL / MISSING_EVIDENCE / REVIEW_REQUIRED. A bare compliance percentage is forbidden — it is untraceable, indefensible in CVC scrutiny, and hides the exact requirements that disqualify bids.

ADR 0019 established that verdicts are computed deterministically. This ADR establishes **how evidence flows to and through that computation**, and who owns each stage.

## Decision

1. **Five separated stages with distinct owners:** (1) evidence retrieval (deterministic, recall-oriented, tenant-scoped), (2) evidence matching (deterministic linking with dual-sided provenance), (3) deterministic validation (pure evaluators + expiry/tier/conflict policies), (4) AI explanation (grounded narrative, advisory only, no verdict field in its output schema), (5) human decision (confirm / override / waive, permission-gated, fully audited).
2. **The AI cannot express an assessment.** Its output schema has no verdict field (contract boundary, ADR 0019). It explains an already-determined result; a deterministic citation verifier checks every claim against the result bundle. Explanation failure degrades to a template renderer — the assessment never depends on prose.
3. **Deterministic conflict policy** for contradictory evidence: highest verification tier → most recent → source authority (ITR > bank > CA > self-declared) → else REVIEW_REQUIRED citing all conflicting refs. Never silently pick.
4. **Conservative date policy:** validity is evaluated at the submission date (explicit parameter, never `now()`); missing dates → REVIEW_REQUIRED (an undated certificate proves nothing); expired-at-submission → FAIL with reason EXPIRED.
5. **Manual override preserves the engine verdict immutably.** Overrides require `compliance:override`, a mandatory reason, and OCC; dashboards always show both verdicts. Every stage emits append-only, reference-only AuditEvents.
6. **Retrieval runs against the pinned profile version** (§11.7), never the live profile, so assessments are replayable.

## Consequences

- **Positive:**
  - Every assessment is defensible: documents, pages, arithmetic, and policy — all reconstructible from the audit trail.
  - Failure isolation: a retrieval miss yields a visible MISSING_EVIDENCE; an AI hallucination corrupts only prose; a human error is an attributable, reversible, audited override.
  - Security: company financial data never enters the AI boundary — the explanation stage consumes only the deterministic result bundle for authorized requirements (ADR 0011/0013).
  - Each layer has its own quality instrument (recall@k, grounding score, determinism tests, faithfulness, audit completeness), so regressions cannot hide across layers.
- **Negative / Trade-offs:**
  - More moving parts than a combined "AI assesses and explains" design — justified by the five properties above.
  - Conservative policies (undated → REVIEW_REQUIRED, unresolvable conflict → REVIEW_REQUIRED) increase human review load; mitigated by tier-complete profiles and the structured-data-first rule (§16).
- **Failure modes:** retrieval recall misses evidence → false MISSING_EVIDENCE (measured via recall@k on fixtures; human review path recovers); conflict policy misapplied → deterministic and unit-tested; explanation citation drift → verifier rejects, template fallback.

## References

`docs/DOMAIN.md` Part F (§49–60), ADR 0019 (deterministic engine), ADR 0010 (immutable provenance), ADR 0011/0013 (AI security & tenant isolation), `docs/HUMAN_REVIEW.md` (review lifecycle).
