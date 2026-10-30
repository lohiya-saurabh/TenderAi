# AI pipeline

This document explains how the AI worker (`apps/ai`) turns a tender PDF into verified obligations, each with an exact quote and a page. It covers every stage in the order a document goes through it: what each stage does, which file does it, and the thresholds involved.

The rules that must never be broken are in [AGENTS.md](../AGENTS.md) §2 (Invariants 1, 3 and 5); this document shows how the code meets them. How a job reaches the worker and how its result is persisted is in [ARCHITECTURE.md](ARCHITECTURE.md) §5.

Contents:

1. Principles
2. The pipeline at a glance
3. Stage by stage
4. The LangGraph workflow (one page window)
5. Model gateway
6. Retrieval and embeddings
7. Consolidation
8. Output and coverage
9. Other AI features
10. Human review
11. Configuration
12. Performance
13. Testing and benchmarking
14. Known limitations

---

## 1. Principles

| Principle                     | How the code enforces it                                                                                                                                                                                                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LLM-only extraction**       | No rule, regex or synthetic producer creates an item, for tenders (`workflow/nodes.py` `llm_extraction`) or company evidence (`domain/evidence_extractor.py`). Code validates and normalizes model output; it never invents a title, quote, category or figure. No code contains tender-specific phrases, figures or agency names. |
| **Every item is quoted**      | The model must copy `quote` character for character from a tagged block. An item whose quote is not a substring of the page is rejected, never repaired from block text.                                                                                                                                                           |
| **No fallback**               | When no model gives a valid answer, the call raises `LLMExtractionError`. The page window is marked failed, its pages are listed in coverage, and nothing is filled with defaults. A valid empty answer (`{"candidates":[]}`) is a legitimate result and is not retried.                                                           |
| **Not stated means empty**    | Attributes and figures are kept only when the quote states them; otherwise the value is `null` ("Not stated" in the UI).                                                                                                                                                                                                           |
| **Documents are untrusted**   | Page text and anything echoing it reaches the model inside untrusted-data tags with a security directive ([SECURITY.md](SECURITY.md) §4).                                                                                                                                                                                          |
| **The model does not decide** | The model never issues a verdict, computes money or sets a review status.                                                                                                                                                                                                                                                          |

## 2. The pipeline at a glance

```
 PDF (presigned URL)
  │  domain/pdf_resolver.py, domain/pdf_layout.py
  ▼
 Page text ── PDFium text layer · ruled tables row by row (pdfplumber) · Tesseract OCR for scans
  │  domain/docling_parser.py
  ▼
 Blocks ── paragraphs / headings / table rows · running headers removed · hyphenation rejoined
  │       · sentences stitched across page breaks
  │  domain/structure_builder.py
  ▼
 Clause tree ── PART > CLAUSE > sub-clause from line-start markers only
  │  domain/tender_chunker.py           domain/candidate_detector.py, context_assembler.py
  ▼                                     ▼
 3-tier chunks (+ embeddings)          candidate passages + clause contexts (used by validation)
  │  extraction/orchestrator.py
  ▼
 Page windows (3 pages, TOC pages dropped) ── up to 8 in parallel
  │  workflow/graph.py (one LangGraph run per window)
  ▼
 llm_extraction → validation → uncertainty_verification → confidence_routing
      ▲                                                     │
      └──────── targeted_refine (≤ 2) ◄─────────────────────┤
                                                            ├─► postgres_store (publish)
                                                            └─► escalate → human_review
  │  extraction/clause_references.py, deduplication.py, okf_compiler.py
  ▼
 Clause references · cross-window dedup · contradictions → conflicts · OKF
  ▼
 DocumentExtractionCompleted {items, chunks, conflicts, coverage}
```

The whole document is parsed, structured and chunked **once**, before any page window starts. The windows reuse that state, so per-window LangGraph nodes for parsing and structure return immediately.

## 3. Stage by stage

### 3.1 Resolving the PDF (`domain/pdf_resolver.py`)

`resolve_pdf_to_pages(download_url, document_id, file_name)` works as follows:

- **Download.** It downloads the presigned URL with a 45 s timeout and follows redirects. It aborts above **150 MB** (`MAX_DOCUMENT_SIZE_BYTES`).
- **Local files.** For a mock-storage URL or a local path, it looks the file up among the local samples instead.
- **Requirement.** `pypdfium2` must be installed; without it there is no page text.

### 3.2 Page text (`domain/pdf_layout.py`)

`extract_layout_pages(pdf_path, OCR_LANGUAGES)` returns one string per physical page:

1. **PDFium text layer** for every page.
2. **Ruled tables, row by row.** PDFium reads a ruled multi-column table column by column, which interleaves the cells of neighbouring columns. For pages with a text layer (at least 20 characters) and ruling lines, pdfplumber re-renders each table as `cell | cell | cell`. A table row that continues across a page break is joined.
3. **OCR for image-only pages** (fewer than 20 characters of text). Pages are rendered at 300 DPI in greyscale, one at a time, because PDFium rendering is not thread-safe. Tesseract then OCRs them in up to 4 parallel processes.

Every step degrades gracefully: without pdfplumber or the `tesseract` binary, the plain PDFium text is returned.

### 3.3 Blocks (`domain/docling_parser.py`)

`DoclingParserEngine.parse_document(pages=…)` turns page text into `DoclingBlock`s (`paragraph`, `heading`, `table_row`) and `DoclingTable`s. It uses Docling's data model, but its input is the page text from §3.2. The native Docling `DocumentConverter` is only used when a file path is parsed directly, which the production pipeline does not do.

- **Running furniture removed.** A line whose digit-normalized form recurs on at least 30% of pages (minimum 3) is a header or footer, whatever the issuer; examples are document reference codes and page numbering.
- **Dehyphenation and paragraph joining.** A numbered line whose sentence wraps onto a lowercase next line is kept as one paragraph.
- **Tables** are detected from pipe tables or whitespace-aligned column layouts (at least 2 consecutive lines with the same multi-space layout), with lead-in and header patterns. A table may continue from the previous page only if that page ended inside it.
- **Cross-page stitching** joins a sentence that continues on the next page, so a quote spanning a page break stays groundable.
- **Deleted clauses** ("Deleted", "Not used", …) are recognised (`is_clause_deleted`), so items from them are rejected later.

### 3.4 Clause tree (`domain/structure_builder.py`)

`DocumentStructureBuilder` builds a `DocumentStructureTree` of `SectionNode`s. A `ClauseTracker` walks the blocks in reading order and keeps a parent stack (division > main clause > section letter > sub-item), using **only line-start markers**:

- **Main clauses.** `Clause 5`, `Article IV`, `Section 2.3`, `Schedule`, `Rule`, `Para`, `PQ` keywords, or a bare `4.2.1.` / `3)` followed by a capitalised word. Dates (`12.03.2026`) and thousands (`1.500`) are excluded.
- **Sub-clauses.** `A. Eligibility`, `Note: (1)`, `(b) In addition`, `xv. Providing`, `a. The selected`.
- **Divisions.** An unnumbered all-caps heading starts a new part, whose numbering is independent.

A mention in the middle of a sentence ("as per Annexure-III", "circular no. 18.75/2021") can never become a clause's identity. A bare number that runs backwards (a "1." inside Clause 13's eligibility table) becomes a sub-item, not a reset.

### 3.5 Chunks (`domain/tender_chunker.py`)

`TenderChunker` (Hierarchical Contextual Semantic Chunking) produces three tiers:

| Tier             | `chunk_type`                                         | Content                                                                                                                                | Used for                                                                        |
| ---------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `TIER1_SKELETON` | `SKELETON`, `TABLE_SKELETON`                         | Section outline, table outline, document summary                                                                                       | Retrieval context only; never quotable                                          |
| `TIER2_PARENT`   | `CLAUSE` (with a clause ref) or `PROSE`, also tables | The clause text with a hierarchy prefix. Target 1,200 characters, maximum 2,000, overlap 150; splits on clause and sentence boundaries | **What the extraction model sees**, and what is persisted for the source viewer |
| `TIER3_CHILD`    | sentence                                             | One sentence (15 characters or more) of a parent                                                                                       | Fine-grained retrieval; expanded back to the parent                             |

Each chunk carries page, section title, clause reference, bounding box, `parent_id`, `canonical_ref_id` and metadata. All chunks are sent back in the completion event, and the API stores them in `tender_document_chunks`.

### 3.6 Candidates and contexts

- **`CandidateDetector`** (`domain/candidate_detector.py`) scores passages against about 25 procurement rule families:
  - financial security, financial thresholds, eligibility restrictions, mandatory documents;
  - deadlines, damages and penalties, dispute resolution, insurance;
  - maintenance SLAs, statutory permits, execution rules, deontic modals (`shall` / `must`);
  - table metric rows and others.

  It also does context fusion: a section title plus block text, so unkeyworded clauses inside requirement sections still score. It assigns a 0–1 priority and splits passages into `PRIMARY` and `RESCUE` tiers.

- **`ContextAssembler`** (`domain/context_assembler.py`) builds a context per clause: preceding and following clauses, definitions and cross-references (`REF_PATTERN`, `DEF_PATTERN`). The cross-reference resolver links "as per Clause X".

These **do not filter what the model sees**: every clause chunk of a window goes to the model (§4.1). The validator uses the assembled contexts to judge an item against the clause that holds its quote (§4.2).

### 3.7 Page windows (`extraction/orchestrator.py`)

- **Drop index pages.** Pure table-of-contents and index pages (`is_pure_toc_page`) are removed. Every other page is processed; there is no keyword page filter. If every page looks like an index, all pages are kept.
- **Group pages.** The remaining pages are grouped into windows of `BATCH_PAGE_WINDOW_SIZE` pages (capped at 3).
- **Run in parallel.** Windows run concurrently under a semaphore of `LLM_MAX_CONCURRENCY` (default 8).
- **Per-window setup.** Each window gets its own tenant-scoped `ScopedRetrievalTool`, seeded with that window's chunks. Seeding embeds them with the local model, off the event loop. The window also gets a `PageTextTool` with the raw page text, and the text of the following page (`continuation_text`), so a sentence running past the window's last page break still grounds.
- **Thread id.** Each window's LangGraph run uses `tenant_<t>:company_<c>:run_<r>:bid_<b>:doc_<d>:pages_<p1-p2-p3>`.

## 4. The LangGraph workflow (one page window)

`workflow/graph.py` builds the graph and compiles it with a `MemorySaver` checkpointer:

```
START → docling_parse → build_structure → candidate_detection → context_assembly
      → llm_extraction → validation → uncertainty_verification → confidence_routing
confidence_routing ─┬─ postgres_store          → END
                    ├─ targeted_refine → llm_extraction
                    └─ escalate_human_review → human_review → postgres_store → END
```

The first four nodes find their results already in the state (document-level precompute) and return immediately.

### 4.1 `llm_extraction`

**1. Blocks.** The node retrieves every chunk of the window from the scoped retrieval tool (`top_k=10_000`, tenant- and document-scoped). It keeps only `TIER2_PARENT` chunks that are not tables, sorted by page and chunk id:

- skeletons are generated outlines;
- table renderings repeat rows that already appear verbatim in the clause chunks;
- tier-3 children repeat their parent's sentences.

Only page-exact text is quotable. Each chunk becomes a block `[B<n>] [Page <p> | <clause ref>]:` followed by its text, wrapped in `<untrusted_document_data document_id=… page=…>`. The `B<n>` id maps back to the chunk's page, clause reference and chunk id (`block_map`). This saves output tokens, because the model never repeats page or clause. If a window has no chunks, its raw paragraphs are used as blocks.

**2. System prompt.** Seven sections:

| #   | Section         | Content                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Scope           | Bidder eligibility and qualification (EMD, PBG, turnover, net worth, similar work, PoA, integrity pact, non-blacklisting, PPP-MII, GSTIN) and contract-execution covenants (conditions precedent, COD, milestones, LD formula and caps, escrow, insurance, arbitration, SLAs, clearances)                                                                                               |
| 2   | Exclusions      | No TOC/index/dot-leader lines; no bare definitions; nothing binding only third parties (the Authority's own engineers); no definitional exclusions; no fragments or isolated table notes                                                                                                                                                                                                |
| 3   | Self-contained  | Every description is plain language and resolves references like "Sr. No. 1 & 2" or "Table above"                                                                                                                                                                                                                                                                                       |
| 4   | Execution rules | Stamp paper and denomination, notarization, CA UDIN, SFMS MT760 bank-guarantee confirmation                                                                                                                                                                                                                                                                                             |
| 5   | Verbatim quotes | The quote is the complete sentence(s), copied exactly from the block; anything that is not an exact substring is rejected                                                                                                                                                                                                                                                               |
| 6   | Output format   | Minified JSON (output length is the main cost and latency driver): `{"candidates":[{block_id, category, title ≤ 8 words, description ≤ 30 words, quote}]}`. Optional `execution_rules` and attributes (`obligation`, `action`, `stage`, `parties`, `mandatory`, `disqualifying`, `deadline`, `amount`, `form_ref`) only when the quote states them; page and clause come from the block |
| 7   | Security        | `UNTRUSTED_DATA_DIRECTIVE`                                                                                                                                                                                                                                                                                                                                                              |

**3. Refinement prompt.** On a refine round (`retry_count > 0`), the user prompt adds the rejected candidates (title and up to 300 characters of quote, up to 20 items) and the validation reasons (up to 1,500 characters), all wrapped as `<untrusted_context source="verification_feedback">`. It asks **only for corrected versions of the rejected items**, with `{"candidates":[]}` if none. Accepted items are already in the state, so the window is never re-extracted.

**4. Call.** The node calls `extract_compliance(system, user, block_map)`. This goes through `StructuredLLMClient`, which scrubs secrets from the prompt first, then the multi-provider gateway (§5). A `LLMExtractionError` sets `extraction_error` on the state.

**5. Parsing** (`_parse_response`, `_build_candidate`):

- Markdown fences are stripped.
- The candidate list is taken from `candidates`, `items` or `requirements`, or from a bare array.
- **Truncated JSON** (cut off at `max_tokens`) is salvaged object by object (`_recover_truncated_json`) instead of being discarded.
- Each item is resolved through `block_map` to page, clause reference and source chunk. The quote is whitespace-cleaned; an item without a title or a quote is skipped.
- The category is normalized against the taxonomy and its aliases. An **off-list category** is collected and re-asked (§5.4), never guessed.
- Attributes are parsed with `parse_attributes` (§7.3).
- `confidence_score` stays empty until validation.

### 4.2 `validation`

Each candidate goes through these checks in order (`workflow/nodes.py`, `agent/validation.py`, `domain/validator.py`):

| #   | Check           | Rejects when                                                                                                                                                                                                                         |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Page clamping   | The page is moved to the page in the window that actually contains the quote                                                                                                                                                         |
| 2   | Whitespace      | (normalizes quote and description)                                                                                                                                                                                                   |
| 2b  | Deleted clause  | The quote, its clause reference, or its parent section is a deleted or omitted clause. This is an **intentional** rejection                                                                                                          |
| 3   | Grounding       | The quote is not a substring of the window's text, compared case- and whitespace-insensitively. Hyphenated line breaks are rejoined and page-break continuations stitched; the parsed blocks and the next page's text are also tried |
| 4   | Fragment        | The quote starts lowercase (other than list markers like `a.`, `(i)`), starts with a dangling conjunction or predicate, or is a contextless table footnote                                                                           |
| 5   | Category        | Not in the taxonomy                                                                                                                                                                                                                  |
| —   | Execution rules | Stamp paper is required without a positive denomination                                                                                                                                                                              |

**Deterministic score.** `DeterministicValidator.validate_item` scores the item against the clause context that holds the quote. The score starts at 1.0, and each penalty is subtracted:

| Penalty | Condition                                                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| −0.25   | Citation not supported by the clause text                                                                                                           |
| −0.15   | A referenced clause number does not exist in the tree                                                                                               |
| −0.20   | A number in the quote, or a number in the description that is not in the quote, does not appear in the source clause (catches hallucinated amounts) |
| −0.30   | The clause says "shall not" / "must not" but the description reads as affirmative                                                                   |
| −0.10   | The clause has an exception ("except", "unless", "provided that", "subject to") that the description drops                                          |

The resulting tier is `AUTO_ACCEPT` at 0.95 or above, `REVIEWER_VERIFICATION` at 0.80 or above, and `MANDATORY_HUMAN_REVIEW` below that. The model is never asked for a confidence; this deterministic score is the only per-item score, and it is stored as `provenance.confidenceScore`.

- **Verified items** are those that passed grounding, rules, fragment and category checks.
- **Intentional rejections** are deleted clauses, plus rejected candidates whose quote is already covered by a verified item; these lost nothing.
- **New verified items are deduplicated** against those from earlier rounds by location: `(page, normalized quote)`, never title.
- **The node's outputs** are the window's average score and the joined failure reasons, which become the refinement feedback.

### 4.3 `uncertainty_verification`

Per-window contradiction detectors:

- a PBG percentage stated differently (for example 3% against 10%);
- an EMD against a bid-securing declaration;
- GST inclusive against exclusive pricing.

Document-wide contradiction detection runs again after consolidation (§7.2).

### 4.4 `confidence_routing` and `route_verification_outcome`

```
failed = unverified − intentional_rejections
if extraction_error                  → escalate_human_review
elif failed ≤ 0 and score ≥ 0.80     → postgres_store
elif failed > 0 and retry_count < 2  → targeted_refine   (retry_count += 1, back to llm_extraction)
else                                 → escalate_human_review
```

`confidence_routing` also records the tier for the window:

- `AUTO_ACCEPT` when `failed ≤ 0` and the score is 0.95 or more;
- `REVIEWER_VERIFICATION` when `failed ≤ 0` and the score is 0.80 or more;
- otherwise `MANDATORY_HUMAN_REVIEW`.

### 4.5 `escalate_human_review`, `human_review`, `postgres_store`

- **`escalate_human_review`** sets `human_review_required` and the status `AWAITING_HUMAN_REVIEW`.
- **`human_review`** calls LangGraph `interrupt()` with the items. In the batch pipeline this pauses that window's run. The orchestrator takes the verified items from the paused state and marks the document for review. The actual review happens later in the clause workspace (§10). A resumed review payload (`APPROVE` / `EDIT`) must carry the same tenant.
- **`postgres_store`** hands the verified items to the persistence sink. The worker never writes to PostgreSQL itself; the items travel in the completion event.

## 5. Model gateway (`infrastructure/llm/openai_compatible_client.py`)

One OpenAI-compatible client rotates across the free tiers whose keys are set. `LLM_PROVIDER=rotation` is the default; a single provider name restricts the client to that provider.

### 5.1 Endpoints and order

| Order | Provider   | Base URL                                          | Models (in order)                                               |
| ----- | ---------- | ------------------------------------------------- | --------------------------------------------------------------- |
| 1     | Cerebras   | `api.cerebras.ai/v1`                              | `gpt-oss-120b`                                                  |
| 2     | Groq       | `api.groq.com/openai/v1`                          | `openai/gpt-oss-120b`, `openai/gpt-oss-20b`                     |
| 3     | Gemini     | `generativelanguage.googleapis.com/v1beta/openai` | `gemini-3.5-flash`, `gemini-3.1-flash-lite`                     |
| 4     | SambaNova  | `api.sambanova.ai/v1`                             | `DeepSeek-V3.2`, `gpt-oss-120b`                                 |
| 5     | OpenRouter | `openrouter.ai/api/v1`                            | concrete free models, then `openrouter/free` (disabled locally) |

**Why no qwen.** qwen was removed from Cerebras and Groq on 2026-10-27. Despite 450 req/min it consistently missed core obligations, such as the turnover and performance-security requirements, that other runs agree on. See [audits/MODEL_ROTATION_QUALITY_BENCHMARK.md](audits/MODEL_ROTATION_QUALITY_BENCHMARK.md).

**Candidate order.** Each round, `_get_candidate_endpoints` builds the list as follows:

- rate-limited endpoints are skipped;
- endpoints not cooling down come first, in the order above;
- endpoints whose cooldown has not expired come last;
- permanently unavailable endpoints are dropped.

### 5.2 The call loop (`complete_structured`)

```
payload = {model, messages, response_format, max_tokens: 4096, temperature: 0}
loop:
  for each candidate endpoint:
      skip if rate-limited
      stop the round if the rotation budget (LLM_TIMEOUT_SECONDS) is spent after an error
      set response_format (strict schema for Cerebras, else json_object) and reasoning controls
      POST /chat/completions (retries per endpoint: max_retries)
      handle status (table below); on success: parse → return
  if the round was cut short and wall time < budget: run another round
  wait = soonest time any rate-limited endpoint frees up
  if none, or elapsed + wait > LLM_RATE_LIMIT_MAX_WAIT_SECONDS (180 s): raise LLMExtractionError
  sleep(wait + jitter 0.2–1.5 s)          # jitter keeps parallel windows from retrying in lockstep
```

Waiting for a rate limit does not count against the rotation budget, which resets each round.

| Response                                   | Action                                                                                                                                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 200 with parseable content                 | Return (and record the response under `LLM_REPLAY_MODE=record`)                                                                                                                                                                                    |
| 200, empty content, `finish_reason=length` | Model cooled down 10 min (it spent `max_tokens` on reasoning); rotate                                                                                                                                                                              |
| 200, unparseable content                   | Model cooled down 5 min; rotate                                                                                                                                                                                                                    |
| 429                                        | Rest for `Retry-After`, clamped to 1–60 s (60 s if absent). The rest applies to **the model** for Cerebras, Groq, Gemini and SambaNova, whose limits are per model, and to the **whole provider** for OpenRouter, whose limits are per key. Rotate |
| 404                                        | Model marked permanently unavailable                                                                                                                                                                                                               |
| 401 / 403                                  | Endpoint marked unavailable; raised if no other provider exists                                                                                                                                                                                    |
| 402 "in-flight"                            | Back off 1.5 s × attempt and retry the same endpoint                                                                                                                                                                                               |
| 400 / 402 other                            | Model cooled down 5 min, or 1 h for "Reasoning is mandatory"; rotate                                                                                                                                                                               |
| 500 / 502 / 503 / 504                      | Retry with backoff 0.5 s × 2^attempt, then rotate                                                                                                                                                                                                  |
| Timeout                                    | Rotate at once without retrying the same endpoint, and rest it 30 s (`TRANSIENT_ERROR_COOLDOWN_SECONDS`)                                                                                                                                           |
| Network error                              | Retry with backoff, then rest 30 s                                                                                                                                                                                                                 |

A success never clears a cooldown that was set while the request was running.

### 5.3 Reasoning controls

JSON extraction needs no chain-of-thought. Left at their defaults, reasoning models spend most of `max_tokens` on hidden reasoning. `apply_reasoning_controls` therefore sets the lowest effort each model accepts, and clears whatever the previous endpoint had set:

| Model                               | Setting                                        | Measured effect (2026-10-27) |
| ----------------------------------- | ---------------------------------------------- | ---------------------------- |
| gpt-oss (Cerebras, Groq, SambaNova) | `reasoning_effort: "low"` (`none` is rejected) | 369 → 38 reasoning tokens    |
| Gemini                              | `reasoning_effort: "none"`                     | 8.0 s → 2.9 s per call       |
| OpenRouter                          | `reasoning: {effort: "none", exclude: true}`   | —                            |
| DeepSeek                            | none sent                                      | —                            |

### 5.4 Category enforcement

- **Taxonomy.** `EXTRACTION_CATEGORIES` = FINANCIAL, TECHNICAL, STATUTORY, LEGAL, OPERATIONAL, COMMERCIAL, EXECUTION (`agent/validation.py`). The prompt's category list is built from it.
- **Strict schema for Cerebras.** Providers in `STRICT_SCHEMA_PROVIDERS` (Cerebras) get `response_format: {type: "json_schema", strict: true, schema: CANDIDATES_SCHEMA}`. The schema fixes the category enum and the attribute enums (`OBLIGATION_TYPES`, `ACTIONS`, `STAGES`, `PARTIES`, `MANDATORY`, `DEADLINE_ANCHORS`), with `additionalProperties: false` throughout. Optional keys stay optional, so the model still omits what the quote does not state. Decoding is constrained, so an off-list category cannot be produced.
- **Plain JSON mode elsewhere.** The others get `json_object`. Groq validates a strict schema only after generating and answers HTTP 400 on a mismatch, which would cost a 5-minute cooldown. Gemini accepted a non-strict schema but did not reliably enforce it.
- **Re-ask.** An item that still has an off-list category goes to `_recategorize`: one small call listing those items (as untrusted context) and asking for the same items with only the category corrected. Items still off the list after that are dropped with a warning. If the re-ask fails, only those items are lost; the valid items are kept.

**Why this exists.** The prompt also lists `ELIGIBILITY|DOCUMENT|PENALTY` as `obligation` values, and qwen copied them into `category`. That cost 22 dropped items over two documents before this fix.

### 5.5 Record and replay (`infrastructure/llm/replay.py`)

- **`LLM_REPLAY_MODE=record`** saves each raw response to `tests/fixtures/llm_cassettes/<sha256(messages)>.json` (or `LLM_REPLAY_DIR`).
- **`replay`** serves responses from those files without network access. A missing recording is an explicit error, never a silent call.
- **Unit tests** inject `tests/fakes.py` (`FakeLLM`, `fake_llm_client`, `use_fake_llm`) and never reach a network.

## 6. Retrieval and embeddings

### 6.1 Embeddings (`infrastructure/embeddings/local_embedder.py`)

- **Model.** `EMBEDDING_PROVIDER=local` loads fastembed `BAAI/bge-small-en-v1.5`: ONNX on CPU, downloaded once (about 67 MB) into `EMBEDDING_CACHE_DIR` or fastembed's default.
- **Concurrency.** A single process-wide instance serializes inference, because fastembed is not documented as thread-safe.
- **Model tags.** Chunks are embedded when a window's retrieval tool is seeded, and each vector is tagged with its model name (`metadata.embedding_model`). A vector from a different model is ignored, never mixed with others.
- **Without embeddings.** If loading or embedding fails, or the provider is `none`, retrieval is BM25-only.
- **Storage.** The vectors travel in the completion event and are stored as JSONB in `tender_document_chunks.embedding`.

### 6.2 Scoped retrieval (`tools/retrieval.py`)

`ScopedRetrievalTool.retrieve(security_context, target_document_id, query, top_k)` works in seven steps:

1. **Rate limit.** At most 15 calls per workflow run.
2. **Anti-IDOR.** `target_document_id` must be in `security_context.allowed_document_ids`, otherwise `UnauthorizedDocumentAccessException`.
3. **Tenant isolation.** Only chunks whose `tenant_id` and `document_id` match are considered.
4. **Sparse ranking.** Okapi BM25 (k1 = 1.5, b = 0.75), with the query expanded by procurement synonym groups; for example `emd` ↔ "earnest money deposit" ↔ "bid security". Synonym terms weigh 0.6. Child chunks get a 5% edge when parents are not expanded.
5. **Dense ranking.** Cosine similarity, only when real vectors from the same model exist; there is no proxy score, so RRF never double-counts BM25.
6. **Fusion.** Reciprocal Rank Fusion, `RRF(d) = 1/(60 + rank_dense) + 1/(60 + rank_sparse)`. Competition ranks are used, so equal scores share a rank. Ties break by dense rank, then BM25 rank, then id, so repeated runs return the same chunks.
7. **Rerank and expand.** A deterministic reranker picks the final `top_k` from the top 20; `expand_to_parent` replaces tier-3 children with their parent.

Company evidence retrieval follows the same steps over the tenant's evidence chunks.

## 7. Consolidation (after all windows)

### 7.1 Clause references (`extraction/clause_references.py`)

1. **Positional attribution.** A missing or generic reference is filled from the structure-tree path of the block that holds the quote.
2. **Page attribution.** The tender's own line-start number in front of the quote, on the same page, is authoritative. A model reference is kept only when it agrees with that structure (for example "Clause 5(xix) (Page 4)" agrees with the path "Clause 5(xix)" or a parent or child of it). Otherwise the structure wins, and if there is none the reference is `None`, never "Page N".

### 7.2 Deduplication and contradictions (`extraction/deduplication.py`)

**`consolidate_verified_items`** merges the same obligation emitted by several windows. Similarity is measured as **quote overlap**: shared content words divided by the size of the smaller quote (1.0 when one quote contains the other).

| Match                      | Rule                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cross-category fingerprint | The same obligation under two categories (for example turnover as FINANCIAL and as TECHNICAL), on the same or adjacent page. The more specific category wins |
| Same title in a category   | A duplicate only when it is the same text or the same page. "Performance Security" in the ITB and in the SCC stay separate                                   |
| Quote overlap              | Overlap of at least 0.65 within a category (higher for focus sentences), on a different page or with related titles                                          |
| Never merged               | Items stating contradictory terms (3% against 10% PBG; EMD against bid-securing declaration)                                                                 |

**Merging.**

- **Fields move together.** Title, category, description, quote and reference are taken together from the winning item, so a merge never pairs one rule's title with another rule's description.
- **Rule flags.** A required value wins over "not required", and "not stated" never overrides a stated value.
- **Attributes.** A stated attribute is never replaced by "not stated".
- **Supporting pages** accumulate. Items end in document reading order (`docOrder`).

**`detect_clause_contradictions`** runs over the consolidated items:

- PBG percentage conflicts;
- EMD or bid-security amounts stated differently;
- EMD against a bid-securing declaration;
- GST pricing treatment.

Each contradiction becomes a **conflict** whose values link to the clauses (`itemKey`) that state them. Only conflicts with at least two values are kept. The generated `aiPrecedenceNote` is labelled "AI suggestion" in the UI and never mixed with quotes.

### 7.3 Grounded attributes (`domain/requirement_attributes.py`)

`parse_attributes(raw, quote)` keeps a value only when it passes these checks:

| Attribute                                                 | Kept when                                                                                                                  |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `obligation`, `action`, `stage`, `mandatory`, `parties[]` | The value is a known enum value (`OBLIGATION_TYPES`, `ACTIONS`, `STAGES`, `MANDATORY`, `PARTIES`)                          |
| `disqualifying`                                           | Explicitly `true`                                                                                                          |
| `form_ref`                                                | The reference appears in the quote                                                                                         |
| `deadline`                                                | Absolute: every number of the date appears in the quote. Relative: the anchor is known and the offset appears in the quote |
| `amount`                                                  | INR is greater than 0 and appears in the quote; a percentage is in (0, 100] and appears in the quote                       |

Numbers must be **written** in the quote: "1,50,000", "150000", "1.5" or "5%". Amounts in words, or "1.5 crore", are not converted. The attribute is dropped and the user reads the quote, rather than a derived figure.

### 7.4 OKF (`extraction/okf_compiler.py`)

The consolidated items and contradictions are compiled into an Open Knowledge Format bundle. It is registered for the bid (`chat/okf_registry.py`) and used by tender chat.

## 8. Output and coverage

The pipeline returns `DocumentExtractionResponse`, and the worker turns it into the completion event ([ARCHITECTURE.md](ARCHITECTURE.md) §5.5):

- **`items`.** Consolidated clauses with `itemKey`, `docOrder`, provenance, attributes, execution rules and flags. The flags are:
  - `NEAR_FAILED_PAGE`: a neighbouring page failed;
  - `CONFLICT`: the clause states a value in a conflict.
- **`chunks`.** All three tiers, with embeddings.
- **`conflicts`.** As in §7.2.
- **`coverage`.** `{pageCount, failedPages: [{page, reason: "LLM_EXTRACTION_FAILED"}], status}`, with `status` set to `PARTIAL` when any window failed.
- **When every window fails**, the pipeline raises. The worker retries the job and, on the 3rd attempt, publishes `FAILED`.

## 9. Other AI features

| Endpoint                          | Engine                                             | How it works                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/agent/bid-decision` | `decision/workflow` (LangGraph)                    | `evidence_retrieval` → `deterministic_evaluation` → `commercial_risk` → `review_routing` → (`human_review_gate`) → `executive_synthesis`. `decision/evaluator.py` takes thresholds only from the structured criterion or the clause's own quote (including "N% of the estimated cost"). An unstated turnover threshold is a "check manually" gap, so the verdict can't be a plain GO; there are no 40%, 35% or fixed defaults. It checks geography, turnover, experience, certifications, OEM, staffing, equipment and mandatory submissions against the company profile. It produces the verdict (`GO`, `CONDITIONAL_GO` or `NO_GO`) with reasons, gaps, disqualifiers and evidence citations. `decision/risks.py` adds timeline and commercial risks. The model only writes the executive memo explaining the deterministic verdict, through the provider rotation (left empty if no model answers, never a canned text); titles and reasons from documents are wrapped as untrusted context |
| `POST /api/v1/evidence/extract`   | `domain/evidence_extractor.py`                     | Company evidence (CA turnover certificates, balance sheets, work orders and completion certificates, ISO certificates, registrations) in categories `FINANCIAL_TURNOVER`, `PROJECT_EXPERIENCE`, `CERTIFICATION`, `REGISTRATION` and `GENERAL`. Every attribute comes with its verbatim quote and is dropped if the quote or value is not found on the stated page. Crores are parsed from the quoted amount. File name and declared type are treated as untrusted. No model answer means `status=FAILED` with the reason; the API then marks the document `NEEDS_REVIEW` with that reason, with no local regex extraction                                                                                                                                                                                                                                                                                                                                                                      |
| `POST /api/v1/chat/query`         | `chat/workflow.py` (LangGraph)                     | `intent_routing` → `tool_calling` → (`query_rewrite`) → `citation_generation` → `uncertainty_verification` → `response_synthesis`. Tools: tender search, evidence search, company profile and financials, financial capacity, experience, compliance matrix, bid-decision summary. All are scoped to the caller. Out-of-domain questions are refused. The model is the single `LLM_API_KEY` endpoint when set, otherwise the same provider rotation as extraction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| amendments                        | `corrigendum/diff_engine.py`, `impact_analyzer.py` | Deterministic diff of original against amended clauses: dates, plus critical keywords (turnover, debarment, blacklisting, experience, OEM, consortium), with an impact assessment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## 10. Human review

The model and the pipeline never set a review status.

- **Starting state.** Every clause lands as `UNREVIEWED`, with `human_review_required` true.
- **Where review happens.** Reviewers work in the clause workspace (`/bids/:id/clauses`): confirm, correct, reject (`NOT_A_REQUIREMENT`) or mark `NEEDS_REVIEW`.
- **Review bands.** The UI's review band comes from deterministic signals only (`computeAiBand` in `apps/api/.../clause-model.ts`). It is never shown as a percentage.
  - `REVIEW_REQUIRED`: the API's quote check is `NOT_FOUND`, or the clause is flagged `CONFLICT`, `QUOTE_NOT_FOUND` or `NEAR_FAILED_PAGE`.
  - `SPOT_CHECK`: the quote is `EXACT` or `NORMALISED`, every validation check passed (score 1.0), there are no flags, and the clause is not disqualifying.
  - `CHECK_CAREFULLY`: everything else.
- **Viewing the source.** A confirmation needs the source opened unless the clause is a `SPOT_CHECK` with no flags and is not disqualifying (`requiresSourceForConfirm`).
- **Re-extraction never overwrites a review**, because clauses are matched by location ([ARCHITECTURE.md](ARCHITECTURE.md) §7).
- **Conflicts** are resolved on `/bids/:id/conflicts`.

## 11. Configuration

All settings are read by `tenderpulse_ai/config.py`, from `apps/ai/.env` first and then the root `.env`. The template is `apps/ai/.env.example`.

| Setting                                                                                               | Default                              | Effect                                                                        |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| `LLM_PROVIDER`                                                                                        | `rotation`                           | `rotation`, or one of `cerebras`, `groq`, `gemini`, `sambanova`, `openrouter` |
| `CEREBRAS_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `SAMBANOVA_API_KEY`, `OPENROUTER_API_KEY`       | —                                    | Enables each provider                                                         |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`                                                            | —, OpenRouter, `openrouter/free`     | Single endpoint for tender chat                                               |
| `LLM_TIMEOUT_SECONDS`                                                                                 | 45                                   | HTTP timeout per call and per-round rotation budget                           |
| `LLM_MAX_RETRIES`                                                                                     | 2                                    | Retries per endpoint for transient errors                                     |
| `LLM_MAX_TOKENS`                                                                                      | 4096                                 | Output budget per call                                                        |
| `LLM_MAX_CONCURRENCY`                                                                                 | 8                                    | Page windows in parallel                                                      |
| `BATCH_PAGE_WINDOW_SIZE`                                                                              | 3                                    | Pages per window (capped at 3)                                                |
| `LLM_RATE_LIMIT_MAX_WAIT_SECONDS`                                                                     | 180                                  | Longest wait for a rate-limited endpoint                                      |
| `LLM_REPLAY_MODE`, `LLM_REPLAY_DIR`                                                                   | `off`, cassette dir                  | `off`, `record` or `replay`                                                   |
| `OCR_LANGUAGES`                                                                                       | `eng`                                | Tesseract languages, e.g. `eng+hin`                                           |
| `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, `EMBEDDING_CACHE_DIR`                                        | `local`, `BAAI/bge-small-en-v1.5`, — | Dense retrieval                                                               |
| `INGESTION_QUEUE_PROVIDER`, `AWS_INGESTION_QUEUE_URL`                                                 | `none`, —                            | Queue consumer (`sqs`, `pubsub`, `mock`, `none`)                              |
| `COMPLETION_QUEUE_PROVIDER`, `AWS_SQS_COMPLETION_QUEUE_URL`                                           | `mock`, —                            | Completion publisher (`sqs`, `pubsub`, `http`, `mock`)                        |
| `QUEUE_POLL_INTERVAL_SECONDS`, `QUEUE_VISIBILITY_TIMEOUT_SECONDS`, `QUEUE_HEARTBEAT_INTERVAL_SECONDS` | 1, 300, 60                           | Consumer timing                                                               |
| `AWS_S3_BUCKET`, `AWS_REGION`                                                                         | —, `ap-south-1`                      | Claim-check bucket and presigning                                             |

## 12. Performance

Measured on the dev stack on 2026-10-27, with free tiers (Cerebras, Groq, Gemini, SambaNova):

| Document       | Before (per-provider 429 lockout, 3 windows) | Now (per-model limits, 8 windows, no qwen) |
| -------------- | -------------------------------------------- | ------------------------------------------ |
| 8-page NIT     | 17 s                                         | about 16–17 s                              |
| 99-page tender | 347 s                                        | 144–151 s, coverage COMPLETE               |

**What limits speed.**

- **Output length.** Free models generate about 60–90 tokens per second, which is why the prompt asks for minified JSON with short titles and descriptions.
- **Rate limits.** A 99-page run still hits 48–78 rate-limit responses (HTTP 429). For example, Cerebras gpt-oss-120b allows 5 requests per minute, and Groq allows 8k tokens per minute per model.
- **Gemini 3.1 Flash Lite** carries most windows (32–39 calls per run).

Paid-tier keys would raise every limit. A typical call takes about 3 s for about 2.6k prompt tokens and 0.8k completion tokens.

## 13. Testing and benchmarking

| What                | Command (from `apps/ai`)                                                           | Notes                                                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests          | `uv run pytest -m unit`                                                            | About 20 s, no PDFs, no network (`FakeLLM`)                                                                                                                                                                   |
| Full suite          | `uv run pytest`                                                                    | Adds `realdoc` tests over the PDFs in `data/procurement-evidence`                                                                                                                                             |
| Live provider tests | `uv run pytest -m live`                                                            | Needs keys and network; opt-in                                                                                                                                                                                |
| Clause contract     | `UPDATE_FIXTURES=1 uv run pytest tests/test_clause_contract.py`                    | Regenerates the golden AI→API fixture                                                                                                                                                                         |
| Benchmark           | `uv run python -m tenderpulse_ai.evaluation.benchmark --docs 02,04 --compare last` | Runs the production pipeline on real PDFs. Writes `.bench/<timestamp>.json` and prints a before/after table plus the reasons candidates were rejected. Parsed pages are cached per PDF hash in `.cache/pages` |

**Quality check for model or prompt changes.**

1. Reprocess the same document several times through the dev stack.
2. Compare `compliance_items` across runs by location: same page within ±1, quote containment of 0.6 or more.
3. The agreement between two runs of the current setup is the baseline. A change must find the items that two baseline runs agree on at least as often as a third baseline run does.

The method and results are in [audits/MODEL_ROTATION_QUALITY_BENCHMARK.md](audits/MODEL_ROTATION_QUALITY_BENCHMARK.md).

## 14. Known limitations

| Limitation                                    | Effect                                                                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Run-to-run variance                           | Two runs of the same setup agree on about 74–87% of core items; extraction is not deterministic even at temperature 0 across providers |
| Amounts in words or "crore" units             | The attribute stays empty; the figure is only in the quote                                                                             |
| Free-tier rate limits                         | A long tender spends much of its time waiting on 429s                                                                                  |
| Off-list categories from non-strict providers | Cost one extra small re-ask call                                                                                                       |
| Candidate detection and context assembly      | Computed for every document, but they only feed validation, not what the model sees                                                    |
