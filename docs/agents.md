# AGENTS.md — Senior Engineering & Architectural Constitution

> **Role & Operating Mindset**: You are a Principal Systems Architect and Senior Full-Stack Engineer on **TenderPulse AI**. You write minimal, robust, production-grade code, eliminate speculative bloat, uphold clean boundaries, and preserve documentation integrity.

---

## 1. High-Level System Architecture & Context Discovery

Do **not** recursively inspect every individual file across the repository to obtain the big picture. Instead, leverage existing architectural maps:

1. **Knowledge Graph & Architecture**: Use `graphify` (`query_graph`, `god_nodes`) and inspect `graphify-out/` for dependency graphs and cross-module couplings.
2. **Authoritative Pipeline Specification**: Refer to [`docs/audits/PIPELINE_DIAGNOSTICS_AND_BENCHMARK_AUDIT.md`](file:///Users/belikesaurabh/main/TenderAi/docs/audits/PIPELINE_DIAGNOSTICS_AND_BENCHMARK_AUDIT.md) for complete details on the 5 upfront stages, 30-obligation benchmark matrix, and multi-tender hazards.
3. **Domain Contracts & Monorepo Topology**:
   - `apps/web/`: React 18, Vite, Tailwind CSS, Lucide icons.
   - `apps/api/`: NestJS 10, Clean Architecture, Repository/Query pattern, PGlite / PostgreSQL, SQS/S3 event queues.
   - `apps/ai/`: Python 3.14 (FastAPI + LangGraph), 3-Tier Structural RAG, Docling, Pydantic v2.
   - `packages/shared-types/`: Shared TypeScript DTOs and database contracts.

---

## 2. Engineering Invariants & Coding Standards

### Invariant 1: Zero Synthetic Fallbacks
- **Never fabricate or hardcode domain figures** (e.g. static INR 5,00,000 EMD stubs).
- If extraction fails or input is missing, return explicit failure status with `human_review_required=True`. Fallback extractors must dynamically extract numbers, dates, and percentages directly from document chunks.

### Invariant 2: Ponytail Minimalist Engineering
- **Stdlib-First**: Reach for the standard library and native platform features before importing third-party libraries.
- **YAGNI & Anti-Bloat**: Write the simplest, shortest code that satisfies requirements. Avoid speculative abstractions, unnecessary class hierarchies, and wrappers around wrappers.
- **Surgical Diffs**: Modify only what is necessary to resolve the root cause.

### Invariant 3: Clean Architecture & Backend Separation
- **NestJS (`apps/api`)**: Delegate database queries out of service classes into dedicated repository classes (`*.repository.ts`) or query DAOs (`*.queries.ts`). Never write inline SQL queries inside controller or service handlers. Use dedicated mapper services (`compliance-item.mapper.ts`) and HTTP evaluation clients (`AiDecisionClient.ts`).
- **FastAPI AI Worker (`apps/ai`)**: Keep modules single-responsibility under `tenderpulse_ai/extraction/`:
  - DTOs in `extraction/contracts.py`
  - Metrics & numeric parsing in `extraction/metrics.py`
  - Positional clause attribution (structure-tree path of the block holding a quote) in `extraction/clause_references.py`
  - Deduplication & contradiction detection in `extraction/deduplication.py`
  - Open Knowledge Format compilation in `extraction/okf_compiler.py`
  - **Extraction is LLM-only**: no rule, regex or synthetic item producer exists, for tenders (`workflow/nodes.py` llm_extraction) or company evidence (`domain/evidence_extractor.py`). Code may validate and normalize model output (grounding, category mapping, whitespace) but never invents titles, descriptions, quotes, categories or figures. No code may contain tender-specific phrases, figures, issuer/agency/product names
  - Pipeline orchestration in `extraction/orchestrator.py`
  - Maintain `pipeline.py` as a backward-compatible facade (<150 lines).

### Invariant 4: Frontend UI Cleanliness & Safety
- **No Raw JSON Rendering**: Never render raw JSON strings or unparsed serialized objects in UI cards, banners, or tables. Parse JSON into structured typographic elements (Title, Reason, Shortfall Detail callouts via `bidDetailData.ts` and `BidVerdictCard.tsx`).
- **Responsive Data Layouts**: Always wrap wide data tables in `overflow-x-auto` with min-width constraints (`min-w-[1050px]`) to ensure horizontal scrolling inside containers without breaking page layout (`ComplianceTable.tsx`).

### Invariant 5: LLM Gateway Resiliency & Bounded Concurrency
- Enforce bounded concurrency on parallel page windows (`LLM_MAX_CONCURRENCY`, default 3) to stay within in-flight credit caps (HTTP 402 "in-flight" backs off).
- Latency is output-bound (free models generate ~60–90 tokens/s): the extraction prompt asks for minified JSON with only `block_id`, `category`, `title` (≤8 words), `description` (≤30 words), `quote`, and `execution_rules` only when a formality applies (page/clause come from the block). `targeted_refine` asks only for corrections of the rejected candidates, never a re-extraction of the window. Concrete free models are tried before the `openrouter/free` router; a model answering "Reasoning is mandatory" is cooled down for 1 h, unusable output for 5 min, and a success never clears a cooldown set while it was running.
- Implement multi-model failover: HTTP 404 marks model permanently unavailable (`float("inf")`), HTTP 429 locks out the whole provider (base URL) for 60s (`block_provider` — free-tier limits are per key, so same-provider models are skipped in 0ms), HTTP 402 with in-flight limits backs off and retries, and HTTP 401/403 trips circuit breaker.
- **No fallback**: when no model gives a valid answer (unreachable, all providers 429/blocked, invalid JSON, no key) the call raises `LLMExtractionError`. A failed page window is marked `extraction_error`, escalated to review and listed in `DocumentExtractionResponse.failed_pages`; if every window fails the pipeline raises (the queue worker retries, then publishes `status=FAILED`; `/api/v1/extract` returns HTTP 503 `LLM_EXTRACTION_FAILED`). Evidence extraction returns `status=FAILED` with the reason. A valid empty answer (`[]`) is a legitimate result and is not retried.
- Every non-index page reaches the model (no keyword page filter), as every clause chunk of the window (no top-k). The model must copy each `verbatim_quote` exactly; quotes are never filled in from block text. Extraction calls disable reasoning (OpenRouter `reasoning: {effort: "none"}`) and use `LLM_MAX_TOKENS` (4096); a model returning empty content with `finish_reason=length` is cooled down for 10 min; rotation stops at `LLM_TIMEOUT_SECONDS`.
- Routing (`route_verification_outcome`): `extraction_error` escalates directly; only *unintentional* rejections count as failures (`intentional_rejections` = deleted clauses + candidates whose quote is covered by a verified item) and trigger up to 2 `targeted_refine` retries with the validation feedback. Validator number check covers the quote and the description. A model clause reference is kept when it agrees with the line-start structure path; otherwise the path wins.
- **Record / replay**: `LLM_REPLAY_MODE=record` saves raw responses to `apps/ai/tests/fixtures/llm_cassettes/<sha256(messages)>.json`; `replay` serves them offline (a missing recording is an explicit error). Tests inject `tests/fakes.py` (`FakeLLM`, `fake_llm_client`, `use_fake_llm`) and never reach a network.
- Aadhaar redaction requires a valid Verhoeff checksum or an Aadhaar/UID label, and never fires inside AWS account contexts (`amazonaws.com/`, `arn:aws`).

---

## 3. Automatic Documentation Synchronization Mandate

Whenever you make architectural or structural changes:
1. **Update Corresponding Docs**: If you modify database entities, API endpoints, extraction pipeline stages, or LangGraph states, immediately update the relevant documentation in `docs/` and `AGENTS.md`.
2. **Document Decisions in Audits**: Record major architectural tradeoffs, root cause diagnoses, and benchmark results under `docs/audits/`.
3. **Preserve Codebase Integrity**: Never leave orphaned files, unused mock fixtures, or obsolete documentation.

---

## 4. Verification & Testing Protocol

Before concluding any implementation turn, execute the relevant verification gates:

```bash
# 1. Python AI Worker (Formatting, Linting & Tests) — run from apps/ai
ruff check src tests && ruff format --check src tests
pytest -m unit        # ~30 s, no PDFs, no network
pytest                # unit + realdoc (real tender PDFs); `live` tests are opt-in: pytest -m live
uv run python -m tenderpulse_ai.evaluation.benchmark --docs 02,04 --compare last   # extraction benchmark

# 2. Monorepo Package Builds
npm run build -w @tenderpulse/shared-types
npm run build -w @tenderpulse/api
npm run build -w @tenderpulse/web

# 3. Web & API Unit Test Suites
npm test -w @tenderpulse/web
npx vitest run apps/api/src/modules/compliance/application/__tests__/compliance-item.mapper.spec.ts
```
