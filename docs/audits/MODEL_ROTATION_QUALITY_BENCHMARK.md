# Model rotation: speed vs extraction quality (2026-10-27)

**Decision:** the free-tier rotation drops qwen (Cerebras `qwen-3.8-27b`, Groq `qwen/qwen3.8-27b`).
Leading with qwen made the 99-page tender 2× faster than the alternative, but it consistently
missed core obligations. Per-model rate limits and 8 parallel windows stay; they give most of
the speed-up without qwen.

## Setup

- Documents: `01_NHAI_HAM_850Cr_NIT.pdf` (99 pages, `doc-1793081789149`) and
  `02_NHAI_Greenfield_Exp_1450Cr_NIT.pdf` (8 pages, `doc-1793075386002`). Both were reprocessed
  through the full API → SQS → AI worker → completion path on the dev stack.
- Free-tier keys: Cerebras, Groq, Gemini and SambaNova. OpenRouter was disabled.
- **Match rule** for "the same item" in two runs: the page within ±1, and one quote's words at
  least 60% contained in the other's.
- **Original run:** commit 54cae7e, per-provider 429 lockout, 3 windows.
- **Non-qwen runs:** per-model limits and 8 windows, with qwen removed. Calls were served by
  Gemini 3.1 Flash Lite (32–39), Cerebras gpt-oss-120b (9–12) and Groq gpt-oss-20b/120b (6–9).

## 99-page tender

| Run                                      | Time | Items | Coverage |
| ---------------------------------------- | ---- | ----- | -------- |
| Original                                 | 347s | 144   | COMPLETE |
| Non-qwen A                               | 151s | 167   | COMPLETE |
| Non-qwen B                               | 144s | 177   | COMPLETE |
| qwen first (per-model limits, 8 windows) | 74s  | 210   | COMPLETE |

Every item in every run had an `EXACT` quote check.

### Pairwise overlap

Each cell is the share of the row's items that the column's run also found:

|          | Original | A   | B   | qwen |
| -------- | -------- | --- | --- | ---- |
| Original | –        | 76% | 74% | 72%  |
| A        | 65%      | –   | 79% | 67%  |
| B        | 60%      | 74% | –   | 66%  |
| qwen     | 49%      | 53% | 55% | –    |

### Recall on agreed items (leave one out)

"Core" items are the ones two non-qwen runs both found. The table shows who also finds them.

| Core taken from (items) | Third non-qwen run | qwen |
| ----------------------- | ------------------ | ---- |
| Original + A (114)      | 86%                | 75%  |
| Original + B (117)      | 87%                | 74%  |
| A + B (137)             | 74%                | 69%  |

qwen is 5–13 points below normal run-to-run agreement. It misses the same core items in every
split:

- the average annual turnover requirement (p11);
- the performance security requirement (p63);
- the penalty for bid withdrawal (p6);
- no late submissions (p5);
- the subcontracting approval limit (p52).

Its extra items are grounded, but the other runs mostly do not pick them, so they don't make
up for the missing core items.

## Dropped off-taxonomy categories (fixed in 78d53eb)

The prompt lists `ELIGIBILITY|DOCUMENT|PENALTY` as `obligation` values, and qwen copied them
into `category`. The client used to drop those items, which lost 22 items over the two
documents. Most of them were eligibility and turnover clauses.

The fix has three parts:

- Cerebras now gets a strict JSON schema whose category enum is `EXTRACTION_CATEGORIES`.
- Groq stays on `json_object`, because it rejects strict-schema mismatches with HTTP 400 after
  generating.
- Items still outside the taxonomy are re-asked once (`_recategorize`). Run B made 3 such
  re-asks, and all 3 were corrected.

On the 8-page tender, this took the qwen-first run from 19 items (15 of the original 27) to 35
items (20 of 27).

## Reproduce

Reprocess a document, then export `compliance_items` for it (columns: page, quote, title,
category) to a CSV per run. Then run the pairwise match rule above over those CSVs.
