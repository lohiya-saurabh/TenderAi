# AGENTS.md — Senior Engineering & Architectural Constitution

> **Role & Operating Mindset**: You are a Principal Systems Architect and Senior Full-Stack Engineer on **TenderPulse AI**. You write minimal, robust, production-grade code, eliminate speculative bloat, uphold clean boundaries, and preserve documentation integrity.

---

## 1. High-Level System Architecture & Context Discovery

Do **not** recursively inspect every individual file across the repository to obtain the big picture. Instead, leverage existing architectural maps:

1. **Docs map**: [`docs/README.md`](docs/README.md) lists every guide. Architecture and data flow: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); extraction pipeline, models and rate limits: [`docs/AI_PIPELINE.md`](docs/AI_PIPELINE.md); routes: [`docs/API.md`](docs/API.md); schema: [`docs/DATABASE.md`](docs/DATABASE.md); local setup and gates: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).
2. **Pipeline history and benchmarks**: [`docs/audits/`](docs/audits/) (e.g. `PIPELINE_DIAGNOSTICS_AND_BENCHMARK_AUDIT.md` for the 30-obligation benchmark matrix and multi-tender hazards, `MODEL_ROTATION_QUALITY_BENCHMARK.md` for the current model rotation).
3. **Domain Contracts & Monorepo Topology**:
   - `apps/web/`: React 18, Vite, Tailwind CSS, Lucide icons.
   - `apps/api/`: NestJS 12, Clean Architecture, Repository/Query pattern, PostgreSQL 16 via node-postgres (PGlite only in tests), SQS/S3 event queues.
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
  - Clause attribution (the tender's own line-start number around the quote, same page only; else `None`) in `extraction/clause_references.py`
  - Grounded requirement attributes and the location key in `domain/requirement_attributes.py`
  - Deduplication & contradiction detection in `extraction/deduplication.py`
  - Open Knowledge Format compilation in `extraction/okf_compiler.py`
  - **Extraction is LLM-only**: no rule, regex or synthetic item producer exists, for tenders (`workflow/nodes.py` llm_extraction) or company evidence (`domain/evidence_extractor.py`). Code may validate and normalize model output (grounding, category mapping, whitespace) but never invents titles, descriptions, quotes, categories or figures. No code may contain tender-specific phrases, figures, issuer/agency/product names
  - Pipeline orchestration in `extraction/orchestrator.py`
  - Maintain `pipeline.py` as a backward-compatible facade (<150 lines).

### Invariant 4: Frontend UI Cleanliness & Safety

- **No Raw JSON Rendering**: Never render raw JSON strings or unparsed serialized objects in UI cards, banners, or tables. Parse JSON into structured typographic elements (Title, Reason, Shortfall Detail callouts via `bidDetailData.ts` and `BidVerdictCard.tsx`).
- **Clause Contract**: The AI→API payload, API clause model and UI types are one contract: `packages/shared-types/src/clause.ts` + `schema/extraction-completed.schema.json` + golden fixture `fixtures/extraction-completed.phase1.json` (regenerate with `UPDATE_FIXTURES=1 pytest tests/test_clause_contract.py`). Clause identity is location (document, page, quote), never the title; a human review is never overwritten by re-extraction.
- **No Invented Values**: A value the tender does not state is `null`/empty end to end and renders as "Not stated" / "No page" / "Not assessed" (no default signatory, page 1, LOW risk, 0.95 confidence, or VERIFIED without evidence). Never show a percentage for confidence: the only per-item score is the deterministic validation result. Status is never derived from category.
- **Design Tokens Only**: colours come from the tokens in `apps/web/src/index.css` (`primary`, `success`, `warning`, `destructive`, `muted`, …) and type from one scale (`text-2xs` 11px, then `text-xs`…`text-4xl`). Roles: page title `h1` `text-2xl font-semibold` (24px); section or card title `h2`/`CardTitle` `text-base font-semibold` (16px); sub-heading inside a card `text-sm font-semibold`; body `text-sm`; secondary text, labels and table headers `text-xs`; chips `text-2xs`/`text-xs`; form controls `text-sm` `h-9` (the default from `index.css`), toolbar and filter-bar controls `text-xs` `h-8`. Marketing heroes are exempt. No uppercase labels; `font-mono` only for identifiers (tender ID, GSTIN, clause and page refs), `tabular-nums` for figures. Raw palette classes (`text-orange-600`), hex classes (`bg-[#16191F]`) and pixel sizes (`text-[11px]`) are lint errors in `apps/web`. Both themes come from the same tokens: never `text-white`/`text-black` or a fixed `rgba(...)` for text or fills (use `text-foreground`, `text-primary-foreground`, `hsl(var(--primary) / 0.1)`); the app header is a `dark` scope, so it uses `bg-background text-foreground` and stays dark in both themes. One component per job: `common/Badge` is the only chip (`StatusBadge` and `RiskBadge` map onto it, and always carry text), `common/Button` wraps `ui/button`, `common/EmptyState` and `common/Spinner` (`LoadingState`) are the only empty and loading states.
- **Public Pages Claim Only What Ships**: the landing page, nav and footer (`pages/LandingPage.tsx`, `components/layout/Public*.tsx`) describe only features that exist today. No unsourced statistics, no "deterministic" or "zero hallucination" wording for the AI extraction, no compliance or hosting-region claims that deployment does not guarantee, and examples are labelled as examples.
- **Responsive Data Layouts**: Always wrap wide data tables in `overflow-x-auto` with min-width constraints so they scroll inside their container instead of breaking the page layout.
- **Clause Workspace** (`/bids/:id/clauses`, `pages/ClauseWorkspacePage.tsx`, `components/clauses/`): the only place clauses are reviewed. View state (saved view, facets, search, group-by, selected clause, verify layout) lives in the URL (`workspaceState.ts`); the list is virtualised with fixed row heights (`ClauseList.tsx`); Confirm needs the source viewed unless the clause is a clean spot-check; clauses in an unresolved conflict are resolved in `/bids/:id/conflicts`. Status chips always carry text (never colour alone).

### Invariant 5: LLM Gateway Resiliency & Bounded Concurrency

- Enforce bounded concurrency on parallel page windows (`LLM_MAX_CONCURRENCY`, default 8) to stay within in-flight credit caps (HTTP 402 "in-flight" backs off).
- Latency is output-bound (free models generate ~60–90 tokens/s): the extraction prompt asks for minified JSON with only `block_id`, `category`, `title` (≤8 words), `description` (≤30 words), `quote`, and `execution_rules` only when a formality applies (page/clause come from the block). `targeted_refine` asks only for corrections of the rejected candidates, never a re-extraction of the window. Concrete free models are tried before the `openrouter/free` router; a model answering "Reasoning is mandatory" is cooled down for 1 h, unusable output for 5 min, and a success never clears a cooldown set while it was running.
- Implement multi-model failover: HTTP 404 marks model permanently unavailable (`float("inf")`), HTTP 429 rests the endpoint for its `Retry-After` (bounded, default 60s) — per model for Groq/Cerebras/Gemini/SambaNova (`PER_MODEL_RATE_LIMIT_PROVIDERS`, their free-tier limits are per model), per provider for OpenRouter (`block_provider`); when everything is rate-limited the call waits up to `LLM_RATE_LIMIT_MAX_WAIT_SECONDS` (180s) for the soonest endpoint, HTTP 402 with in-flight limits backs off and retries, and HTTP 401/403 trips circuit breaker.
- **No fallback**: when no model gives a valid answer (unreachable, all providers 429/blocked, invalid JSON, no key) the call raises `LLMExtractionError`. A failed page window is marked `extraction_error`, escalated to review and listed in `DocumentExtractionResponse.failed_pages`; if every window fails the pipeline raises (the queue worker retries, then publishes `status=FAILED`; `/api/v1/extract` returns HTTP 503 `LLM_EXTRACTION_FAILED`). Evidence extraction returns `status=FAILED` with the reason. A valid empty answer (`[]`) is a legitimate result and is not retried.
- Every non-index page reaches the model (no keyword page filter), as every clause chunk of the window (no top-k). The model must copy each `verbatim_quote` exactly; quotes are never filled in from block text. Extraction calls use the lowest reasoning each model accepts (`reasoning_effort` "low" for gpt-oss, "none" for Gemini; OpenRouter `reasoning: {effort: "none"}`) and use `LLM_MAX_TOKENS` (4096); a model returning empty content with `finish_reason=length` is cooled down for 10 min; rotation stops at `LLM_TIMEOUT_SECONDS`.
- Routing (`route_verification_outcome`): `extraction_error` escalates directly; only _unintentional_ rejections count as failures (`intentional_rejections` = deleted clauses + candidates whose quote is covered by a verified item) and trigger up to 2 `targeted_refine` retries with the validation feedback. Validator number check covers the quote and the description. A model clause reference is kept when it agrees with the line-start structure path; otherwise the path wins.
- **Categories are enforced, never guessed**: providers in `STRICT_SCHEMA_PROVIDERS` (Cerebras) get the strict `CANDIDATES_SCHEMA` (category enum = `EXTRACTION_CATEGORIES`) so decoding cannot leave the taxonomy; the others get `json_object` (Groq rejects strict-schema mismatches with HTTP 400 after generating). An item that still carries an off-list category is re-asked once (`_recategorize`), not dropped; only items off the list after the re-ask are dropped.
- **Record / replay**: `LLM_REPLAY_MODE=record` saves raw responses to `apps/ai/tests/fixtures/llm_cassettes/<sha256(messages)>.json`; `replay` serves them offline (a missing recording is an explicit error). Tests inject `tests/fakes.py` (`FakeLLM`, `fake_llm_client`, `use_fake_llm`) and never reach a network.
- Aadhaar redaction requires a valid Verhoeff checksum or an Aadhaar/UID label, and never fires inside AWS account contexts (`amazonaws.com/`, `arn:aws`).

---

## 3. Automatic Documentation Synchronization Mandate

**Every change updates the docs it affects, in the same commit.** Docs are part of the change, not a follow-up: a commit that changes behaviour, setup, routes, schema, models or infrastructure without updating the matching document is incomplete.

1. **Update Corresponding Docs**: routes → `docs/API.md`; schema or migrations → `docs/DATABASE.md`; pipeline, prompts, models or rate limits → `docs/AI_PIPELINE.md`; services, queues, storage → `docs/ARCHITECTURE.md`; auth or isolation → `docs/SECURITY.md`; Terraform or CI → `docs/DEPLOYMENT.md`; local setup, env vars or gates → `docs/DEVELOPMENT.md`; the rules themselves → `AGENTS.md`. Keep `README.md` and `docs/README.md` accurate when documents are added or removed. Prefer updating an existing document over creating a new one.
2. **Document Decisions in Audits**: Record major architectural tradeoffs, root cause diagnoses, and benchmark results under `docs/audits/`.
3. **Preserve Codebase Integrity**: Never leave orphaned files, unused mock fixtures, or obsolete documentation.

---

## 4. Local Environment (macOS dev machine)

- **Python**: the only environment is `apps/ai/.venv`, built by `cd apps/ai && uv sync --extra dev` from `uv.lock`. Use `apps/ai/.venv/bin/{pytest,ruff,python}` or `uv run`. The root `.venv` is not used by any tooling.
- **Ruff**: only the `uv.lock` version (0.16.10) in `apps/ai/.venv`. Homebrew's `ruff` is a different version and formats differently; never use it.
- **Prettier**: config is `.prettierrc` + `.prettierignore` (single quotes, width 100). The `.claude/settings.json` hook (`scripts/format-on-edit.sh`) formats each edited file; never run a repo-wide `prettier --write`.
- **npm**: no proxy is configured or needed.
- **Dev servers** (`npm run dev`): AI 8000, API 3000, web 5173. Stop one by port (`lsof -ti :3000 | xargs kill`), never `pkill -f <pattern>`: the pattern matches the calling shell's own command line and kills it.
- **Test output**: API tests print logs only for failing tests (`silent: 'passed-only'`), so read the summary lines (`Test Files`, `Tests`) and failures only.
- **Phases**: each phase has a one-page spec in `docs/phaseN.md` (scope, acceptance tests, decisions) and ends with a commit, so a new or compacted session restarts from the spec and `git log`, not from the research report.

## 5. Verification & Testing Protocol

Before concluding any implementation turn, execute the relevant verification gates:

```bash
# 1. Python AI Worker (Formatting, Linting & Tests) — run from apps/ai
uv run ruff check src tests && uv run ruff format --check src tests
uv run pytest -m unit        # ~30 s, no PDFs, no network
pytest                # unit + realdoc (real tender PDFs); `live` tests are opt-in: pytest -m live
uv run python -m tenderpulse_ai.evaluation.benchmark --docs 02,04 --compare last   # extraction benchmark

# 2. Monorepo Package Builds
npm run build -w @tenderpulse/shared-types
npm run build -w @tenderpulse/api
npm run build -w @tenderpulse/web

# 3. Web & API Unit Test Suites
npm test -w @tenderpulse/web
npx vitest run apps/api/src/modules/compliance/application/__tests__/compliance-item.mapper.spec.ts

# 4. Browser tests (clause workspace U1–U14; starts its own API on a fresh demo DB + Vite)
npx playwright test
```
