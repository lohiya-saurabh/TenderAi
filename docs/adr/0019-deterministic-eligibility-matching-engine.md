# ADR 0019: Deterministic Eligibility & Matching Engine

## Status

Accepted (2026-10-05)

## Context

The product's core question — _should we pursue this tender?_ — is answered by evaluating structured eligibility criteria (turnover thresholds, similar-work counts, certification validity, geographic presence, OEM coverage) against the Company Capability Profile. In government compliance, a wrong "eligible" verdict costs the bidder an EMD (1–3% of tender value), weeks of work, and potentially a blacklisting-adjacent reputation event.

### The Problem

1. **LLMs cannot be trusted with arithmetic or verdicts**: probabilistic models hallucinate thresholds, miscompute averages, and cannot be deterministically retried.
2. **The v1.0 architecture had no engine at all**: extraction produced prose requirements; nothing evaluated them against company data (the eligibility engine was a documented promise with zero implementation — `docs/CURRENT_STATE.md` §1.9/§3).
3. **Placement risk**: if matching lives in the AI service, tenant data would flow into the AI boundary, violating ADR 0011/0013 (the application decides what the model may see).

## Decision

1. **The EligibilityEngine and MatchingEngine are pure, deterministic functions in the NestJS domain/application layer** — no framework dependencies, exhaustively unit-testable, executed inside the worker after extraction completes.
2. **The AI service output schema cannot express a verdict or a monetary computation.** AI extracts _criteria_ (type, operator, threshold, unit, lookback window) and _requirements_; the engine evaluates them. This is enforced at the contract boundary (Pydantic schema has no verdict/amount fields).
3. **Hard-fail determinism**: any hard eligibility failure (turnover shortfall, insufficient similar works, expired mandatory registration) yields INELIGIBLE/NO-GO. Uncertainty surfaces as CONDITIONALLY_ELIGIBLE, never as GO. The worst error is a false GO.
4. **Structured shortfalls are first-class output**: verdicts carry machine-readable shortfall detail (required vs. actual vs. delta), which drives the missing-evidence list and the MatchScorecard.
5. **MatchState resolution is deterministic**: MATCHED / PARTIAL / EXPIRED / MISSING / NOT_APPLICABLE per requirement, computed from evidence validity windows and attribute predicates — never from LLM inference.
6. **Phase 3 semantic matching (scope-of-work similarity) may suggest matches, but the MatchState remains engine-computed**; suggestions are reviewed by humans (gate 2).

## Consequences

- **Positive**:
  - Verdicts are reproducible, testable, and legally defensible — a requirement of the domain (CVC/CVC-adjacent procurement rigor).
  - Tenant data never enters the AI boundary for evaluation; only extracted criteria flow out of it.
  - Regression-safe: the engine is pure functions; the AI evaluation framework (`apps/ai` scorecards) extends to engine determinism tests.
- **Negative / Trade-offs**:
  - Criteria extraction quality bounds engine quality — garbage criteria in, garbage verdicts out; mitigated by grounding verification and human confirmation (gate 1).
  - Some legitimately fuzzy criteria (e.g., "similar work" scope) need human judgment; the engine conservatively flags them for review rather than deciding.
- **Failure modes**: criteria extracted with wrong thresholds → wrong verdict. Mitigations: verbatim provenance on every criterion, human confirmation gate, and INELIGIBLE bias on ambiguity.

## References

`docs/PRODUCT.md` §5 (AI vs deterministic governance), `docs/DOMAIN.md` §12, ADR 0011/0013 (AI security & tenant isolation).
