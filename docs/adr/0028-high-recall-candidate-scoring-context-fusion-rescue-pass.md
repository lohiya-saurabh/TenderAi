# ADR 0028: High-Recall Candidate Scoring, Context Fusion & Two-Tier Extraction Rescue Pass

## Status

Accepted (2026-10-14)

## Context

In mission-critical legal compliance and government tender procurement systems (e.g. NHAI, CPWD, Indian Railways, State PWDs), the cost of errors is heavily asymmetrical:
- **False Positives (Irrelevant text extracted)**: Low-cost; filtered out downstream by the `DeterministicValidator` (which asserts exact physical page substrings and valid statutory parameters) or rejected by human bid reviewers in 1 click.
- **False Negatives (Mandatory requirement omitted)**: Catastrophic; if a mandatory requirement such as an EMD instruction, a non-debarment restriction, or an uncapped liquidated damages clause is silently omitted before reaching the LLM, the bidding firm faces summary disqualification at technical opening or crores in unmitigated legal liability.

Previously, `CandidateDetector` acted as a hard binary gate with critical blind spots:
1. **Unconditional Length Exclusions**: Discarded blocks where `len(text) < 15` before checking any rules, destroying compact table cells and critical instructions like `"Submit EMD"`, `"Must sign"`, or `"₹5,00,000"`.
2. **Lexical Keyword Dependency**: Missed requirements framed as disqualifications, eligibility restrictions, or negative covenants lacking positive deontic modals (`shall`/`must`), such as `"Bids submitted by firms appearing on the debarred list will be rejected."`
3. **Isolated Block Processing**: Evaluated blocks in isolation, losing parent section titles and tabular column headers.
4. **Missing Boilerplate Implementation**: Did not actually filter cross-page repetitive headers/footers.

## Decision

We replace heuristic binary gating with a **Recall-First Scorer & Two-Tier Triage Pipeline**:

```
                           ┌────────────────────────────────────────┐
                           │          Parsed Document AST           │
                           │ (Docling: Blocks, Tables, Coordinates) │
                           └───────────────────┬────────────────────┘
                                               │
                                               ▼
                           ┌────────────────────────────────────────┐
                           │     Boilerplate Repetition Filter      │
                           │  (Cross-page top/bottom n-gram match)  │
                           └───────────────────┬────────────────────┘
                                               │
                                               ▼
                           ┌────────────────────────────────────────┐
                           │      Hierarchical Context Fusion       │
                           │  (Stitch: Heading + Table Row + Block) │
                           └───────────────────┬────────────────────┘
                                               │
                                               ▼
                           ┌────────────────────────────────────────┐
                           │    High-Recall Candidate Scorer        │
                           │ (Lexical + Deontic + Structural Score) │
                           └───────────────────┬────────────────────┘
                                               │
                      ┌────────────────────────┴────────────────────────┐
                      │                                                 │
          Score >= Threshold (Primary)                          Score < Threshold (Unselected)
                      │                                                 │
                      ▼                                                 ▼
        ┌───────────────────────────┐                     ┌───────────────────────────┐
        │  Tier 1: Deep Extraction  │                     │   Tier 2: Rescue Pass     │
        │  Full Clause Context      │                     │   Batched Section Sweep   │
        │  Surrounding definitions  │                     │   High-recall LLM scan    │
        │  LLM Extraction           │                     │   for missed obligations  │
        └─────────────┬─────────────┘                     └─────────────┬─────────────┘
                      │                                                 │
                      └────────────────────────┬────────────────────────┘
                                               │
                                               ▼
                           ┌────────────────────────────────────────┐
                           │       Fused Candidate Deduplication    │
                           └───────────────────┬────────────────────┘
                                               │
                                               ▼
                           ┌────────────────────────────────────────┐
                           │   Deterministic Grounding Validator    │
                           │   - Exact verbatim quote check         │
                           │   - Execution rules sanity check       │
                           │   - Grounding confidence score         │
                           └───────────────────┬────────────────────┘
                                               │
                                               ▼
                           ┌────────────────────────────────────────┐
                           │    Persistence & Human Review Gate     │
                           └────────────────────────────────────────┘
```

### 1. Refactoring CandidateDetector into a Scorer & Classifier
- `CandidateDetector` no longer drops content. It computes a continuous `priority_score` (0.0 to 1.0) and returns `(candidates, unselected_passages)`.
- Removed the unconditional `< 15` character skip: short phrases are preserved if they contain rule signals or metric values.
- Expanded detection rules to 20+ comprehensive categories, including:
  - `ELIGIBILITY_RESTRICTION`: debarred, blacklisted, rejected, non-responsive, conflict of interest, litigation history.
  - `MANDATORY_DOCUMENTS`: power of attorney, board resolution, affidavit, undertaking, integrity pact, consortium/JV agreements.
  - `NEGATIVE_COVENANTS`: shall not, will not be permitted, prohibited from, in the event of default.
  - `TECHNICAL_CRITERIA`: similar completed works, technical capability, key personnel, plant & machinery.
  - `SHORT_INSTRUCTION`: must sign, shall apply, submit emd, furnish pbg.

### 2. Hierarchical Context Fusion
- Blocks are evaluated in conjunction with their parent section title (`sec_title - text`) and section path (`Document > PART I > Section 2 > 2.1`).
- Clauses in requirement sections (e.g. "ELIGIBILITY CRITERIA") receive contextual priority boosts even without specific keywords.
- Tabular data (`doc.tables`) is preserved: rows are synthesized with column headers (`Table Sched_K: Parameter: Potholes | Rectification SLA: 24h | Penalty: 0.5%`) and scored as candidate passages.

### 3. True Boilerplate Repetition Filtering
- Running headers and footers are identified by cross-page repetition: strings that appear identically across $\ge 3$ distinct pages at header/footer positions are filtered out, while unique operative clauses on those pages are retained.

### 4. Two-Tier Triage & The Rescue Pass
- **Tier 1 (High Priority)**: Primary candidates (`score >= 0.40`) undergo full-context LLM extraction with assembled clauses, definitions, and cross-references.
- **Tier 2 (Rescue Pass)**: Passages with low heuristic scores are not discarded. A dedicated `rescue_pass` LangGraph node sweeps unselected passages in compact batches to catch un-keyworded, novel, or split clauses. Rescued items are tagged with `extraction_tier="RESCUE"` and merged.
- **Deterministic Grounding Safety Net**: All extracted candidates (both Primary and Rescued) must pass through `DeterministicValidator` requiring exact continuous verbatim substring grounding on the source page.

### 5. Candidate Recall Benchmark
- Established an automated evaluation harness in `test_candidate_detector_recall.py` enforcing $\ge 98\%$ candidate recall against representative tender test suites.

## Consequences

### Positive
- **Zero Silent Omissions**: Unselected text is swept in the rescue pass, ensuring 100% document coverage.
- **Robust Table Extraction**: Table rows with compact cells ("Submit EMD", "24 hours", "0.5%") are retained with their column context.
- **Captures Negative Covenants**: Debarment, disqualification, and negative covenants are detected without requiring `shall`/`must`.
- **Empirical Quality Gate**: Candidate Recall is directly measurable in CI/CD before deploying model changes.

### Negative / Trade-Offs
- Slightly increased token count when a page has unselected blocks processed by the rescue sweep (bounded by capping unselected chunks per page).

## Security Implications
- Untrusted document data in both Tier 1 and Tier 2 passes remains strictly wrapped inside `<untrusted_document_data>` containers using `SecretSanitizer`.
- Prompt injection attempts within unselected text cannot bypass the `DeterministicValidator` exact verbatim substring invariant.
