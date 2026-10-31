# AI pipeline audit — 2026-10-31

`apps/ai` checked against AGENTS.md Invariant 5 and [AI_PIPELINE.md](../AI_PIPELINE.md). Line numbers are from before the fix commit.

## Findings

| #   | Where                                     | What was wrong                                                                                                                                                                                                                                                                                                                              | Fix                                                                                                                                    |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `workflow/nodes.py:820` validation        | A candidate without a clause reference built `AssembledClauseContext(clause_reference=None)`; the field was `str`, so Pydantic raised and the **whole window failed** with a non-LLM error (Pyrefly `bad-argument-type`)                                                                                                                    | `clause_reference: str \| None = None` in `domain/models.py`                                                                           |
| 2   | `workflow/nodes.py:694` validation        | The page was moved to the page holding the quote only when the model's page was outside the window. A model page inside the window was kept even when the quote is on another page of that window, so a quote on page 2 of a 1–3 window could ship as page 1 (the default when the model gives no page, `openai_compatible_client.py:1339`) | The page that holds the quote always wins; the model's page is kept only when the quote is on no single page (stitched across a break) |
| 3   | `openai_compatible_client.py:966`, `1083` | HTTP 401/403 marked only that model unavailable, so every other model on the same key was tried and rejected in turn; with a single provider the raw `httpx.HTTPStatusError` escaped instead of `LLMExtractionError` (HTTP 500 instead of 503, window not listed in `failed_pages`)                                                         | 401/403 blocks the provider for the process (`block_provider(..., inf)`); a single provider raises `LLMExtractionError`                |
| 4   | `openai_compatible_client.py:656` chat    | Chat 429s ignored `Retry-After` (fixed 60 s)                                                                                                                                                                                                                                                                                                | `rate_limit_cooldown_seconds` as in the structured path                                                                                |
| 5   | `openai_compatible_client.py:716` chat    | A chat success cleared the model's cooldowns, including ones another call set while it ran                                                                                                                                                                                                                                                  | Cooldowns are never cleared on success                                                                                                 |
| 6   | `workflow/nodes.py:968` contradictions    | PBG conflict text named sources "Specific Clause" / "General Clause" when the tender states no clause number (invented labels)                                                                                                                                                                                                              | `Page N` of the source, as the EMD detector already does                                                                               |
| 7   | `openai_compatible_client.py:889`         | Comment said the caller "falls back to deterministic extraction" (no such fallback exists)                                                                                                                                                                                                                                                  | Comment corrected                                                                                                                      |

Checked and correct: extraction is LLM-only (no rule or regex producer); quotes are never filled from block text; strict schema for Cerebras and one category re-ask (`_recategorize`); failed windows set `extraction_error` and are listed in `failed_pages` and `coverage`; all windows failing raises `LLMExtractionError`; `LLM_MAX_CONCURRENCY` semaphore around each window; 429 scope per model (Groq, Cerebras, Gemini, SambaNova) or per provider (OpenRouter), bounded wait `LLM_RATE_LIMIT_MAX_WAIT_SECONDS`; evidence extraction returns `status=FAILED` with the reason; no tender-specific phrases or figures in extraction code.

## Still open

- `asyncio.gather` over windows (`extraction/orchestrator.py:249`) has no `return_exceptions`: a window that raises something other than `LLMExtractionError` fails the document while the other windows keep calling models.
- Chat (`chat/workflow.py`) answers from a template when no model replies, and its "not found" text cites general CPWD/NHAI practice. Chat is outside Invariant 5 but the wording should be reviewed.
- `GET /bids/:id/bid-decision` answers 404 for unevaluated bids by contract, which logs a console error on every bid overview.
- The tender PDFs live in the main checkout's root `data/`, but tests and the benchmark read `apps/ai/data` (a link is needed in a worktree).

## Gates

| Gate                                | Result                                                               |
| ----------------------------------- | -------------------------------------------------------------------- |
| `ruff check`, `ruff format --check` | clean                                                                |
| `pytest -m unit`                    | 502 passed, 1 skipped (before fixes)                                 |
| `pytest` (unit + realdoc)           | 518 passed, 2 skipped (after fixes, with three new regression tests) |

## Benchmark (`--docs 02,04`, live rotation: Groq, Gemini, SambaNova, Cerebras)

| Document            | Status                | Items | Contradictions | Model failures | Quotes over 700 chars | Generic refs | Seconds |
| ------------------- | --------------------- | ----- | -------------- | -------------- | --------------------- | ------------ | ------- |
| 02 NHAI Greenfield  | REVIEW_READY          | 18    | 0              | 0              | 0                     | 0            | 13.3    |
| 04 RVNL Rail Bridge | HUMAN_REVIEW_REQUIRED | 112   | 0              | 0              | 5                     | 0            | 114.1   |

Rejections: 02 — 4 quotes not found on the page; 04 — 11 not found, 2 dangling fragments. The run before it failed every window because the worktree had no LLM keys, so no earlier snapshot in this worktree is comparable.
