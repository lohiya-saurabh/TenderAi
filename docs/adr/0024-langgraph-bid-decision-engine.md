# ADR 0024: Stateful LangGraph Bid/No-Bid Decision Workflow with Deterministic Gatekeeper

## Status

Accepted (2026-10-10)

## Context

Deciding whether an enterprise or MSME contractor should pursue a government tender (via GeM, CPPP, State e-Procurement) is a high-stakes strategic decision. A mistaken "GO" verdict causes the bidder to commit and potentially forfeit an Earnest Money Deposit (EMD) of 1–3% of tender value (often ₹10 Lakhs to ₹1 Crore), commit weeks of scarce engineering resources, and risk blacklisting.

In ADR 0019 ("Deterministic Eligibility & Matching Engine") and ADR 0021 ("Evidence-First Compliance Engine"), we established that probabilistic LLMs must never compute mathematical criteria, turnover averages, or final eligibility verdicts.

However, the previous implementation executed the decision as a linear imperative Python script. It lacked:

1. Stateful checkpointing and observable step-by-step lifecycle inspection.
2. An evidence-grounded RAG retrieval step matching extracted tender requirements against the newly created Company Evidence Vault.
3. Explicit conditional branching for ambiguous clauses, borderline readiness scores, and high commercial risks.
4. An executive narrative generation step that explains the deterministic verdict to executive leadership without risking verdict drift.

## Decision

We implement a stateful **LangGraph Bid/No-Bid Decision Workflow** in the Python AI engine (`tenderpulse_ai/decision/workflow/`) structured as a compiled `StateGraph(BidDecisionWorkflowState)`:

```
START
  │
  ▼
evidence_retrieval (Node 1: Evidence RAG & Company Vault fact matching)
  │
  ▼
deterministic_evaluation (Node 2: Pure arithmetic, counts, and statutory gating)
  │
  ▼
commercial_risk (Node 3: EMD liquidity, LD penalties, timeline risks)
  │
  ▼
review_routing (Node 4: Ambiguity and uncertainty trigger analysis)
  │
  ├───────────────────────────────┐
  │ (requires_human_review)       │ (standard flow)
  ▼                               ▼
human_review_gate (Node 5)   executive_synthesis (Node 6)
  │                               ▲
  └───────────────────────────────┘
                                  │
                                 END
```

### 1. Invariant Preservation: The LLM Never Computes the Verdict

- **Node 2 (`deterministic_evaluation`)** executes `DeterministicEligibilityEvaluator` (pure Python/NestJS arithmetic):
  - 3-Year Average Turnover $\ge 40\%$ rule.
  - Completed similar works count and contract value thresholds.
  - Active statutory registrations (GSTIN, PAN, Udyam).
  - Statutory non-debarment flag (hard fatal disqualifier $\rightarrow$ `NO_GO`).
- **Node 6 (`executive_synthesis`)** invokes the LLM solely to synthesize grounded explanations and strategic advice. The prompt strictly constrains the model to the already-computed verdict:
  > _"You are the Chief Bidding Officer. Synthesize the deterministic bid/no-bid evaluation into a concise executive memo. You must adhere strictly to the supplied facts and never alter the eligibility verdict."_

### 2. Stateful StateGraph Schema (`BidDecisionWorkflowState`)

The graph passes an immutable typed state dictionary across nodes:

- `requirements`: list of extracted tender candidates with clause references.
- `company_profile`: factual snapshot from the pinned profile and evidence vault.
- `verdict`: `GO` | `CONDITIONAL_GO` | `NO_GO` | `REVIEW_REQUIRED`.
- `state`: `AI_PROPOSED` | `UNDER_REVIEW`.
- `readiness_score`: deterministic scalar (0.00 – 1.00).
- `hard_disqualifiers`, `missing_information`, `reasons_to_pursue`, `reasons_not_to_pursue`.
- `commercial_risks`: liquidated damages $> 10\%$, short submission window $< 10$ days, EMD lockup.
- `review_triggers`: ambiguous clauses, confidence $< 0.75$, conflicting financial years, past deadlines.
- `audit_events`: accumulated append-only ledger (`Annotated[list[dict], operator.add]`).

### 3. Checkpointing & Observability

- The workflow compiles with LangGraph's checkpointer (`MemorySaver` or durable state store), keying each run by `thread_id = decision_{tender_id}_{workflow_run_id}`.
- Every state transition emits an immutable audit event (`EVIDENCE_RETRIEVAL_COMPLETED`, `DETERMINISTIC_ELIGIBILITY_EVALUATED`, `RISK_ANALYSIS_COMPLETED`, `BID_DECISION_PROPOSED`, `HUMAN_REVIEW_GATE_ENGAGED`, `EXECUTIVE_SYNTHESIS_COMPLETED`).

## Consequences

### Positive

- **Auditable & Traceable:** Meets Indian CVC compliance standards; every claim is backed by tender clauses and verified company evidence.
- **Inspectable State Machine:** If a decision requires human review, the workflow state can be inspected, paused, and resumed at the exact checkpoint.
- **Fail-Safe Invariant:** Even if an LLM hallucinates or asserts "You should definitely bid", the verdict emitted by the graph remains 100% deterministic (`NO_GO` for debarred entities or shortfalls).
- **Separation of Concerns:** Math belongs to deterministic functions; narrative explanation belongs to LLMs.

### Negative & Mitigations

- **Graph Orchestration Overhead:** Adds LangGraph state transitions and serialization.
  - _Mitigation:_ The entire 6-node graph executes in $< 150\text{ms}$ in-memory with zero network overhead in test/offline modes.

## References

- `AGENTS.md` (System rules, zero-trust tenant scoping, anti-hallucination invariants)
- ADR 0004 (LangGraph for Stateful Extraction Loops)
- ADR 0019 (Deterministic Eligibility & Matching Engine)
- ADR 0021 (Evidence-First Compliance Engine)
- ADR 0023 (Company Evidence Onboarding & Third-Party Verification Layer)
