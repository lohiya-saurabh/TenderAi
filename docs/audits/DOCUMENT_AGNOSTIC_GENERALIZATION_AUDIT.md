# Document-Agnostic Generalization Audit (Deterministic Extraction Path)

**Scope:** `apps/ai` deterministic pipeline (Stage 1 parser → Stage 2 AST → offline/zero-item fallback extractor → validation → consolidation).
**Goal:** the same code must extract a grounded, correctly-attributed compliance matrix from any procurement tender (NHAI consultancy NIT, civil SBD, IT/Opex RFP, metro, rail, CPWD) without tender-specific strings.

## 1. Root causes found

| # | Defect (02_NHAI 8-page NIT) | Root cause | Generic fix |
|---|---|---|---|
| 1 | Quotes ending in `; xx.` / `; xix.` | Sentence end detection only knew numeric list markers; the next sibling's roman marker was swallowed | `trim_enumeration_tail()` (`extraction/deontic.py`), applied in `get_clause_and_quote()` and the deontic engine; parser + deontic tokenizer split at `(ii)`, `xv.`, `a)`, `Note: (1)`, `12. (A)` |
| 2 | Clause refs `Annexure– III`, `Clause 18.75` | `_extract_clause_from_clause_text` / `_extract_clause_reference` fell back to **mid-sentence** division mentions and decimals | Mid-sentence fallbacks removed. `ClauseTracker` (Stage 2, `structure_builder.py`) tracks line-start markers only and stores `DocumentStructureTree.block_paths`; `attribute_positional_clause_refs()` re-attributes every verified item from the block that holds its quote → `Clause 5(xv)`, `Clause 5(xix)`, `Clause 13.C(ii)(a)` |
| 3 | Pages 4→5 turnover split (`should be equal to or more than Rs.5 Crores`) | Blocks never crossed a page break | `stitch_cross_page_continuations()` (Stage 1): next-page paragraph starting lowercase, or previous paragraph without terminal punctuation when the next page does not open a structural unit. Validation grounds stitched quotes against the joined window + `continuation_text` |
| 4 | `(ii)–(v)` merged into one giant quote | `in_table_coalesce` (triggered by the word "Table") suppressed sub-clause flushes | Sub-clause markers always open a new block; table rows in a lead-in are still absorbed. Rule quotes opening with a marker are cut to their own sibling (`_split_sibling_quote`) |
| 5 | Turnover duplicated as FINANCIAL and TECHNICAL | Consolidation only compared within a category; the turnover rule was keyed to the literal `5 crores` | Cross-category fingerprint merge (`quote_overlap_ratio` ≥ 0.65 on same/adjacent page + related titles, or same focus sentence with related descriptions); most specific category wins (`CATEGORY_SPECIFICITY`). Amount-agnostic `find_turnover_threshold()` owns any stated minimum |
| 6 | `1. The firm should have…` (table row) reset Clause 13 to "1" for pages 4–6 | Any line-start number created a clause node | Backward bare numbers are sub-items of the active clause; dotted numbers (`54.1`) and unnumbered ALL-CAPS headings (`SCOPE OF WORK`) start a new clause/division |
| 7 | 27 of 69 rules emitted static descriptions with remembered figures (e.g. "Rs. 5.0 Crores", "60-Months") | Descriptions written from one tender | `_ground_generated_text()`: any number in a rule's title/description that is absent from the source block triggers re-synthesis from the verbatim quote (AGENTS.md Invariant 1) |
| 8 | Running headers stripped by issuer name (`IHMCL`, `NHAI`, `National Highways Authority of India`) | Organisation names hard-coded in `RUNNING_FURNITURE_PATTERN` | `detect_repeated_furniture()`: edge lines recurring on ≥30% of pages (min 3), plus a generic slash-separated reference-code pattern |

Retired tender-specific rules: *Bi-Annual Drone Survey* (keyed to `18.75/2021`) and *Data Lake Portal* (keyed to `data lake`). Both obligations are now found by the deontic engine on any wording (e.g. a monthly LiDAR survey or an SAP Ariba integration — see `tests/test_document_agnostic_generalization.py`).

## 2. Deontic grammar extractor (`extraction/deontic.py`, retired in round 4)

1. **Tokenize** each block into enumerated units (line-start and inline markers).
2. **Score** each unit with `DEONTIC_OBLIGATION_RE` (shall / must / should / is required to / mandatorily / not less than / limited to / will be rejected / non-responsive / forfeited …). Enumerated items inherit obligation from an obliging preamble (`… is broadly required to:`) or an infinitive duty (`To conduct …`).
3. **Skip** definitions (`shall mean`, `shall refer to`), issuer disclaimers (authority-subject sentences with no bidder term) and participation prohibitions owned by the eligibility rules (`JV_PROHIBITION_PATTERN`).
4. **Synthesize** the title from the unit's own words: run-in heading → defined term `Monthly Progress Report (MPR)` → subject/modal-stripped core phrase, plus the governing reference (`per Circular 18.75/2021`) and the first threshold (`Within a period of 7 days`, `Rs. 5,000/-`). The description is the parent preamble + the unit text. Short specification bullets under one preamble are grouped into a single item.
5. **Classify** by lexical domain signals (`CATEGORY_SIGNAL_WEIGHTS`), priority FINANCIAL > STATUTORY > LEGAL > EXECUTION > COMMERCIAL > TECHNICAL > OPERATIONAL.

`default_tender_extractor` runs domain-concept rules first (curated titles), then appends deontic items whose quote does not overlap (≥ 0.65) a rule item on the same/adjacent page.

## 3. Multi-tender benchmark (offline deterministic path, `StructuredLLMClient(enable_live_client=False)`)

Before = repository state prior to this change; after = this change. *Generic ref* = `Clause on Page N` / `Page N`; *trail marker* = quote ends with the next sibling's marker; *lower start* = quote starts mid-sentence (list markers excluded); *dup pairs* = item pairs on the same/adjacent page with ≥ 0.9 quote overlap.

| Tender | Items | Generic ref | Trail marker | Lower start | > 700 chars | Dup pairs |
|---|---|---|---|---|---|---|
| 01 NHAI HAM 850 Cr (99 pp) | 19 → 116 | 10% → 3% | 0% → 0% | 0% → 0% | 21% → 0% | 5 → 1 |
| 02 NHAI consultancy NIT (8 pp) | 34 → 46 | 44% → 0% | 14% → 0% | 5% → 0% | 5% → 0% | 7 → 3 |
| 03 NCRTC metro viaduct (195 pp) | 23 → 136 | 21% → 6% | 4% → 0% | 0% → 0% | 21% → 5% | 4 → 4 |
| 04 RVNL rail bridge (74 pp) | 9 → 147 | 33% → 12% | 11% → 0% | 0% → 0% | 0% → 0% | 0 → 0 |
| 05 MSRDC cable-stayed bridge (85 pp) | 20 → 79 | 25% → 6% | 0% → 0% | 0% → 0% | 20% → 5% | 3 → 4 |
| 08 NHAI ATMS tolling (128 pp, scanned) | 0 → 92 | – → 1% | – → 0% | – → 0% | – → 2% | 0 → 0 |
| 10 NHAI outer ring / IHMCL RFP (146 pp) | 18 → 228 | 22% → 5% | 0% → 0% | 0% → 0% | 33% → 2% | 2 → 2 |

Final numbers include rounds 2–3 (sections 4–5). Remaining 02 duplicate pairs are distinct obligations that share one source paragraph (e.g. conflict-of-interest vs. QCBS weightage), which are intentionally kept apart.

## 4. Round 2: layout, OCR, merge integrity, ingestion latency

| Former limitation | Root cause | Fix |
|---|---|---|
| Column-interleaved ruled tables (02_NHAI p4–5 eligibility table) | PDFium's text layer reads a ruled table column by column | `domain/pdf_layout.py` re-renders ruled tables row by row with pdfplumber (`cell \| cell`); a row whose continuation starts the next page (empty leading cell) is joined back. A PDFium path pre-filter (`_has_ruling`, ignores page frames/header rules) limits pdfplumber to ruled pages: 99-page SBD 30 s → 8.6 s. Parser keeps empty cells aligned and records `row_key_map` as `Header: value \| Header: value`; the deontic tokenizer treats each cell as a unit |
| Scanned PDF (08_NHAI_ATMS, 128 image-only pages) → 0 items | No text layer | Tesseract OCR via `subprocess` for pages with < 20 chars (300 dpi, 4 parallel workers, `OCR_LANGUAGES`); skipped with a warning when the binary is absent. 0 → 92 grounded items, ~164 s (OCR-bound). Quotes keep OCR spelling errors because grounding is against the OCR text |
| Merged JV items carried a sibling rule's description | Consolidation chose title, description and quote independently | The winning item (more specific category, else existing quote-preference rules) is adopted wholesale: title, category, description, quote, clause reference |
| Obligations outside retrieval top-k lost | Deterministic extractor read only the top 8–25 chunks per window | Deterministic mode reads every chunk in the window (no token budget); the cap remains for live LLM calls |
| 4.5 s sequential 429 storm per window | 429 cooled one model, rotation tried same-provider models | Provider-level circuit breaker (`block_provider` / `is_provider_blocked`, 60 s) |
| Every live extraction returned empty content (`completion_tokens=1200`) after 11–17 s per model | Free OpenRouter models are reasoning models: hidden reasoning consumed the whole `max_tokens=1200` budget (`finish_reason=length`) | Extraction requests send `reasoning: {effort: "none", exclude: true}`; `LLM_MAX_TOKENS=4096`; empty-by-length models cooled down 10 min; rotation capped at `LLM_TIMEOUT_SECONDS`. Live extraction stays on by default (`ENABLE_LIVE_EXTRACTION_LLM=true`) |
| Table-rendered TOC pages leaked into extraction | `is_pure_toc_page` did not recognise `1 \| Scope of Bid \| 19 \| ...` rows | Index-table rows count as TOC lines |
| pdfminer DEBUG flood (~110k records per 8-page PDF) | Third-party DEBUG logging with DEBUG file logs | `pdfminer` logger capped at WARNING |

Also: clause tracker accepts `Chapter`, `Rule`, `Paragraph`/`Para`, `Item`, Roman numbering (`Section IV`, `Article VII`) and `Part-2`; rule-description figures are grounded against the whole page window (a table may continue on the next page's chunk).

Not adopted: replacing synthesized titles with generic concept-cluster titles ("Financial Qualification & Annual Turnover Threshold" for every turnover clause). Synthesized titles are already document-agnostic and more specific ("Minimum Annual Turnover Threshold (Rs.5 Crores)").

## 5. Round 3: review-routing noise (ingestion log)

| Symptom | Root cause | Fix |
|---|---|---|
| Deterministic windows retried twice with identical output | `targeted_refine` re-ran the same rules | `extraction_source` ContextVar (`llm` / `rules` / `custom`); no refine for `rules` |
| Nearly every window → MANDATORY_HUMAN_REVIEW | Correct drops (deleted clauses, duplicates of verified items) counted as failures; the validator judged a neighbouring clause; synthesized table renderings (skeleton chunks, table chunks, rescue-pass `Table t: Header: value` rows) were quoted; page-top tails / `AND WHEREAS` boilerplate emitted as quotes; turnover rule appended a synthetic `.` and lost the first character on `rfind = -1` | `intentional_rejections`; context swapped to the grounded quote; non-verbatim inputs excluded; `is_dangling_fragment` filter in `default_tender_extractor`; quote repair crosses `.”` boundaries; verbatim-only turnover quote; trailing sibling headings (`… English. B. Time Control`) trimmed |
| `[REDACTED_AADHAAR]` inside an SQS URL | 12-digit regex matched the AWS account ID | Verhoeff checksum or Aadhaar label required; AWS contexts exempt |

Result (offline path): windows with unverified items 01: 4→0, 03: 6→0, 04: 2→0, 05: 4→0, 10: 3→0, 08: 0. 02, 04 and 08 finish `REVIEW_READY`; 01, 03, 05 and 10 are routed to review **only** by the contradiction detector (PBG % conflicts, monetary EMD vs Bid Securing Declaration). Items: 01 116, 02 46, 03 136, 04 147, 05 79, 08 92, 10 228.

## 6. Round 4: LLM-only extraction (rules and synthetic fallbacks removed)

**Decision.** Compliance items and company-evidence attributes are produced only by the LLM. Code validates and normalizes the model's answer (exact-substring grounding on the page, number/prohibition/exception checks, category mapping) but never produces or completes content. When no model answers, the result is an explicit failure, not rule output. Rounds 1–3 above describe the retired deterministic path; their benchmark numbers are historical.

| Removed | Why |
|---|---|
| `extraction/rules/` (8 files), `extraction/deontic.py`, `extraction/quote_resolver.py`, `extraction/parsing.py`, `default_tender_extractor`, `StructuredLLMClient(extractor_fn=…, enable_live_client=…)`, `ENABLE_LIVE_EXTRACTION_LLM` | Regex/grammar item producers; several fired on one tender's wording and emitted that tender's facts (pothole SLAs, NHAI quota matrix, "5 survey instruments", HiSilicon, INFRACON) |
| 0-item and error fallback to rules in `StructuredLLMClient` | Silently replaced model output with rule output |
| Whole-block quote fill-in when the model returned only `source_block_id` (and the prompt telling it not to quote) | Quotes were not chosen by the model (the source of > 700-char quotes) |
| Missing/unknown category defaulted to `STATUTORY` | Invented a category |
| `pdf_resolver.filter_candidate_pages` (keyword-ranked top ~50 pages for documents > 30 pages, keywords like `hisilicon`, `pothole`, `144(xi)`) and the live top-8–25 chunk query naming INFRACON | Pages and clauses outside the keyword list never reached extraction |
| `rescue_pass` node | Redundant once every clause chunk is sent |
| `agent/agent.py` + `/api/v1/agent/analyze-requirements` (`default_requirement_model` = regex adapter) | Regex-backed; not called by the API or web app |
| Regex company-evidence extractor (UDIN/turnover/ISO/GSTIN patterns, synthesized chunk headers) | Replaced by LLM extraction with per-attribute verbatim quotes |
| `decision/risks.py`: EMD estimated as 2% of tender value | Synthetic figure; now the tender's stated amount or no amount |
| Tender-specific terms in `candidate_detector.py` patterns, the prompt (SAROD, Schedule T, Article 48), `tools/retrieval.py` (`nhai/…`) | Document-specific |

Code: `apps/ai/src` −6,917 / +773 lines; tests −2,625 / +676 lines.

**Failure semantics.** `LLMExtractionError` (no key, all providers 429/blocked, invalid JSON from every model) → the window is marked `extraction_error`, escalated, and listed in `DocumentExtractionResponse.failed_pages`; when all windows fail, the pipeline raises (queue worker retries, then publishes `status=FAILED`; `/api/v1/extract` returns HTTP 503 `LLM_EXTRACTION_FAILED`). A valid empty answer (`[]`) is accepted without rotation. Evidence extraction returns `status=FAILED` with the reason.

**Testing and benchmarking.** `LLM_REPLAY_MODE=record` stores raw responses as `tests/fixtures/llm_cassettes/<sha256(messages)>.json`; `replay` serves them offline. Unit tests use `tests/fakes.py`. `python -m tenderpulse_ai.evaluation.benchmark --docs 02,04 --compare last` runs the real pipeline over the tender PDFs (page parsing cached by file hash in `.cache/pages`), writes `.bench/<timestamp>.json`, and prints status, items, model failures, quote-length and clause-reference stats plus rejection reasons against the previous snapshot. Pytest tiers: `-m unit`, `-m realdoc`, `-m live` (opt-in).

**Known gaps.** The NestJS API still has its own regex fallbacks for both flows (`AiEvidenceExtractor.extractEvidenceLocal`, `AiDocumentExtractor.extractCandidatePagesLocally`) and marks evidence `EXTRACTED` even when the AI reports `FAILED`; contradiction findings are still appended to `items` as rows whose quote is the precedence ruling (page 1). Both need an API-side change.

## 7. Round 5: extraction latency (8-page NIT took 3 m 58 s live)

| Cause (ingestion log) | Fix |
|---|---|
| Every call generated ~3–4k output tokens (pretty-printed JSON, full `execution_rules` and `provenance` objects, long descriptions) at ~60–90 tokens/s → 34–68 s per call; two windows hit `max_tokens=4096` and lost their tail items | Minified compact item schema (`block_id`, `category`, `title`, `description` ≤ 30 words, `quote`, optional `execution_rules`): ~268 → ~102 tokens per item |
| `targeted_refine` re-extracted the whole window twice (each retry another 3–4k tokens) | Refinement lists the rejected candidates and asks only for their corrections |
| `openrouter/free` (a router) tried first: HTTP 400 "Reasoning is mandatory", a safety classifier answering `User Safety: safe`; a long-running success cleared the cooldown | Concrete models first, router last; 1 h cooldown for reasoning-mandatory, 5 min for unusable output; successes no longer clear cooldowns |
| 3 windows, concurrency 2 → third window waited a full call | `LLM_MAX_CONCURRENCY` (default 3) |

## 8. Phase 0: no false signals in the clause UI

Confidence finding: since round 5 the compact prompt does not ask the model for a confidence, so every item carried the 0.95 model default (before that it was an uncalibrated self-report), and the API re-defaulted missing values to 0.95/0.9. The validator already computed a deterministic per-item score (`report.confidence_score`, 1 − check penalties) but only averaged it per window. It is now written to `provenance.confidence_score` of each verified item; anything else is `null` end to end (AI → shared-types → API VO/mapper → web) and the UI shows "Not checked", never a percentage.

| False signal | Fix |
|---|---|
| "Authorized Signatory" injected when the clause names none (AI model, AI client, API VO, extractor, mapper) | Empty string = not stated; the execution-formalities card lists only stated formalities and is hidden when there are none |
| Status derived from category (EXECUTION → flagged) | New items are `PENDING`, or `FLAGGED` only when the AI marks them `FLAGGED_FOR_HUMAN_REVIEW` |
| Contradiction rows quoted "Order of Precedence" boilerplate | Conflict rows carry `sources` (title, clause, page, real quote) from the conflicting items; rows without sources are dropped; title prefixed "AI-detected conflict" |
| Reviewer recorded as "Reviewer" | Authenticated user's name/email from the tenant context |
| `deriveGroundingMatch` "100% Verbatim Grounding" | "Quote matched on p.N" / "No source quote" plus validation result ("All checks passed" / "flagged" / "Not checked") |
| Evidence shown VERIFIED without evidence; fake "NIT Document", page 1, LOW risk, "Optional" defaults | Missing = MISSING / "No page" / "Not assessed" |
| "ZERO CONTRACTUAL RED FLAGS"; hard-coded PASSED/FLAGGED sign-off dock with `alert()` buttons; MissingDataCallout | Removed or replaced with a neutral "nothing flagged yet — not a risk assessment" note |
| Compliance matrix sorted alphabetically; PENDING/READY/WAIVED mapped to no filter | Default sort in page order; PENDING → unreviewed, READY → pass, WAIVED → not applicable |
| Citation drawer and new tab opened together | Drawer only |

## 9. Phase 1: truthful clause data contract

One contract, three places: `packages/shared-types/src/clause.ts` (TypeScript), `packages/shared-types/schema/extraction-completed.schema.json` (the AI payload, validated in `apps/ai/tests/test_clause_contract.py`) and the golden event `packages/shared-types/fixtures/extraction-completed.phase1.json`, which the API test `ClauseContract.e2e.spec.ts` ingests through the real webhook. Regenerate the golden file with `UPDATE_FIXTURES=1 pytest tests/test_clause_contract.py` after an intended contract change.

| Area | Before | Now |
|---|---|---|
| Identity | API merged clauses by `category:title` across the whole bid; AI dropped same-title items per window | Location key `hash(document, page, normalised quote)` (`location_key` in Python, `locationKey` in TS, parity-tested); same-title clauses on different pages stay separate; re-ingest keeps human reviews |
| Clause reference | "Page N", "Clause Reference", folded "(Pages 2, 6)", stale section carried across pages | The tender's own line-start number around the quote on the same page (`clause_ref_from_page`), else `null`; supporting pages are an array |
| Attributes | none | `obligationType, action, stage, parties, mandatory, disqualifying, deadline, amount, formRef`, each kept only if an allowed value and (numbers, dates, form refs) literally present in the quote |
| Attestation | booleans defaulting to false, default signatory | tri-state (`null` = not stated) incl. apostille and client countersignature |
| Conflicts | pseudo clause rows | `clause_conflicts` records whose values link to clause ids; AI note stored separately; resolution with reviewer, version and audit; adds EMD amount conflicts |
| Coverage | failed pages only logged | `extraction_coverage` per document; `NEAR_FAILED_PAGE` flag on clauses next to an unread page |
| Quote check | trusted | server-side `EXACT / NORMALISED / NOT_FOUND / NO_PAGE_TEXT` against stored page text (section skeleton and child chunks excluded) |
| Status | one column mixing review and fulfilment, set by category | `review_status` (UNREVIEWED, NEEDS_REVIEW, CONFIRMED, CORRECTED, NOT_A_REQUIREMENT) and `fulfilment_status`; idempotent DDL migration of legacy rows (dry-run test covers every legacy status with and without a reviewer); legacy `status` kept in step for the current UI |
| AI band | none | SPOT_CHECK only when quote found, all validation checks passed, no flags, not disqualifying; else CHECK_CAREFULLY / REVIEW_REQUIRED |

Endpoints (`apps/api/src/modules/compliance/clauses.controller.ts`): `GET /bids/:id/clauses` (document order, facets, ETag/304), `GET /bids/:id/clauses/:cid` (context text, conflicts, history, prev/next), `POST /bids/:id/clauses/:cid/review` (CONFIRM needs `sourceOpened` unless clean spot-check; no CONFIRM while in an unresolved conflict or, without a note, when the quote was not found; 409 on stale version; UNREVIEW undoes), `POST /bids/:id/clauses/bulk-review` (CONFIRM only, all-or-nothing, unreviewed spot-check clauses without flags), `GET /bids/:id/conflicts`, `PATCH /bids/:id/conflicts/:cfid`, `GET /bids/:id/coverage`, `GET /bids/:id/summary`, `GET /bids/:id/documents/:docId/pages/:n` (text layer). Deferred to later phases as planned: rendered page images, fulfilment PATCH, manual add, XLSX export, pre-bid query drafts. The web app still reads the legacy `/compliance-items` endpoints until the Phase 2 workspace.

Known gaps: a date stated differently in two clauses (originals 28 vs 30 Nov in the fixture) is not detected as a conflict yet; the contradiction detector covers performance security %, EMD amount, EMD vs bid-securing declaration and GST treatment.

## 10. Phase 2: clause verification workspace

`/bids/:id/clauses` replaces the compliance matrix, its three drawers and the per-item review page (old `/bids/:id/compliance/:itemId` links redirect to the clause in the workspace). The bid overview shows a Clauses card with review progress and attention counts that open saved views.

- **Layouts**: triage (filters · virtualised list · non-modal panel) and verify (compact list · source page · panel, `V`). The panel shows the conflict, verbatim source text with surrounding context and the quote check, AI summary (labelled), stated requirement details, a "Not stated in this clause" line, activity history and the review actions.
- **Source viewer**: the stored page text with the quote highlighted; it says so when the quote is not on the page or the page was not analysed. Exact PDF positions are not available yet (no page rendering).
- **Review**: Confirm is disabled until the source has been viewed unless the clause is a clean spot-check; clauses in an unresolved conflict link to the Conflicts view instead; a not-found quote needs a note; Correct edits title, summary, clause number, obligation, stage, mandatory and amount with the diff in the history; Undo after each action; 409 version clashes offer a reload; read-only users see no actions.
- **Saved views and facets**: All, Needs review, Disqualifying if missed, Conflicts, Due before submission, Documents to attach, Outside party, Changed by corrigendum; facets for review, flags, AI band and stage with counts; search; group by section / bidder task / stage / review / document; density; everything in the URL.
- **Bulk**: only unreviewed spot-check clauses without flags are confirmed; the batch bar states how many are skipped.
- **Keyboard**: J/K move, A confirm, E correct, R not a requirement, O open source, V verify layout; can be switched off (remembered per browser).
- **Conflicts view**: both values with their clause text and references, the AI note labelled "AI suggestion — not tender text", accept a value, mark a pre-bid query as sent (draft built from the two clauses, editable), or record the corrigendum that resolved it.
- **Removed false signals found on the way**: the document card's invented clause count (`max(9, total/docs ± 4)`), and the "nothing flagged" risk card that read only the legacy status.

Tests: `e2e/clause-workspace.spec.ts` (Playwright, U1–U13 + legacy-link redirect; seeds tenders through the webhook with the golden event and a generated 700-clause tender; axe scan of workspace, panel and conflicts). `playwright.config.ts` starts the API on a fresh demo database under `.e2e/` and the Vite dev server.

## 11. Remaining limitations

- **Native Docling layout models** (TableFormer) are not used: they download weights from Hugging Face at runtime. The pdfplumber path needs ruling lines; borderless (whitespace-aligned) tables still rely on the spatial-column heuristic.
- **OCR quality** depends on scan quality; bilingual pages need `OCR_LANGUAGES=eng+hin` and the `tesseract-ocr-hin` pack.
