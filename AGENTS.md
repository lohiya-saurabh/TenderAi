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
  - Parsing, running furniture, and deleted clause filters in `extraction/parsing.py`
  - Metrics & numeric parsing in `extraction/metrics.py`
  - Guarded clause detection & cross-reference resolution in `extraction/clause_references.py`
  - Sentence-bounded verbatim quotes in `extraction/quote_resolver.py`
  - Deduplication & contradiction detection in `extraction/deduplication.py`
  - Open Knowledge Format compilation in `extraction/okf_compiler.py`
  - Domain extraction rules in `extraction/rules/`
  - Pipeline orchestration in `extraction/orchestrator.py`
  - Maintain `pipeline.py` as a backward-compatible facade (<150 lines).

### Invariant 4: Frontend UI Cleanliness & Safety
- **No Raw JSON Rendering**: Never render raw JSON strings or unparsed serialized objects in UI cards, banners, or tables. Parse JSON into structured typographic elements (Title, Reason, Shortfall Detail callouts via `bidDetailData.ts` and `BidVerdictCard.tsx`).
- **Responsive Data Layouts**: Always wrap wide data tables in `overflow-x-auto` with min-width constraints (`min-w-[1050px]`) to ensure horizontal scrolling inside containers without breaking page layout (`ComplianceTable.tsx`).

### Invariant 5: LLM Gateway Resiliency & Bounded Concurrency
- Enforce bounded concurrency (`asyncio.Semaphore(2)`) on parallel page inference to stay within in-flight credit caps.
- Implement multi-model failover: HTTP 404 marks model permanently unavailable (`float("inf")`), HTTP 429 sets 60s cooldown, HTTP 402 with in-flight limits backs off and retries, and HTTP 401/403 trips circuit breaker.
- When live LLM returns 0 items, always fall back to deterministic parsing to prevent silent data loss.

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
# 1. Python AI Worker (Formatting, Linting & Unit Tests)
ruff check apps/ai/src
pytest apps/ai/tests/ -k "not test_openrouter"

# 2. Monorepo Package Builds
npm run build -w @tenderpulse/shared-types
npm run build -w @tenderpulse/api
npm run build -w @tenderpulse/web

# 3. Web & API Unit Test Suites
npm test -w @tenderpulse/web
npx vitest run apps/api/src/modules/compliance/application/__tests__/compliance-item.mapper.spec.ts
```
