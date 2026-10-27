# AI pipeline

How the worker (`apps/ai`) turns a tender PDF into verified, quoted obligations. The rules that must not be broken are in [AGENTS.md](../AGENTS.md) §2 (Invariants 1, 3 and 5). This document explains how the code meets them. For the queue around the worker, see [ARCHITECTURE.md](ARCHITECTURE.md) §3.

## 1. Principles

- **LLM-only extraction.** No rule, regex or synthetic producer creates an item. Code validates and normalizes model output (grounding, category mapping, whitespace), but never invents a title, quote, category or figure.
- **Every item is quoted.** The model must copy `quote` character for character from a tagged block. An item whose quote is not an exact substring of the page is rejected, never repaired from block text.
- **No fallback.** When no model gives a valid answer, the call raises `LLMExtractionError`. The page window is then marked failed and escalated, never filled with defaults.
- **Not stated means empty.** A value the tender does not state stays `null` all the way to the UI ("Not stated").

## 2. Stages

`extraction/orchestrator.py` (`ProductionExtractionPipeline.execute`) runs once per document:

1. **Pages.** The worker resolves the PDF (presigned URL or local path) into pages with Docling layout parsing and OCR (`OCR_LANGUAGES`). Pure table-of-contents and index pages are dropped. Every other page reaches the model; there is no keyword page filter.
2. **Document-level precompute (once, not per page).**
   - The Docling blocks are built into a structure tree (`PART > SECTION > CLAUSE`).
   - Running headers and footers (a line recurring on at least 30% of pages, minimum 3) are stripped.
   - The candidate detector and context assembler run here. They annotate passages; they do not decide what the model sees.
3. **Chunking.** `domain/tender_chunker.py` produces a 3-tier set: section skeletons, clause chunks (PROSE / CLAUSE / TABLE / HEADING) and their children. With `EMBEDDING_PROVIDER=local`, each chunk is embedded with fastembed `BAAI/bge-small-en-v1.5` (ONNX, CPU, downloaded once, about 67 MB). Vectors are tagged with the model name, and vectors from a different model are never mixed.
4. **Page windows.** Pages are grouped into windows of `BATCH_PAGE_WINDOW_SIZE` pages (capped at 3), and up to `LLM_MAX_CONCURRENCY` windows (default 8) run in parallel. Each window runs the LangGraph workflow below.
5. **Consolidation.**
   - Verified items are deduplicated across windows (`extraction/deduplication.py`).
   - Contradictions between clauses become conflict records (for example two PBG percentages, or EMD versus a bid-securing declaration).
   - Clause references are attributed from the tender's own line-start numbering, on the same page only (`extraction/clause_references.py`); otherwise the reference is `None`.
   - Bidder-task attributes (obligation type, stage, amount, deadline and so on) are kept only when they are a known enum value. Numbers are kept only when they literally appear in the quote (`domain/requirement_attributes.py`).
   - The result is compiled to OKF (`okf_compiler.py`) for the chat feature.
6. **Publish.** The `DocumentExtractionCompleted` event carries the items, conflicts, coverage (`failed_pages`) and chunks. It goes to the completion queue, using a claim-check when it is over 200 KB.

### LangGraph workflow (per window)

```
docling_parse → build_structure → candidate_detection → context_assembly
  → llm_extraction → validation → uncertainty_verification → confidence_routing
       ├─ postgres_store          (no unintentional rejections, score ≥ 0.80)
       ├─ targeted_refine ──► llm_extraction   (rejections, retry_count < 2)
       └─ escalate_human_review → human_review → postgres_store
```

- **The first four nodes** short-circuit, because the document-level precompute already filled their state.
- **`llm_extraction`.**
  - The model receives every clause chunk of the window from tenant-scoped retrieval, as `[B<n>]`-tagged blocks inside `<untrusted_document_data>`. Skeleton chunks, table renderings and tier-3 children are excluded, because only page-exact text is quotable.
  - The model answers in minified JSON: `block_id`, `category`, `title` (8 words or fewer), `description` (30 words or fewer), `quote`, and optional attributes. Page and clause come from the block.
- **`validation`.** Checks each item:
  - clamps the page number to the page that holds the quote;
  - normalizes whitespace;
  - checks grounding, with hyphenated line breaks rejoined and quotes that run across a page break stitched together;
  - rejects dangling fragments;
  - normalizes the category;
  - checks that every number in the description also appears in the quote.
- **`uncertainty_verification`.** Detects contradictions: PBG percentage, EMD versus bid-securing declaration, and GST inclusive versus exclusive.
- **`confidence_routing`** (`route_verification_outcome`).
  - A window with `extraction_error` escalates directly.
  - Only unintentional rejections count as failures. Deleted clauses, and candidates whose quote a verified item already covers, are intentional.
  - Failures trigger up to 2 `targeted_refine` rounds. These ask only for corrections of the rejected items and never re-extract the window.
- **`human_review`.** Uses LangGraph `interrupt()`. In the product, review happens in the clause workspace through the API (see §6).
- **`postgres_store`.** Hands the items to the persistence sink, which publishes them to the API. The worker never writes to PostgreSQL.

## 3. Model gateway

`infrastructure/llm/openai_compatible_client.py` is one OpenAI-compatible client that rotates across free tiers:

| Order | Provider                            | Models                                       | Notes                                      |
| ----- | ----------------------------------- | -------------------------------------------- | ------------------------------------------ |
| 1     | Cerebras                            | `gpt-oss-120b`                               | Strict JSON schema (see below)             |
| 2     | Groq                                | `openai/gpt-oss-120b`, `openai/gpt-oss-20b`  |                                            |
| 3     | Gemini (OpenAI-compatible endpoint) | `gemini-3.5-flash`, `gemini-3.1-flash-lite`  | Did most of the work in the last benchmark |
| 4     | SambaNova                           | `DeepSeek-V3.2`, `gpt-oss-120b`              | Often overloaded                           |
| 5     | OpenRouter                          | concrete free models, then `openrouter/free` | Disabled locally: the key is commented out |

A provider is used only when its key is set: `CEREBRAS_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `SAMBANOVA_API_KEY` or `OPENROUTER_API_KEY`.

qwen was removed from Cerebras and Groq on 2026-10-27. It was the fastest option, but it repeatedly missed core obligations; see [audits/MODEL_ROTATION_QUALITY_BENCHMARK.md](audits/MODEL_ROTATION_QUALITY_BENCHMARK.md).

### Rate limits

- **Per model** for Cerebras, Groq, Gemini and SambaNova, because their free-tier limits are per model. **Per provider** for OpenRouter.
- An HTTP 429 rests that model for the provider's `Retry-After` (bounded, 60 s by default) and rotates to the next endpoint.
- When every endpoint is rate-limited, the call waits for the soonest one to free up, within `LLM_RATE_LIMIT_MAX_WAIT_SECONDS` (180 s). Waiting does not count against the per-round rotation budget (`LLM_TIMEOUT_SECONDS`).

### Errors

| Response                                 | Effect                                                         |
| ---------------------------------------- | -------------------------------------------------------------- |
| HTTP 404                                 | The model is marked permanently unavailable                    |
| HTTP 401 / 403                           | Trips the breaker for that endpoint                            |
| HTTP 402 "in-flight"                     | Backs off and retries                                          |
| HTTP 400 "Reasoning is mandatory"        | The model is cooled down for 1 hour                            |
| Unusable output                          | The model is cooled down for 5 minutes                         |
| Empty output with `finish_reason=length` | The model is cooled down for 10 minutes                        |
| Timeout                                  | Rotates at once (no same-endpoint retry), with a 30 s cooldown |

### Other controls

- **Reasoning.** Extraction needs no chain-of-thought. The client sends the lowest effort each model accepts: `reasoning_effort: "low"` for gpt-oss and `"none"` for Gemini; OpenRouter gets `reasoning: {effort: "none"}`. `LLM_MAX_TOKENS` is 4096.
- **Category enforcement.**
  - Cerebras gets a strict JSON schema (`CANDIDATES_SCHEMA`) whose `category` enum is `EXTRACTION_CATEGORIES`: FINANCIAL, TECHNICAL, STATUTORY, LEGAL, OPERATIONAL, COMMERCIAL, EXECUTION. Decoding therefore cannot produce an off-list category.
  - Other providers get plain JSON mode. Groq rejects strict-schema mismatches with HTTP 400 after generating.
  - An item that still comes back with an off-list category is re-asked once for its category (`_recategorize`). It is dropped only if it is still off the list after that.
- **Record and replay.**
  - `LLM_REPLAY_MODE=record` saves raw responses to `tests/fixtures/llm_cassettes/<sha256(messages)>.json`.
  - `replay` serves them offline, and a missing recording is an error.
  - Unit tests use `tests/fakes.py` (`FakeLLM`) and never reach the network.

## 4. Retrieval

`tools/retrieval.py` (`ScopedRetrievalTool`) only ever sees chunks that are already filtered to the caller's tenant, company and allowed documents.

- **Sparse.** Okapi BM25 with procurement synonym expansion (for example EMD ↔ bid security).
- **Dense.** Cosine similarity over chunk embeddings, when the query embedder and the chunk vectors come from the same model.
- **Fusion.** Reciprocal Rank Fusion of the two rankings, with competition ranks for ties. Without embeddings, retrieval is BM25 only.

Extraction itself sends every clause chunk of a window, so ranking matters most for chat and bid-decision context.

## 5. Other AI features

| Endpoint                     | What it does                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/v1/agent/bid-decision` | LangGraph bid-or-no-bid engine ([ADR 0024](adr/0024-langgraph-bid-decision-engine.md)). Eligibility is evaluated deterministically in `decision/evaluator.py`; the model never issues a verdict or computes money. |
| `/api/v1/evidence/extract`   | Extracts attributes from company evidence (certificates, financials) with the same LLM-only and grounding rules (`domain/evidence_extractor.py`). On failure it returns `status=FAILED` with the reason.           |
| `/api/v1/chat/query`         | Tender chat over the compiled OKF and scoped retrieval, with citations.                                                                                                                                            |
| `corrigendum/`               | Diffs amendments against the original tender and reports their impact.                                                                                                                                             |

## 6. Human review

The UI never derives a status from a category or a model score. Every clause starts as `UNREVIEWED`. A reviewer confirms, corrects or rejects it in the clause workspace (`/bids/:id/clauses`). Confirming needs the source viewed, unless the clause is a clean spot-check. Re-extraction never overwrites a review, because clauses are matched by location (see [ARCHITECTURE.md](ARCHITECTURE.md) §3). Unresolved conflicts are handled on `/bids/:id/conflicts`.

## 7. Measuring quality and speed

- **Tests.** `uv run pytest -m unit` runs the fast unit suite (no PDFs, no network). `pytest` also runs the `realdoc` tests against the real tender PDFs in `data/procurement-evidence`. `live` tests call real providers and run only with `-m live`.
- **Benchmark.** `uv run python -m tenderpulse_ai.evaluation.benchmark --docs 02,04 --compare last` runs the production pipeline on real PDFs. It writes `.bench/<timestamp>.json` and prints a before/after table with the reasons candidates were rejected. Parsed pages are cached per PDF hash in `.cache/pages`.
- **Live runs.** Reprocess a document through the dev stack, then compare its `compliance_items` across runs by location. Run-to-run agreement between two runs of the same model mix is the baseline that a change must not fall below. The 2026-10-27 benchmark uses this method.

Benchmarks and decisions are recorded in [audits/](audits/).
