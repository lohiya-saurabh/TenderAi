# Comprehensive Pipeline Diagnostics, Architectural Bottleneck Audit, Multi-Tender Benchmarking & Resilient OKF + Structural RAG Specification

- **Document Title:** TenderPulse AI Compliance Extraction Engine Diagnostic, Multi-Tender Benchmark & Resilient OKF + RAG Architecture Report
- **Evaluated Tender Corpus:**
  1. **`02_NHAI_Greenfield_Exp_1450Cr_NIT.pdf`** (8 physical pages, 20,069 characters) — _Consultancy Services for Supervision Consultant during O&M of 4-Laning of Rohtak-Hisar Section of NH-09 (Old NH-10) from Km. 87.000 to Km. 170.000 (NIT No. `NHAI/RO-CHD/2025-2026/HSR/71`)_.
  2. **`01_NHAI_HAM_850Cr_NIT.pdf`** (99 physical pages) — _Construction of FOB's for permanent rectification of Black Spot at Km.37/430 and Km.105/800 of Nelamangala to Devihalli section of NH-75 (Old NH-48) in the state of Karnataka - 2nd Call (`NIT No. 04/NHAI/RO-BNG/Roadsafety/Tender/2024-25`)_.
  3. **`10_NHAI_Outer_Ring_Exp_1850Cr_NIT.pdf`** (146 physical pages / 142 numbered pages) — _IHMCL Selection of an Agency for Operation of Weigh-In-Motion (WIM) Systems at National Highway Toll Plazas on Opex Basis (`RFP No. IHMCL/RFP/WIM/2026/01`)_.
- **Persisted Document ID:** `doc-1792674132147` | **Bid ID:** `bid-1792585047102-qeidm5`
- **Database Engine:** PostgreSQL / PGlite (`./data/postgres`)
- **Scope:** Milestone 1 Diagnostics (`Features F1, F2, F3, F4`), Multi-Tender Corpus Stress-Test (`Feature F5`), and Milestone 2 Remediation, Synthetic Fallback Elimination & OKF + Structural RAG Integration (`Features F6–F13`) under `ORIGINAL_REQUEST.md` (§R1, §R2) and `PROJECT.md`
- **Report Date:** 2026-10-24

---

## Executive Summary

This diagnostic, benchmarking, and architectural remediation report provides an exhaustive forensic investigation into the compliance extraction and RAG pipeline of TenderPulse AI on Indian public procurement tenders, followed by the complete Milestone 2 engineering specification. The investigation was triggered by two critical anomalies observed in production and test runs:

1. **Sub-10ms Pipeline Execution:** Full 8-page document extractions executed in an improbable 2.8ms to 6.4ms, completely bypassing the expected 5–15 second live LLM inference envelope.
2. **Severe Persisted Database Quality Degradation:** The persisted database state for `doc-1792674132147` contains only 13 items with truncated verbatim quotes (e.g., `"M of four/six laning** of"`), missing financial thresholds (`Rs. 5 Crores` turnover omitted), and erroneous clause citations (`Table 1 (Page 1)` containing road chainages).

### Key Audit Findings

1. **Sub-10ms Bypass Root Cause:**
   In `apps/ai/src/tenderpulse_ai/pipeline.py` (lines 2851–2852), `ProductionExtractionPipeline` defaults its LLM client to `StructuredLLMClient(extractor_fn=default_tender_extractor)`. In `apps/ai/src/tenderpulse_ai/models/llm_client.py` (lines 53–54), the initialization condition `elif extractor_fn is not None and enable_live_client is not True:` sets `self.live_client = None`. Consequently, the live LLM gateway is never instantiated or invoked, regardless of whether `settings.llm_api_key` is configured. The extraction engine instantly diverts to in-memory regex rules (`default_tender_extractor`), completing in 2.8ms to 6.4ms. Furthermore, when the live gateway is directly tested, the default model (`minimax/minimax-m3.1-flash:free`) returns HTTP 404 (deprecated model slug), and the free-tier fallback pool returns HTTP 429 (credit exhaustion), tripping the permanent circuit breaker (`self._live_circuit_broken = True`).

2. **Upfront 5 Architectural Stages Audit:**
   - **`DoclingParserEngine`:** Fractures PDF text into 338 single-line visual blocks, severing sentences. Table detection looks for `|` and `\t` characters absent in standard PDF text streams, detecting 0 tables across 8 pages. Mislabels highway chainages (`93.140) to Km. 170.000`) and tender dates (`22.01.2026 to 19.02.2026`) as Level 3 headings.
   - **`DocumentStructureBuilder`:** Its `CLAUSE_PATTERN` regex (`r"^(?:(?:Clause|Sub-Clause)\s+)?(\d+(?:\.\d+)*|\d+\.)(?:\s+|$)"`) treats `Clause` as optional, causing any number or date to become a Level 3 clause node. This creates 44 bogus clause nodes (e.g., `[L3] 348.000`, `[L3] 9.45`, `[L3] 22.01.2026`, `[L3] 0.5`). Subsequent text blocks attach to bogus nodes, assigning INFRACON portal instructions to clause `9.45`.
   - **`TenderChunker`:** Buffer flushes occur prematurely whenever the AST node changes, splitting sentences. Furthermore, the pipeline exhibits a complete architectural disconnect: `chunker.chunk_document()` executes, but `retrieval_tool.seed_chunks()` in `pipeline.py` completely discards these chunks and seeds a single dummy whole-page chunk `chk_{doc_id}_{page}`.
   - **`CandidateDetector`:** Employs a line-by-line heuristic sieve. Text blocks under 15 characters without deontic verbs are sent to `unselected_passages`. In `rescue_pass_node` (`nodes.py`), the rescue pass filters `len(u['text']) >= 15` and caps candidates at top 10 per page. Short numeric thresholds and table cell values are permanently lost.
   - **`ContextAssembler`:** Assembles contexts where `current_clause`, `previous_clause`, and `following_clause` are single lines from adjacent blocks. `pipeline.py`'s `_extract_verbatim_window()` performs a naive offset slice (`idx - 15` to `idx + 85`), mechanically slicing words in half and generating truncated quotes like `"M of four/six laning** of"`.

3. **Synthetic Fallback Generation (`default_tender_extractor`):**
   In `pipeline.py` (lines 1170–1210), `default_tender_extractor` defines 44 hardcoded static string templates (e.g., `title="Technical Qualification & Similar Work Experience"`, `description="Demonstrated technical threshold capacity through prior successful execution of similar projects."`) paired with `_extract_verbatim_window()`. When the LLM gateway is bypassed or fails over, these static stubs are persisted to the database with generic descriptions that omit document-specific numbers (`Rs. 5 Crores`, `30%` / `50%` length) and attach severed 100-character window slices as quotes. Furthermore, if `request.pages` is empty on a failed PDF load, `pipeline.py` fabricates a synthetic `INR 5,00,000` EMD requirement on `100 Rupee stamp paper`.

4. **Database Audit & Multi-Tender Benchmark Gap Matrix:**
   - **Persisted items:** 13 records in PGlite for `doc-1792674132147` (`bid-1792585047102-qeidm5`).
   - **Ground truth benchmark (`02_NHAI_Greenfield_Exp_1450Cr_NIT.pdf`):** 30 operative compliance obligations (24 core benchmark obligations `B1`–`B24` + 6 extended scope/quota obligations `B25`–`B30`) across all 8 pages.
   - **Multi-Tender Corpus Findings (`01_NHAI_HAM_850Cr_NIT.pdf` & `10_NHAI_Outer_Ring_Exp_1850Cr_NIT.pdf`):** Exposes 4 systemic hazards that must be handled in Milestone 2:
     1. **Deleted-Clause Ghost Extractions** (`46. Advance Payment - Deleted.` on Page 62 and `7.1 ... - DELETED` on Page 88 of `01_NHAI...`).
     2. **Long-Range Shell Clauses** in ITB/GCC whose numbers live 30–80 pages away in `Contract Data` (Pages 88–89), `Appendix to ITB` (Page 23), or `NIT 1.1` (Page 4).
     3. **10 Intra-Document Contradictions** across `01_NHAI...` and `10_NHAI...` (e.g., `3%` vs. `10%` Performance Security; `GST Inclusive` vs. `except for GST` Financial Bid; `Rs. 20 Lakh EMD` vs. `Bid Securing Declaration`; `6.25-Year` vs. `2-Year` PBG validity).
     4. **ITS/Opex System Integrator Archetypes** in `10_NHAI...` (`IHMCL/RFP/WIM/2026/01`): Outright JV ban, GFR Rule 144(xi) land-border & source-code residency ban, HiSilicon camera chipset ban, CERT-In annual audit, DPDP Act 2023, Legal Metrology stamping (`Rs. 5,00,000` penalty + payment forfeiture), and multi-page SLA tables interrupted by running headers/footers.

5. **Hybrid OKF + 3-Tier Structural RAG Strategy:**
   To achieve both **100% deterministic compliance verification** and **unbounded long-tail specification recall**, TenderPulse AI adopts a two-layer memory architecture:
   - **Layer 1 & 2 (Open Knowledge Format — OKF):** Native OKF bundles for the **Company Evidence Vault** and **Statutory Playbooks**, paired with an automated **PDF-to-OKF Compiler** that compiles the 25–40 core tender compliance clauses into linked OKF concept nodes (`outbound_refs`, `inbound_refs`, YAML `metrics`, and hydrated `Contract Data`).
   - **Layer 3 (3-Tier Parent-Child Hybrid RAG):** `pgvector` (HNSW dense) + PostgreSQL `tsvector` (BM25 sparse) + Reciprocal Rank Fusion (RRF) + Small-to-Big Parent Expansion over the entire 100-to-300-page tender for long-tail technical specifications and ad-hoc Copilot queries.

---

## 1. Feature F1: Pipeline Execution Diagnostics & Sub-10ms Bypass Root Cause

### 1.1 Runtime Latency Profile & Log Trace Analysis

During standard execution of `ProductionExtractionPipeline.execute()`, the end-to-end extraction across an 8-page tender document routinely completes in less than 10 milliseconds:

```text
[INFO] tenderpulse_ai.pipeline: Processing document doc-1792674132147 (8 pages)
[DEBUG] tenderpulse_ai.domain.docling_parser: Parsed 338 blocks, 0 tables in 1.2ms
[DEBUG] tenderpulse_ai.domain.structure_builder: Built 44 structural nodes in 0.4ms
[DEBUG] tenderpulse_ai.domain.tender_chunker: Generated 56 wire chunks in 0.5ms
[DEBUG] tenderpulse_ai.domain.candidate_detector: Filtered 82 candidates in 0.3ms
[DEBUG] tenderpulse_ai.domain.context_assembler: Assembled 82 envelopes in 0.2ms
[INFO] tenderpulse_ai.workflow.nodes: Starting LangGraph extraction workflow across 8 pages
[DEBUG] tenderpulse_ai.models.llm_client: StructuredLLMClient.extract_compliance invoked (live_client=None)
[DEBUG] tenderpulse_ai.pipeline: default_tender_extractor matched 13 candidate items in 1.4ms
[INFO] tenderpulse_ai.pipeline: Extraction completed in 4.2ms. Total verified items: 13
```

In a real LLM-backed architecture, an 8-page document processed via structured extraction requires between 5,000ms and 15,000ms (12 LangGraph nodes executing LLM completion calls). A 4.2ms turnaround is 1,000x faster than network latency to any LLM provider.

### 1.2 Root Cause 1: Defective Client Initialization Logic in Code

Inspection of `apps/ai/src/tenderpulse_ai/pipeline.py` and `apps/ai/src/tenderpulse_ai/models/llm_client.py` reveals the exact mechanism responsible for the bypass:

#### 1. `ProductionExtractionPipeline.__init__` (`pipeline.py`, lines 2851–2853)

```python
class ProductionExtractionPipeline:
    def __init__(self, llm_client: StructuredLLMClient | None = None):
        self.llm_client = llm_client or StructuredLLMClient(extractor_fn=default_tender_extractor)
```

When `ProductionExtractionPipeline` is instantiated without parameters (the standard instantiation throughout `apps/api` and workers), it instantiates `StructuredLLMClient` with `extractor_fn=default_tender_extractor`. Note that `enable_live_client` is omitted, leaving it as default `None`.

#### 2. `StructuredLLMClient.__init__` (`models/llm_client.py`, lines 49–67)

```python
        if live_client is not None:
            self.live_client = live_client
        elif enable_live_client is False:
            self.live_client = None
        elif extractor_fn is not None and enable_live_client is not True:
            self.live_client = None
        elif settings.llm_api_key:
            from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
                OpenAICompatibleLlmClient,
            )
            self.live_client = OpenAICompatibleLlmClient(
                api_key=settings.llm_api_key,
                base_url=settings.llm_base_url,
                model=settings.llm_model,
                timeout=settings.llm_timeout_seconds,
            )
        else:
            self.live_client = None
```

**Forensic Trace:**

- **Condition 1 (`live_client is not None`):** `False`.
- **Condition 2 (`enable_live_client is False`):** `False`.
- **Condition 3 (`extractor_fn is not None and enable_live_client is not True`):** Evaluates to `True` because `extractor_fn=default_tender_extractor` is provided and `enable_live_client` is `None` (which is `not True`).
- **Result:** `self.live_client` is set to `None`.
- **Condition 4 (`elif settings.llm_api_key:`):** Unreachable code. Even if a valid OpenRouter or OpenAI API key is present in `.env`, the client constructor never initializes `OpenAICompatibleLlmClient`.

#### 3. `StructuredLLMClient.extract_compliance` (`models/llm_client.py`, lines 93–127)

```python
        # 3. Live LLM Gateway Extraction (when configured and circuit is intact)
        if self.live_client is not None and not self._live_circuit_broken:
            try:
                items = await self.live_client.extract_compliance(...)
                return items
            except Exception as err:
                ...
        # 4. Custom / Deterministic Extractor Function (or default extraction)
        if self.extractor_fn:
            if inspect.iscoroutinefunction(self.extractor_fn):
                return await self.extractor_fn(system_prompt, sanitized_prompt)
            return self.extractor_fn(system_prompt, sanitized_prompt)
```

Because `self.live_client` was forced to `None`, Step 3 is skipped. Step 4 is immediately executed, invoking `default_tender_extractor` in Python user space.

### 1.3 Root Cause 2: Gateway Deprecation (HTTP 404) & Free-Tier Exhaustion (HTTP 429)

Even when `enable_live_client=True` is explicitly passed to force `OpenAICompatibleLlmClient` initialization, the live gateway encounters provider failure.

**Configuration in `.env`:**

- `LLM_API_KEY`: `sk-or-v1-5025ac424...`
- `LLM_BASE_URL`: `https://openrouter.ai/api/v1`
- `LLM_MODEL`: `minimax/minimax-m3.1-flash:free`

**Live Gateway Probe Output:**

```text
[OpenAICompatibleClient] Model 'minimax/minimax-m3.1-flash:free' returned HTTP 404. Switching to next free model in pool...
[OpenAICompatibleClient] Model 'nvidia/nemotron-3.5-lightning:free' rate-limited (429). Rotating to next free model in pool...
[OpenAICompatibleClient] Model 'liquid/lfm-2.5-2.6b:free' rate-limited (429). Rotating to next free model in pool...
[OpenAICompatibleClient] Model 'google/gemma-4-31b-it:free' rate-limited (429). Rotating to next free model in pool...
[OpenAICompatibleClient] Model 'google/gemma-4-26b-a4b-it:free' rate-limited (429). Rotating to next free model in pool...
[OpenAICompatibleClient] Model 'nvidia/nemotron-3-super-120b-a12b:free' rate-limited (429). Rotating to next free model in pool...
[OpenAICompatibleClient] Model 'nvidia/nemotron-3-ultra-550b-a55b:free' rate-limited (429). Rotating to next free model in pool...
[OpenAICompatibleClient] Model 'poolside/laguna-s-2.1:free' rate-limited (429). Rotating to next free model in pool...
[OpenAICompatibleClient] Chat completion failed across all free models
```

**Circuit Breaker Cascading (`models/llm_client.py`, lines 102–110):**

```python
status_code = getattr(getattr(err, "response", None), "status_code", None)
if status_code in (401, 402, 403, 404):
    self._live_circuit_broken = True
```

HTTP 404 from the removed OpenRouter slug permanently trips `self._live_circuit_broken = True`. Every subsequent page extraction immediately diverts to `default_tender_extractor`, resulting in deterministic, sub-10ms regex parsing.

---

## 2. Feature F2: Upfront 5 Architectural Stages Audit

An in-depth code and artifact audit was conducted across the 5 pre-processing stages defined in `ProductionExtractionPipeline.execute()` using inspection output artifacts (`node1_output.md` through `node5_output.md`).

```text
Raw PDF Text
    │
    ▼
[Stage 1: DoclingParserEngine] ────────► 338 single-line blocks; 0 tables; chainages as headings
    │
    ▼
[Stage 2: DocumentStructureBuilder] ───► 44 bogus Level 3 nodes (dates, chainages, numbers)
    │
    ▼
[Stage 3: TenderChunker] ──────────────► Fragmented chunks flushed on bogus nodes; chunks discarded!
    │
    ▼
[Stage 4: CandidateDetector] ──────────► Line-by-line sieve; drops <15-char fragments; rescue drops them
    │
    ▼
[Stage 5: ContextAssembler] ───────────► 1-line window envelopes; window offset slicing truncates quotes
    │
    ▼
[Downstream LangGraph Workflow]
```

### 2.1 Stage 1: `DoclingParserEngine.parse_document()`

- **Source File:** `apps/ai/src/tenderpulse_ai/domain/docling_parser.py`
- **Artifact Inspected:** `inspection_output/node1_output.md` (Total Blocks: 338, Total Tables: 0)

1. **Line-by-Line Document Shredding (Lines 214–215):**

   ```python
   lines = [line.strip() for line in text_content.splitlines() if line.strip()]
   for line in lines:
       ...
       DoclingBlock(block_id=f"blk_{page_no}_{block_counter}", text=line, ...)
   ```

   Instead of aggregating cohesive paragraphs, `DoclingParserEngine` splits text strictly on raw newline characters (`\n`). For `02_NHAI_Greenfield_Exp_1450Cr_NIT.pdf`, this generates 338 individual blocks across 8 pages. Any sentence that wraps across visual lines in the PDF is split across distinct blocks.

2. **Table Extraction Failure (Lines 224–226):**

   ```python
   is_table_row = ("|" in line or "\t" in line) and not re.match(r"^\|?\s*[-:]+\s*\|", line)
   ```

   Standard PDF text extractors (such as `pypdfium2`) represent tabular layouts using whitespace column alignment, not Markdown pipes (`|`) or tabs (`\t`). As a result:
   - **Total Tables Detected:** 0.
   - **Table 1 (Project Chainage & Sections, Page 1)** was decomposed into 15 disjoint text lines.
   - **Clause 13.C (Technical Capacity Tiers, Page 5–6)** was shredded into loose numbers (`6 12 25 40`).

3. **Heading Classification Regex False Positives (Lines 217–222):**
   ```python
   is_heading = bool(re.match(r"^(PART\s+[I|V|X]+|SECTION\s+\d+|\d+(\.\d+)*\b|ARTICLE\s+\d+|CLAUSE\s+\d+)", line, re.IGNORECASE))
   ```
   The regex branch `\d+(\.\d+)*\b` matches any line starting with numbers or decimals:
   - Block `blk_1_6`: `93.140) to Km. 170.000` was classified as `HEADING Level 3`.
   - Block `blk_3_12`: `22.01.2026 to 19.02.2026` was classified as `HEADING Level 3`.

### 2.2 Stage 2: `DocumentStructureBuilder.build_structure()`

- **Source File:** `apps/ai/src/tenderpulse_ai/domain/structure_builder.py`
- **Artifact Inspected:** `inspection_output/node2_output.md` (Total Structural Nodes: 44)

1. **Greedy Clause Pattern (Lines 28–31):**

   ```python
   CLAUSE_PATTERN = re.compile(
       r"^(?:(?:Clause|Sub-Clause)\s+)?(\d+(?:\.\d+)*|\d+\.)(?:\s+|$)",
       re.IGNORECASE,
   )
   ```

   Because the prefix `(?:(?:Clause|Sub-Clause)\s+)?` is optional, the pattern matches any block beginning with digits.

2. **AST Corruption (44 Bogus Structural Nodes):**
   The document structure tree was populated with erroneous Level 3 clause nodes:
   - Node `sec_node_4`: `[L3] 348.000` (derived from chainage `Km. 348.000 of NH-71`).
   - Node `sec_node_5`: `[L3] 9.45` (derived from link length `9.45` km).
   - Node `sec_node_10`: `[L3] 22.01.2026` (derived from RFP download schedule).
   - Node `sec_node_24`: `[L3] 10` (derived from turnover table cell `10 25 40 60`).
   - Node `sec_node_30`: `[L3] 0.5` (derived from `0.5 thus making him ineligible`).
   - Node `sec_node_33`: `[L3] 2` (derived from `2 years, have neither failed to perform`).

3. **Parent-Child Hierarchy Pollution:**
   In `DocumentStructureBuilder.build_structure`, subsequent blocks attach to the most recently created `current_clause`. Consequently:
   - The INFRACON portal instructions immediately following line `9.45` became child blocks of Clause `9.45`.
   - In `ContextAssembler`, this candidate was labeled: `Clause Reference: 9.45 (Page 1)`.

### 2.3 Stage 3: `TenderChunker.chunk_document()`

- **Source File:** `apps/ai/src/tenderpulse_ai/domain/tender_chunker.py`
- **Artifact Inspected:** `inspection_output/node3_output.md`

1. **Forced Buffer Flushing on Bogus Node Changes (Lines 198–216):**

   ```python
   if node != curr_node and curr_buffer:
       ...
       flush_buffer(prev_clause, prev_sec, prev_path, keep_overlap=False)
   ```

   Because bogus clause nodes appear throughout each page (e.g., chainages, dates, numbers), `curr_node` changes constantly, forcing the chunker to flush buffers mid-sentence. Sentences describing eligibility criteria are broken across multiple chunks.

2. **Architectural Pipeline Disconnect (`pipeline.py`, lines 2898–2900 vs. 2950–2960):**
   ```python
   # Line 2898:
   chunker = TenderChunker()
   extracted_chunks = chunker.chunk_document(docling_doc, doc_tree)
   wire_chunks = [c.to_wire_dict() for c in extracted_chunks]
   ...
   # Line 2950:
   retrieval_tool.seed_chunks([
       DocumentChunk(
           chunk_id=f"chk_{request.document_id}_{page.page_number}",
           tenant_id=sec_ctx.tenant_id,
           document_id=request.document_id,
           page_number=page.page_number,
           clause_reference=f"Page {page.page_number}",
           text=page.text,
       )
   ])
   ```
   `extracted_chunks` is completely discarded during workflow execution. Instead, `retrieval_tool` is seeded with a coarse, whole-page dummy chunk (`chk_{doc_id}_{page}`). All chunk boundaries and metadata computed in Stage 3 are ignored.

### 2.4 Stage 4: `CandidateDetector.detect_candidates_with_unselected()`

- **Source File:** `apps/ai/src/tenderpulse_ai/domain/candidate_detector.py`
- **Artifact Inspected:** `inspection_output/node4_output.md`

1. **Line-Level Heuristic Sieve (Lines 324–359):**
   `CandidateDetector` iterates over individual 1-line blocks. If a line is shorter than 15 characters and lacks explicit keywords, it is routed to `unselected_passages`.

2. **The "Short Passage" Elimination Trap:**
   - In `candidate_detector.py` (line 324): `is_short = len(text) < 15`. Short fragments without keywords are relegated to `unselected`.
   - In LangGraph `rescue_pass_node` (`nodes.py`, lines 529–535):
     ```python
     page_unselected = [
         u for u in unselected_raw
         if isinstance(u, dict)
         and u.get("page_number") == page_no
         and len(u.get("text", "").strip()) >= 15
     ]
     ```
   - **Architectural Trap:** Critical numerical thresholds formatted on short lines (e.g., table cells like `Rs. 5 Cr`, `6 12 25 40`, `30%`, `50%`) are dropped into `unselected_passages` by Stage 4, and then immediately discarded by `rescue_pass_node` because their length is `< 15`. They are permanently purged from the pipeline.

### 2.5 Stage 5: `ContextAssembler.assemble_contexts()`

- **Source File:** `apps/ai/src/tenderpulse_ai/domain/context_assembler.py`
- **Artifact Inspected:** `inspection_output/node5_output.md`

1. **Single-Line Context Envelopes (Lines 57–62):**

   ```python
   prev_text = block_list[idx - 1].text if (idx is not None and idx > 0) else None
   next_text = block_list[idx + 1].text if (idx is not None and idx < len(block_list) - 1) else None
   ```

   Because blocks represent single visual lines, `current_clause` contains only a single visual line. `previous_clause` and `following_clause` contain only the immediately preceding and following visual lines, providing insufficient context for complex clauses.

2. **Verbatim Window Slicing & Visual Line Shredding:**
   In the raw PDF text of Page 5, the relevant table cell text is wrapped across lines:
   ```text
   Line 1: project length and b. At
   Line 2: least one O&M project Under DBFOT/OMT/ O &
   Line 3: M of four/six laning** of
   Line 4: 50% of project length.
   ```
   Because `DoclingParserEngine` creates a separate block for each visual line without sentence re-assembly, Line 3 was extracted as an isolated block: `blk_5_3: "M of four/six laning** of"`.
   Then in `pipeline.py` (lines 680–683):
   ```python
   def _extract_verbatim_window(keyword_match: str, text: str, max_chars: int = 140) -> str:
       idx = text.lower().find(keyword_match.lower())
       start = max(0, idx - 15)
       end = min(len(text), idx + len(keyword_match) + 85)
       return re.sub(r"\s+", " ", text[start:end].strip())
   ```
   When `_extract_verbatim_window` operates on `blk_5_3.text` with keyword `four/six laning`, it extracts `"M of four/six laning** of"`, losing both the preceding clause context (`Under DBFOT/OMT/O&M`) and the following threshold (`50% of project length`).

---

## 3. Feature F3: Persisted Database Quality Audit (`doc-1792674132147` / `bid-1792585047102-qeidm5`)

### 3.1 Database Query & Scope

The audit inspected table `compliance_items` in PGlite (`./data/postgres`) for:

- **Document ID:** `doc-1792674132147`
- **Bid ID:** `bid-1792585047102-qeidm5`
- **Total records persisted:** 13 items.

```sql
SELECT id, category, title, description,
       provenance->>'clauseReference' AS clause_ref,
       provenance->>'pageNumber' AS page_no,
       provenance->>'verbatimQuote' AS quote,
       execution_rules
FROM compliance_items
WHERE bid_id = 'bid-1792585047102-qeidm5'
ORDER BY id;
```

### 3.2 Detailed Quality Inventory of 13 Persisted Items

| #      | Item ID           | Category      | Persisted Title                                                      | Clause Reference                   | Page | Persisted Verbatim Quote                                                                                                                                                           | Detailed Quality Defect Analysis                                                                                                                                                                                                                  |
| :----- | :---------------- | :------------ | :------------------------------------------------------------------- | :--------------------------------- | :--- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1**  | `cmp-3d06d8f0...` | `TECHNICAL`   | Technical Qualification & Similar Work Experience                    | `Clause on Page 5`                 | 5    | `"M of four/six laning** of"`                                                                                                                                                      | **Severe Quote Truncation:** Verbatim quote is 24 characters of broken text containing raw markdown asterisks (`**`). Missing operational context and 0 numeric thresholds (30% and 50% length rules completely omitted). Vague clause reference. |
| **2**  | `cmp-411d08da...` | `EXECUTION`   | Mandatory Electronic Proposal Submission on E-Portal                 | `Clause 17 (Page 8)`               | 8    | _Clause 17 mandate requiring electronic-only submission of Technical and Financial proposals on the e-portal, subject to NHAI rejection for non-adherence._                        | **Partial Coverage:** Accurate quote for Clause 17, but completely misses Sub-clause 17(b) which strictly bars physical submissions.                                                                                                              |
| **3**  | `cmp-448a967b...` | `STATUTORY`   | Form-26AS Income Tax Certification for Permanent Key Personnel       | `Clause on Page 6`                 | 6    | _Note (v) mandate requiring submission of Form-26AS to certify permanent key personnel under Sr. No. 2 of the capacity table._                                                     | **Vague Clause Citation:** Cited as `Clause on Page 6` instead of `Clause 13.C Note (v)`. Fails to extract the core threshold: permanent personnel must be on firm rolls for at least 1 year.                                                     |
| **4**  | `cmp-48e565a9...` | `FINANCIAL`   | RFP Document Fee Payment                                             | `Clause 6 (Page 3)`                | 3    | _Clause 6 instruction covering the 22.01.2026–19.02.2026 download window and Rs. 5,000/- NEFT/RTGS fee, cutting off abruptly at the `"Sl. No. Particulars Details"` table header._ | **Abrupt Quote Termination:** Quote terminates mid-sentence on the table header `"Sl. No. Particulars Details"`, omitting beneficiary bank details, Account No. (`0385201800065`), and IFSC Code (`CNRB0001624`).                                 |
| **5**  | `cmp-659818bf...` | `COMMERCIAL`  | Bid Due Date & Technical Proposal Opening Schedule                   | `Clause 20 (Page 8)`               | 8    | _Clause 20 first sentence specifying the 11:00 Hrs on 19.02.2026 Bid Due Date._                                                                                                    | **Incomplete Schedule:** Captures Bid Due Date, but omits the Technical Proposal Opening date/time (`20.02.2026 at 11:30 Hrs`) and RO Chandigarh submission address.                                                                              |
| **6**  | `cmp-6dca61f6...` | `TECHNICAL`   | Mandatory INFRACON Portal Registration & Team ID                     | `Table 1 (Page 1)`                 | 1    | _Conflated block merging Table 1 highway chainages (`NH-10`, `NH-09`, `93.140` to `182.500`, `9.45`) with the INFRACON portal receipt and evaluation mandate._                     | **Quote Conflation:** Highway chainage table (`NH-10 NH-09 93.140 182.500...`) is conflated into the INFRACON registration quote. Clause reference is misattributed to `Table 1 (Page 1)` instead of `Clause 1`.                                  |
| **7**  | `cmp-74894de3...` | `OPERATIONAL` | Data Lake Portal Utilization for Contractual Correspondence          | `Clause 17 (Page 8)`               | 8    | _Merged text combining Clause 17 general electronic proposal submission rules with Sub-clause 17(a) Data Lake Portal contractual correspondence instructions._                     | **Clause Conflation:** Merges general electronic submission rules with Data Lake Portal correspondence instructions into a single bloated quote.                                                                                                  |
| **8**  | `cmp-ba413bae...` | `LEGAL`       | Public Domain Hosting Consent for Consultant & Personnel Credentials | `Clause 17 (Page 8)`               | 8    | _Merged text combining Clause 19 key personnel public-domain credential hosting undertaking with the Clause 20 Bid Due Date sentence._                                             | **Wrong Clause Attribution & Bleed:** Text begins with `19.` and bleeds into `Clause 20`, but the clause citation is misattributed to `Clause 17 (Page 8)`.                                                                                       |
| **9**  | `cmp-bee8fc59...` | `LEGAL`       | Conflict of Interest & Non-Collusion Undertaking                     | `Clause 13 (Page 4)`               | 4    | _Clause 13 introductory sentence restricting eligibility to consulting firms meeting the criteria and not in conflict of interest with the Contractor._                            | **Vague Description:** Lacks operational definition of conflict (e.g., relationship with Concessionaire / EPC contractor executing O&M and Clause 9 substitution rule).                                                                           |
| **10** | `cmp-cb4aa5ab...` | `LEGAL`       | Integrity Pact & Non-Blacklisting Declaration                        | `Clause 14 (Page 7)`               | 7    | _Final sentence of Clause 15 stating that consultants or JV partners under active NHAI debarment as on the application date will not be entertained._                              | **Wrong Clause Citation:** Text is from `Clause 15`, but attributed to `Clause 14 (Page 7)`. Drops the 2-year non-performance penalty and MoRT&H expulsion rules.                                                                                 |
| **11** | `cmp-cd16abef...` | `EXECUTION`   | Joint Venture & Consortium Agreement Requirements                    | `Clause on Page 6 (Pages 4, 6, 7)` | 6    | _Clause 13.C Note (3) rule declaring a JV bid non-responsive if any individual partner's remaining bid capacity is less than 0.5 even if combined JV capacity exceeds 0.5._        | **Vague Citation & Missing Scope:** Cited as `Clause on Page 6 (Pages 4, 6, 7)`. Drops the JV ceiling (max 2 partners) and the 75%/40% turnover split requirements.                                                                               |
| **12** | `cmp-dd1d68b5...` | `OPERATIONAL` | Assignment Duration & Period of Service                              | `Clause 10 (Page 4)`               | 4    | _Clause 10 sentence specifying the 60-month total duration for the Supervision Consultant assignment._                                                                             | **Accurate:** Single-line clean quote matching Clause 10.                                                                                                                                                                                         |
| **13** | `cmp-f020ac64...` | `TECHNICAL`   | Technical Qualification & Annual Turnover                            | `Clause on Page 5 (Pages 4, 5)`    | 5    | _Merged block containing the `_` footnote on Chartered Accountant certification of Annual Turnover and the Clause 13.B JV partner turnover split (75% Lead / 40% Partner).\*       | **Missing Financial Threshold:** The core financial qualification threshold (`Rs. 5.0 Crores` across 5-year avg OR preceding 2 years) is completely absent from both the quote and the description! Vague clause reference.                       |

### 3.3 Root Cause of Database Defects: Synthetic Fallback Generation

In `apps/ai/src/tenderpulse_ai/pipeline.py` (lines 1170–1210), `default_tender_extractor` defines 44 static candidate rules. For example, rule 7:

- `title="Technical Qualification & Similar Work Experience"`
- `description="Demonstrated technical threshold capacity through prior successful execution of similar projects."`
- Quote resolution calls `_extract_verbatim_window()`, which sliced `"M of four/six laning** of"` from Page 5.

The descriptions and titles in the persisted database were not generated dynamically by an LLM analyzing the tender document, but were **static string stubs emitted by the fallback regex engine**.

---

## 4. Feature F4: Side-by-Side Gap Analysis Matrix (13 Persisted Items vs. 24 Core + 6 Extended Benchmark Obligations)

### 4.1 Benchmark Methodology

To establish an objective ground-truth baseline, the unabridged raw text of all 8 pages of `02_NHAI_Greenfield_Exp_1450Cr_NIT.pdf` was analyzed against the canonical `CandidateComplianceItem` schema. Every operative clause containing mandatory obligations (`shall`, `must`, `is required to`, `will be disqualified`, `ceiling`, `SLA`, `penalty`) was extracted into **24 core benchmark obligations (`B1`–`B24`)** plus **6 extended scope/quota obligations (`B25`–`B30`)** identified during the multi-PDF forensic review.

### 4.2 Side-by-Side Gap Analysis Matrix (`B1`–`B30`)

| #       | Obligation Title & Full Operative Specification                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Source Clause & Page                         | Persisted in DB (13 Items)? | Status & Quality Assessment in Persisted Database                                                                                                                                                |
| :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------- | :-------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1**  | **Mandatory INFRACON Portal Registration & Unique Team ID**<br>Consulting firm and all proposed key personnel must mandatorily register on MoRT&H INFRACON portal (`www.infracon.nic.in`) and generate a unique Team ID prior to bid submission. Proposals without valid INFRACON registration will not be evaluated.                                                                                                                                                                                                    | Clause 1, Page 1                             | YES (Item 6)                | **DEFEATED:** Attributed to `Table 1 (Page 1)`. Verbatim quote conflates highway chainages (`NH-10 NH-09 93.140 182.500...`) into the INFRACON requirement text.                                 |
| **B2**  | **Bi-Annual Drone Highway Inspection Survey SLA**<br>Mandatory obligation to conduct comprehensive road condition and asset surveys using Drone technology bi-annually in accordance with NHAI Circular no. `18.75/2021` dated `03.11.2021` at zero additional cost to the Authority.                                                                                                                                                                                                                                    | Clause 5(xix), Page 2                        | NO                          | **COMPLETELY MISSED (0% coverage).** Explicit technical SLA completely absent from the database.                                                                                                 |
| **B3**  | **Monthly Progress Report (MPR) Submission SLA**<br>Mandatory submission and upload of Monthly Progress Reports (MPR) and project monitoring data to NHAI PMIS portal within 7 days from the close of each calendar month in Annexure-III format.                                                                                                                                                                                                                                                                        | Clause 5(xv), Page 2                         | NO                          | **COMPLETELY MISSED (0% coverage).** Contractual operational SLA absent from the database.                                                                                                       |
| **B4**  | **Quality Assurance Testing & MoRT&H Specifications**<br>Duty to conduct, witness, and certify all quality assurance tests on materials and workmanship in strict conformity with MoRT&H Specifications for Road and Bridge Works.                                                                                                                                                                                                                                                                                       | Clause 5(xxi), Page 2                        | NO                          | **COMPLETELY MISSED (0% coverage).** Core engineering supervision obligation omitted.                                                                                                            |
| **B5**  | **RFP Document Fee Payment (Rs. 5,000 via NEFT/RTGS)**<br>Non-refundable tender fee of Rs. 5,000/- payable via NEFT/RTGS to Canara Bank, Sector 10 Panchkula, Account No. `0385201800065`, IFSC `CNRB0001624`, payable to NHAI, RO-Chandigarh. Proof of payment must be uploaded.                                                                                                                                                                                                                                        | Clause 6, Page 3                             | YES (Item 4)                | **DEFECTIVE:** Cited as `Clause 6 (Page 3)`. Quote abruptly terminates on table header `"Sl. No. Particulars Details"`, omitting bank account number and IFSC code.                              |
| **B6**  | **QCBS Evaluation Criteria (75% Technical Score & 80:20 Weightage)**<br>Quality and Cost Based Selection (QCBS) evaluation: Minimum technical qualifying score of 75%. Only the top 5 technically qualified non-conflicted firms will have financial proposals opened. Formula: 80% Technical score + 20% Financial score.                                                                                                                                                                                               | Clause 9, Page 3                             | NO                          | **COMPLETELY MISSED (0% coverage).** Core commercial evaluation rule absent from the database.                                                                                                   |
| **B7**  | **Assignment Duration & Period of Service (60 Months)**<br>Supervision consultancy contract period is 60 calendar months from mobilization date, subject to performance-based renewal at NHAI's discretion.                                                                                                                                                                                                                                                                                                              | Clause 10, Page 4                            | YES (Item 12)               | **MATCHED:** Correctly captured 60-month duration under `Clause 10 (Page 4)`.                                                                                                                    |
| **B8**  | **Joint Venture Ceiling: Maximum 2 Partners & Multi-JV Bar**<br>Joint Ventures are restricted to a maximum of 2 partners (1 Lead Member + 1 JV Partner). A consultant is strictly prohibited from participating in more than one JV for this tender.                                                                                                                                                                                                                                                                     | Clause 11, Page 4                            | NO                          | **COMPLETELY MISSED (0% coverage).** **Critical Disqualifier:** Exceeding 2 partners or participating in multiple JVs results in immediate rejection.                                            |
| **B9**  | **Equipment Technology Associates Exclusivity (5 Instruments)**<br>Consultants may associate for specialized equipment (NSV, FWD, MBIU, Retro-reflectometer, ATCC). **CRITICAL DISQUALIFIER:** Common associate across multiple bidders is strictly prohibited. If an Associate is common across multiple bids, ALL such proposals shall be disqualified and rejected.                                                                                                                                                   | Clause 12(A), Page 4                         | NO                          | **COMPLETELY MISSED (0% coverage).** **Major Hard Disqualifier:** Directly impacts bid responsiveness; completely absent from database.                                                          |
| **B10** | **Associate Key Personnel Ceiling (Max 2) & Binding MOU**<br>Maximum of two (2) Key Personnel allowed from the equipment associate firm. Bidder must submit a legally binding MOU explicitly detailing equipment ownership and personnel assignment.                                                                                                                                                                                                                                                                     | Clause 12(B), Page 4                         | NO                          | **COMPLETELY MISSED (0% coverage).** Mandatory staffing restriction omitted.                                                                                                                     |
| **B11** | **Conflict of Interest Disqualification with O&M Contractor**<br>Consulting firms meeting criteria must confirm absence of conflict of interest with the Concessionaire/Contractor executing the O&M works for this highway section.                                                                                                                                                                                                                                                                                     | Clause 13, Page 4                            | YES (Item 9)                | **POOR QUALITY:** Quote is a single generic clause line without operational definition or Clause 9 substitution terms.                                                                           |
| **B12** | **Past DPR Preparation Experience Threshold**<br>In the last 7 years, bidder must have completed DPR/FS cum PPR preparation for at least 2 projects of 4/6 laning of 30% project length (~29.6 km) OR at least 1 project of 50% project length (~49.4 km).                                                                                                                                                                                                                                                               | Clause 13.A.1, Page 4                        | NO                          | **COMPLETELY MISSED (0% coverage).** Explicit technical threshold missing from the database.                                                                                                     |
| **B13** | **Past Supervision / IE Experience Threshold**<br>In the last 7 years, bidder must have completed supervision/IE for at least 2 projects of 4/6 laning of 30% length (or 1 of 50% length) AND at least 1 O&M project under DBFOT/OMT/O&M of 4/6 laning of 50% project length (~49.4 km).                                                                                                                                                                                                                                 | Clause 13.A.1, Page 4–5                      | YES (Item 1)                | **DEFEATED (SEVERE QUALITY DEFECT):** Persisted quote is `"M of four/six laning** of"`. Clause citation is `Clause on Page 5`. Description has zero numeric thresholds.                          |
| **B14** | **Minimum Annual Turnover (Rs. 5.0 Crores — Avg of Last 5 Yrs OR Each of Preceding 2 Yrs)**<br>Annual turnover from consultancy business (average of last 5 financial years OR in each of the preceding two years) must be at least Rs. 5.0 Crores, duly certified by a Chartered Accountant.                                                                                                                                                                                                                            | Clause 13.A.2, Page 4–5                      | YES (Item 13)               | **DEFECTIVE:** Item 13 quote captures the CA certification note, but the actual turnover threshold (`Rs. 5 Crores`) and 5-yr/2-yr window are completely missing from both quote and description! |
| **B15** | **JV Turnover & Experience Split (Lead >= 75%, Partner >= 40%)**<br>In case of JV (max 1 JV partner), Lead Partner must meet at least 75% and JV Partner at least 40% of the Annual Turnover requirement. Both partners must possess eligible project experience.                                                                                                                                                                                                                                                        | Clause 13.B, Page 5                          | YES (Item 13)               | **CONFLATED:** Conflated into Item 13 text; lacks distinct tracking for lead vs. partner compliance evaluation.                                                                                  |
| **B16** | **Technical Capacity Tiered Matrix (Turnover vs. Staff vs. Projects)**<br>Four-tier matrix governing maximum ongoing NHAI projects based on 3-yr avg turnover (`Sr. No. 1`) AND full-time key staff on rolls $\ge 1$ yr (`Sr. No. 2` — both required per Note 1):<br>• Upto 10 Cr: 10 staff / max 6 projects (6 DPR / 4 IE-AE)<br>• >10–30 Cr: 25 staff / max 12 projects (12 DPR / 9 IE-AE)<br>• >30–60 Cr: 40 staff / max 25 projects (25 DPR / 18 IE-AE)<br>• >60 Cr: 60 staff / max 40 projects (40 DPR / 30 IE-AE). | Clause 13.C Table & Note (1), Page 5–6       | NO                          | **COMPLETELY MISSED (0% coverage).** Shredded into single numbers (`6 12 25 40`) during Stage 1 parsing and discarded.                                                                           |
| **B17** | **Ceiling on IE / AE Assignments (Max 75% of Project Quota)**<br>Out of the total allowable projects under Clause 13.C, maximum 75% can be Independent Engineer (IE) or Authority’s Engineer (AE) assignments. Financial Proposals of firms crossing the upper ceiling shall not be opened.                                                                                                                                                                                                                              | Clause 13.C Note (i), Page 6                 | NO                          | **COMPLETELY MISSED (0% coverage).** Ongoing project quota restriction missing.                                                                                                                  |
| **B18** | **JV Ineligible Partner Bid Capacity Rule (< 0.5 Threshold)**<br>If any JV partner has individual remaining bid capacity `< 0.5` making them individually ineligible, but JV capacity exceeds `0.5`, the JV bid shall be declared non-responsive.                                                                                                                                                                                                                                                                        | Clause 13.C Note (3), Page 6                 | YES (Item 11)               | **PARTIALLY MATCHED:** Captures Note (3), but clause reference is vague (`Clause on Page 6 (Pages 4, 6, 7)`) and omits Note (2) weighted average capacity formula.                               |
| **B19** | **Mandatory Form-26AS Submission for Permanent Key Personnel**<br>Bidder must submit statutory Income Tax Form-26AS to certify that proposed permanent key personnel (Sr. No. 2 of table) have been on firm full-time rolls for at least one year.                                                                                                                                                                                                                                                                       | Clause 13.C Note (v), Page 6                 | YES (Item 3)                | **MATCHED (WITH DEFECT):** Captured quote, but clause reference is vague (`Clause on Page 6`) and description lacks link to Sr. No. 2 1-year roll verification.                                  |
| **B20** | **Historical Escalation Multipliers (1.00 to 1.61) & Foreign Currency SBI BC Rate**<br>Past turnover and consultancy fees shall be indexed using statutory escalation factors: FY of RFP = `1.00`, 1 yr prior = `1.10`, 2 yrs = `1.21`, 3 yrs = `1.33`, 4 yrs = `1.46`, 5 yrs = `1.61`. For foreign currency, escalation factors do not apply; use SBI BC Selling Rate as on last date of bid submission.                                                                                                                | Clause 14, Page 7                            | NO                          | **COMPLETELY MISSED (0% coverage).** Financial normalization formula omitted.                                                                                                                    |
| **B21** | **2-Year Non-Performance, Penalty, Termination & Debarment Covenant**<br>Debarred firms are barred. Furthermore, in the past 2 years, firm/JV member must not have failed to perform on Expressways/NH/ISC/EI works (evidenced by arbitral/judicial penalty or award) or been expelled/terminated by MoRT&H or its agencies for breach.                                                                                                                                                                                  | Clause 15, Page 7                            | YES (Item 10)               | **DEFECTIVE:** Cited as `Clause 14 (Page 7)`. Only quotes the debarment sentence, dropping the 2-year non-performance penalty and MoRT&H expulsion rules!                                        |
| **B22** | **Strictly Electronic Submission (Physical Submissions Barred)**<br>Proposals must be submitted strictly in electronic form via e-portal. Physical submission of technical or financial proposals is strictly barred (`17.b`) and leads to bid rejection.                                                                                                                                                                                                                                                                | Clause 17 & 17.b, Page 8                     | YES (Item 2)                | **PARTIALLY MATCHED:** Captures Clause 17 electronic upload rule, but omits Sub-clause `17(b)` physical submission bar.                                                                          |
| **B23** | **Mandatory Utilization of NHAI Data Lake Portal for Correspondence**<br>Selected consultant must utilize NHAI Data Lake Portal (`nhai.gov.in`) for all formal contractual correspondence with NHAI and O&M Contractor.                                                                                                                                                                                                                                                                                                  | Clause 17.a, Page 8                          | YES (Item 7)                | **CONFLATED:** Conflated with Clause 17 general text.                                                                                                                                            |
| **B24** | **Public Domain Hosting Consent (`18` & `19`) & Bid Due Date Schedule (`20`)**<br>Firm (`18`) and all proposed key personnel (`19`) must consent to public hosting of credentials on NHAI web portals. Bid Due Date: `19.02.2026` at `11:00 Hrs`; Technical Opening: `20.02.2026` at `11:30 Hrs` at NHAI RO Chandigarh.                                                                                                                                                                                                  | Clauses 18, 19 & 20, Page 8                  | YES (Items 5, 8)            | **DEFECTIVE:** Item 8 is labeled `Clause 17 (Page 8)` when text is from Clauses 19 & 20; Item 5 omits opening schedule and venue.                                                                |
| **B25** | _(Extended Benchmark)_ **Mandatory English Language Submission & Correspondence**<br>Proposal and all correspondence must be submitted in the English language.                                                                                                                                                                                                                                                                                                                                                          | Clause 3, Page 2                             | NO                          | **COMPLETELY MISSED (0% coverage).**                                                                                                                                                             |
| **B26** | _(Extended Benchmark)_ **Uncompensated PIU/Authority Directed Duties**<br>Consultant must perform any functions/duties directed by PIU/Authority for the project stretch without any additional cost.                                                                                                                                                                                                                                                                                                                    | Clause 5(xviii), Page 2                      | NO                          | **COMPLETELY MISSED (0% coverage).** Commercial scope-creep risk flag.                                                                                                                           |
| **B27** | _(Extended Benchmark)_ **Wayside Amenities, ETC/Fee Plaza, ATMS & Incident Log-Book Verification**<br>Inspect and monitor Wayside Amenities, ETC, Fee Plaza, ATMS, verify incident management vehicle log-books, and conduct road condition surveys using latest instruments.                                                                                                                                                                                                                                            | Clause 5(xxiii)–(xxiv), Page 3               | NO                          | **COMPLETELY MISSED (0% coverage).**                                                                                                                                                             |
| **B28** | _(Extended Benchmark)_ **Pro-Rata JV Experience Weightage & CA Payment Certificate Substitute (`**`)\*\*<br>JV experience weightage is proportional to payment received. Client certificate is accepted; in its absence, CA-certified proportion of consultancy fee received is accepted; without either, zero weightage is given.                                                                                                                                                                                       | Clause 13.B Note & `**`, Page 5              | NO                          | **COMPLETELY MISSED (0% coverage).** Crucial rule for Vault evidence matching.                                                                                                                   |
| **B29** | _(Extended Benchmark)_ **Ongoing Project Quota Carve-Outs & Exemptions**<br>Only NHAI projects awarded/in-progress on Financial Bid opening date count. Exempted: (a) IE/AE where original period + 1 yr lapsed or provisional completion issued; (b) DPR where civil bids received or original period + 1 yr lapsed; (c) contracts `< 6 months`; (d) O&M contracts; (e) standalone Special Projects (tunnel, bridge, ELF, flyovers, ROB/RUB/Underpass).                                                                 | Clause 13.C Notes (ii), (iii) & (iv), Page 6 | NO                          | **COMPLETELY MISSED (0% coverage).** Without this rule, capacity engine falsely disqualifies bidders with ongoing O&M or State Highway works.                                                    |
| **B30** | _(Extended Benchmark)_ **Mandatory Form T-11 (`Annex-B-13`) Technical Capacity Submission**<br>Bidders must submit requisite technical capacity details in modified Form T-11 enclosed at Annex-B-13.                                                                                                                                                                                                                                                                                                                    | Clause 13.C Note (vi), Page 7                | NO                          | **COMPLETELY MISSED (0% coverage).**                                                                                                                                                             |

### 4.3 Statistical Analysis & Defect Taxonomy

```text
Core Benchmark Obligations (B1–B24): 24  (Extended Corpus Ground Truth B1–B30: 30)
Persisted Items in Database:         13
Omitted Core Obligations:            11  (45.83% ~ 46% core omission rate; 56.7% extended omission rate)
Quality Breakdown of the 13 Persisted Items:
├── Severely Defective / Truncated Quotes: 3 items (23.1%) [Items 1, 4, 10]
├── Missing Critical Numeric Thresholds:   2 items (15.4%) [Items 1, 13]
├── Vague / Erroneous Clause Citations:    5 items (38.5%) [Items 1, 3, 6, 8, 10]
├── Conflated Multi-Clause Text:           2 items (15.4%) [Items 6, 7]
└── Fully Accurate Items:                  1 item  (7.7%)  [Item 12]
```

**Conclusion:** Only 1 out of 13 persisted items (7.7%) meets production compliance quality standards.

---

## 5. Reproducible Verification Commands

The following commands enable independent verification of all observations, metrics, and findings documented in this audit report.

### 5.1 Verification 1: Persisted Database Inspection (PGlite)

Execute the database query script to inspect all 13 items for `bid-1792585047102-qeidm5`:

```bash
node .agents/teamwork/explorer_diag_bench_1/query_items.mjs
```

**Expected Verification:**

- Total records printed: Exactly 13.
- Item 1 verbatim quote: `"M of four/six laning** of"`.
- Item 13 turnover threshold: Numeric amount (`Rs. 5 Crores`) is absent from description and quote.
- Item 8 clause citation: Labeled `Clause 17 (Page 8)` for text beginning with `19.` and `20.`.

### 5.2 Verification 2: Live LLM Gateway 404 & 429 Probe

Run the live LLM gateway test script to verify gateway error responses and circuit breaker behavior:

```bash
PYTHONPATH=apps/ai/src .venv/bin/python .agents/teamwork/explorer_diag_bench_1/test_live_llm.py
```

**Expected Verification:**

- Model `minimax/minimax-m3.1-flash:free` returns HTTP 404.
- Fallback rotation models (`nemotron`, `liquid`, `gemma`) return HTTP 429.
- Circuit breaker triggers: `_live_circuit_broken = True`.

### 5.3 Verification 3: Upfront Parser Inspection Node Artifacts

Inspect the generated artifacts in `inspection_output/`:

- **Stage 1:** `inspection_output/node1_output.md` (lines 8–10): `Total Blocks Extracted: 338`, `Total Tables Detected: 0`.
- **Stage 2:** `inspection_output/node2_output.md` (lines 18–35): Confirms bogus Level 3 nodes `[L3] 348.000`, `[L3] 9.45`, `[L3] 22.01.2026`.
- **Stage 4:** `inspection_output/node4_output.md` (lines 13–33): Confirms candidate assigned `Clause Reference: 9.45` from link length block.
- **Stage 5:** `inspection_output/node5_output.md` (lines 14–85): Confirms clause citations `Particulars (Page 3)`, `partners (Page 4)`.

### 5.4 Verification 4: PyPDFium2 8-Page Tender Text Extraction

Verify that `02_NHAI_Greenfield_Exp_1450Cr_NIT.pdf` consists of 8 physical pages containing 20,069 characters:

```bash
.venv/bin/python -c "
import pypdfium2 as pdfium
pdf = pdfium.PdfDocument('data/procurement-evidence/01_Tender_Documents/02_NHAI_Greenfield_Exp_1450Cr_NIT.pdf')
print('Page count:', len(pdf))
total_chars = sum(len(p.get_textpage().get_text_range()) for p in pdf)
print('Total characters:', total_chars)
"
```

**Expected Verification:**

- Page count: `8`
- Total characters: `20069`

### 5.5 Verification 5: Verbatim Window Slicing Reproduction

Verify the mechanical origin of `"M of four/six laning** of"` from raw visual line extraction:

```bash
.venv/bin/python -c "
import pypdfium2 as pdfium
from tenderpulse_ai.pipeline import _extract_verbatim_window
pdf = pdfium.PdfDocument('data/procurement-evidence/01_Tender_Documents/02_NHAI_Greenfield_Exp_1450Cr_NIT.pdf')
page5_lines = [l.strip() for l in pdf[4].get_textpage().get_text_range().splitlines() if l.strip()]
target_line = [l for l in page5_lines if 'four/six' in l][0]
print('Raw PDF visual line:', repr(target_line))
assert target_line == 'M of four/six laning** of'
quote = _extract_verbatim_window('four/six laning', target_line)
print('Resulting quote from line block:', repr(quote))
assert quote == 'M of four/six laning** of'
print('Successfully verified: raw PDF visual line is directly extracted as severed quote.')
"
```

---

## 6. Feature F5: Multi-Tender Corpus Stress-Test (`01_NHAI_HAM_850Cr_NIT.pdf` & `10_NHAI_Outer_Ring_Exp_1850Cr_NIT.pdf`)

Stress-testing the pipeline design against the 99-page Civil FOB tender (`01_NHAI_HAM_850Cr_NIT.pdf`) and the 146-page IHMCL WIM Opex RFP (`10_NHAI_Outer_Ring_Exp_1850Cr_NIT.pdf`) exposed **four additional systemic hazards**:

### 6.1 Hazard 1: "Deleted Clause" Ghost Extractions (`01_NHAI_HAM_850Cr_NIT.pdf`)

In `01_NHAI_HAM_850Cr_NIT.pdf`:

- **Page 62 (GCC Clause 46 — Advance Payment):** Contains three full sub-clauses (`46.1`, `46.2`, `46.3`) detailing a **10% interest-bearing Mobilization Advance at SBI PLR + 2%**, but each paragraph concludes with `- Deleted` / `- DELETED.` (and ITB Clause 34 on Page 21 also states `34. Advances: Deleted`).
- **Page 88 (Contract Data Clause 7.1):** States `The limit of subcontracting is 50% of initial contract price - DELETED`.
- **Page 61 & Page 82 of `10_NHAI...`:** `Form-T:12 - Deleted` and `Clause 1.2.30(e) Deleted`.

**Impact:** Without a Deleted-Clause Sanitizer in Stage 1, any regex or chunk-level extractor captures a false-positive 10% Mobilization Advance and 50% Subcontracting entitlement.

### 6.2 Hazard 2: Long-Range "Shell Clauses" vs. `Contract Data` & `Appendix to ITB` (`01_NHAI_HAM_850Cr_NIT.pdf`)

In `01_NHAI_HAM_850Cr_NIT.pdf`, the ITB and GCC contain **shell clauses** whose actual numerical parameters reside 30–80 pages away in **NIT 1.1 (Page 4)**, **Appendix to ITB (Page 23)**, or **Contract Data (Pages 88–89)**:

- **ITB 4.4A(a) & (b) (Page 11) $\rightarrow$ NIT 1.1 (Page 4):** Estimated Cost `Rs. 3,59,33,592/-` (excl. GST); Bid Security `Rs. 7,18,700/-`; 3-Yr Average Turnover `Rs. 1,07,80,078/-` (with 3-month FY closing ignore rule + 7-yr CA-certified civil works & ITRs per Clause 12.2(g)); Similar Work (FOB on NH, last 7 yrs, $\ge 90\%$ completed): `1 work of Rs. 287.5L` OR `2 works of Rs. 179.7L` OR `3 works of Rs. 143.7L`; Completion Period: `12 months`.
- **ITB 4.4B(b)(i) & (ii) (Page 12) $\rightarrow$ Appendix to ITB (Page 23) & Page 25:** Key Equipment: `2 Cranes, 2 Welding Machines, 2 Gas Cutting Sets` (Max Age: **5 Years**; if leased, attach lease agreement + lessor's ownership proof + original invoice). Key Personnel: `1 Project Manager` (Civil Degree + 5 yrs exp) & `1 Site/Survey Engineer` (Diploma + 5 yrs or Degree + 3 yrs). **CVs must be signed `< 3 months` prior to bid due date AND wet-ink signed on every page by both the staff member and Authorized Representative**.
- **ITB 4.6 (Page 12) & Section III 1.4(b)(iii) (Page 31):** Assessed Available Bid Capacity $= (A \times N \times 2.5 - B)$ where $N = 1$ year (12 months) and escalation factors range from `1.10` (Year 1) to `1.95` (Year 7).
- **Section III Undertakings (Pages 35–38):** Notarized Stamp Paper Affidavit (5-year non-abandonment/non-rescission), **25% Cash Working Capital Undertaking**, **120-Day Bid Validity Undertaking**, and **Equipment Genuineness Undertaking** — all carrying the strict execution rule: _"Note: It should not be later than one month before bid due date."_
- **GCC Clause 9.1 (Page 53):** Non-deployment penalty of **Rs. 50,000/month for Project Manager** and **Rs. 25,000/month for other key personnel** (max 3 months, then fundamental breach under Clause 53).
- **GCC Clauses 13, 27, 32, 33, 34, 44, 45, 53, 54 $\rightarrow$ Contract Data (Pages 88–89):**
  - Insurance (`Cl. 13.1`): Works = 100% Contract Price; Equipment = 5%; Property = 5%; Personal Injury/Death = Rs. 20 Lakhs.
  - Programme (`Cl. 27.1 & 27.3`): Submit within **30 days** of Letter of Commencement (Weekly indent: 3 days; Monthly: 7 days; Emergent: **24 hours**); **1% withholding** for overdue programme.
  - Field Lab (`Cl. 32 & 53.2(i)`): Set up within **30 days** from notice to start work at zero extra payment.
  - DLP & Uncorrected Defects (`Cl. 33 & 34.1`): **5-Year DLP** from Completion Date; **1.2x recovery cost** if rectified via third party.
  - Retention Money (`Cl. 44.1 & 44.3`): **5% deducted from each running bill**, releasable in two stages against unconditional BG (at 50% financial progress and full 5% accumulation).
  - Liquidated Damages (`Cl. 45.1`): **`0.1% of Indented value per day` (minimum Rs. 10,000/day), capped at `10% of Initial Contract Price`**.
  - Fundamental Breaches & Foreclosure (`Cl. 53.2, 53.6 & 54.1`): `<30%` work completed at 50% time elapsed (`53.2(h)`); `<75%` value completed in any 3 indents (`Contract Data 53.2(j)`); **20% penalty** on uncompleted work upon termination (`Contract Data 54.1`); **10% Foreclosure Compensation** if foreclosed within 18 months (`54.1`).
  - 3rd-Party Bituminous Audit (`Section VII Cl. 7.2.3`, Page 94), 2% BOCW Cess (`Cl. 58.2(o)`, Page 68), and 3-Stage Site Videography (`Cl. 59.1`, Page 69) at contractor's cost.

### 6.3 Hazard 3: 10 Intra-Document Contradictions Across `01_NHAI...` and `10_NHAI...`

1. **`01_NHAI` Performance Security (3% vs. 10%):** ITB Clause 33.1 (Page 21) requires **3% Performance Security** within 10 days of LOA (plus up to 3% Additional Performance Security for bids $>20\%$ below estimate), whereas GCC Clause 47.1 (Page 63) stipulates **10% Performance Security**.
2. **`01_NHAI` EMD (Rs. 7,18,700 BG/DD) vs. Bid Security Declaration:** NIT 1.1 (Page 4) & ITB 16 (Page 16) require **Rs. 7,18,700/-** BG/DD/e-BG from an RBI-scheduled bank with net worth $\ge \text{Rs. 500 Cr}$ (Cooperative Banks barred; SFMS to Canara Bank Peenya `A/c 04551010008173`, `IFSC CNRB0010455`), while Page 7 and ITB 23.2/23.4 (Page 18) specify a **Bid Security Declaration**.
3. **`01_NHAI` Online-Only Submission vs. Physical Envelope for Original PoA/Affidavit:** NIT Clause 11 (Page 5) bars physical submissions, while Section III Clauses 1.2 & 2 (Pages 27, 34) require physical envelope delivery of the original PoA and Notarized Affidavit.
4. **`01_NHAI` Payment SLA (7 Days vs. 28 Days):** GCC Clauses 39.2 & 40.1 (Page 60) state **7 days certification + 7 days payment**, while Section VIII Clause 8.9.1 (Page 99) states **14 days certification + 28 days payment**.
5. **`10_NHAI` Financial Bid GST Inclusion vs. Exclusion:** Clause 5.3(B)(c) (Page 27) states prices are **inclusive of Taxes/GST**, while Form F-1 Note (ii) (Page 62) states rates are inclusive of all taxes **except for GST**.
6. **`10_NHAI` Pre-Bid Query Cutoff (21 Sept vs. 17 Sept 2026):** Key Dates 1.2 (Page 16) says **`21/09/2026 upto 05:00 pm`**, while Clause 4.2(e) (Page 25) says **`before 17/09/2026`**.
7. **`10_NHAI` Net Worth Cut-Off Date (`31.03.2026` vs. `31.03.2025`) & Formula Bug:** PQ-3 (Page 19) & Form T-10 Table B (Page 58) state **`31.03.2026`**, while Form T-10's preamble says **`31.03.2025`** and Page 59's table formula reads `NET WORTH (1+2+3-4-5-6-7)` for 6 rows.
8. **`10_NHAI` Rs. 20 Lakh EMD vs. Bid Securing Declaration:** Clause 2.2 (Page 17) requires **Rs. 20,00,000/- EMD** via DD/Banker's Cheque/NEFT/RTGS to Canara Bank (`A/c 8598201006217`, `IFSC CNRB0008598` — BG not listed), while Clauses 3.2(a), 5.2, and Form T-1 reference a **"Bid Securing Declaration"**.
9. **`10_NHAI` PBG Validity (6.25 Years vs. 2 Years):** Clause 6.5(a) (Page 32) requires the **Rs. 1 Crore PBG** (due within 7 days of LOA, 10-day replenishment under `1.2.33(b)`) to remain valid until **1 year after expiry of the 5-yr 3-mo contract**, while Form T-8 Footnote `$` (Page 55) says **2 years from issuance**.
10. **`10_NHAI` Blacklisting / Non-Performance Lookback (5 Years vs. 3 Years):** PQ-7 (Page 21) specifies **5 years**, while Clause 5.3(A)(f) (Page 27), Form T-1 (Page 44), and Form T-11 (Page 60) specify **3 years**.

### 6.4 Hazard 4: ITS/Opex System Integrator Requirements in `10_NHAI_Outer_Ring_Exp_1850Cr_NIT.pdf` (`IHMCL/RFP/WIM/2026/01`)

- **Outright JV / Consortium Prohibition (`Clause 2.3(b)`, Page 18):** Explicitly prohibits JVs/Consortiums from bidding.
- **Standalone Positive Net Worth (`PQ-3`, Pages 19–20) & Rs. 10 Cr MAAT (`PQ-2`, Page 19):** Positive standalone net worth (parent/subsidiary/associate excluded) and Rs. 10 Cr 3-year average turnover (FY23-24 `1.10x`, FY24-25 `1.05x`, FY25-26 `1.00x`).
- **5-Year WIM Manufacturer Status (`PQ-4`, `Form T-4`) & Proprietary Software IPR/Source Code Ownership (`PQ-5`, `Form T-9`, Page 20):** End-to-end WIM manufacturer with $\ge 5$ years NH/SH/Expressway/Railway experience and full ownership of proprietary WIM software IPR and source code.
- **GFR Rule 144(xi) Land-Border Restrictions, Source Code Residency & HiSilicon Chipset Ban (`Clause 3.1.1`, Pages 21–22, `Form T-5`, Page 51 & `Schedule C`, Pages 122, 128):** Registration with Competent Authority for land-border bidders/sub-contractors; no OEM rebranding/importing from land-border countries; **software/firmware source code must not reside in a land-border country**; **ANPR and Overview Cameras must NOT contain a HiSilicon chipset/processor**; OEM $\ge 3$ yrs maturity, non-EOS/EOL/End-of-Support declaration, and $24\times7\times365$ support in India.
- **POA Signatory = Digital Signatory Identity Match (`Clause 6.1.1(e)`, Page 30)** & **Sign/Stamp All 142 Pages (`Clause 5.1(h)`, Page 26)**.
- **Plain-Paper Integrity Pact (`Page 38`) vs. Stamp-Paper Notarized POA (`Form T-3`, Pages 48–49)**.
- **Opex Quarterly Payment Formula (`(A x B) - C` for NPCI Mapper Classes 10–15 Only, `Clause 1.2.19`, Page 77)**, **Annual CERT-In Audit & DPDP Act 2023 (`Clause 1.2.6(4)` & `Schedule B 1(u)(iv)`)**, **Legal Metrology Stamping (`Rs. 5,00,000` penalty + zero payment for unstamped period, `SLA #7`)**, and **Multi-Parameter SLA Penalties (`Schedule B Section 7`, Pages 116–119)**.

---

## 7. Architectural Remediation Roadmap & Resilient OKF + Structural RAG Specification (Milestone 2 Guidance)

To resolve every bottleneck identified in `F1`–`F5` across all three tenders, Milestone 2 (M2) executes the following **8 architectural interventions (`F6`–`F13`)**:

```text
==============================================================================================
LANE 1: STRUCTURAL INGESTION, DE-FRAGMENTATION & DUAL OKF + 3-TIER RAG INDEXING
==============================================================================================
[Raw PDF Pages (PyPDFium2 / Docling)]
   │
   ▼
[Stage 1: Sanitizer, Paragraph Coalescer & Grid Reconstructor (docling_parser.py)]
   ├── Running Header/Footer Stripper: Removes "IHMCL", "Page X of 142" before block assembly
   ├── Deleted-Clause Tagger: Flags clauses ending in "- Deleted" / "DELETED." (is_deleted=True)
   ├── Visual Line Merger: Joins wrapped lines into complete grammatical paragraphs
   ├── Spatial Whitespace Table Detector: Reconstructs multi-page tables into Markdown grids
   └── Footnote & Key-Map Binder: Binds trailing Notes (i)–(vi) + generates "Sr. No. 1 = ..." map
   │
   ▼
[Stage 2: Guarded Legal AST Builder (structure_builder.py)]
   ├── Guarded CLAUSE_PATTERN: Rejects dates (22.01.2026), chainages (348.000), & bare numbers (0.5)
   ├── OCR-Noise Down-Ranker: Flags garbled historical scan appendices (e.g., 2013 OM Appendix-I)
   └── Builds clean hierarchy: Part -> Section/Schedule -> Clause -> Sub-Clause
   │
   ▼
[Stage 3: 3-Tier Skeletal Parent-Child Chunker & Graph Linker (tender_chunker.py)]
   ├── Tier 1 — Pinned Skeleton (150–250 tokens): Root Clause Preamble + Table Headers + Row Key Map
   ├── Tier 2 — Parent / Sub-Parent Windows (600–1,000 tokens): Full Clause or 15-Row Table Window
   ├── Tier 3 — Child Chunks (150–350 tokens): Atomic Sub-Clause or 2–3 Table Rows
   ├── Cross-Reference Edge Extractor: Populates outbound_refs & inbound_refs ("clause:45.1" <-> "contract_data:45.1")
   └── Dual-Text Payload:
         • verbatim_text: Clean, unsevered prose for UI citations & deterministic substring checks
         • contextualized_text: "[RFP_No | Section | Clause | Page] " + Pinned Skeleton + verbatim_text
   │
   ├───────────────────────────────────────────────┐
   ▼                                               ▼
[Stage 4A: Scoped Extraction & OKF Compiler]    [Stage 4B: Persistent Hybrid RAG Store (PostgreSQL)]
   • Seeds ScopedRetrievalTool with actual         • Dense Index: pgvector HNSW on contextualized_text
     Parent Chunks + 1-Hop Hydrated Refs           • Sparse Index: GIN tsvector (BM25) for exact tokens
     (Contract Data, Appendix to ITB, NIT Table)     ("Form-26AS", "INFRACON", "HiSilicon", "CNRB0008598")
   • Compiles verified items into Tender OKF       • Metadata: tenant_id, bid_id, parent_id, outbound_refs
     Concept Nodes + tender_okf/index.md

==============================================================================================
LANE 2: RESILIENT EXTRACTION, OKF-FIRST COPILOT & HYBRID RAG RETRIEVAL
==============================================================================================
[Compliance Extraction Workflow]                [Interactive Chat Copilot Workflow]
   │                                               │
   ▼                                               ▼
1. Candidate Detector (Paragraph/Table Level)   1. Semantic Router + OKF-First Lookup
   • Operates on Parent Chunks (never drops        ├──► Layer 1 & 2: Read Company Vault OKF &
     short numeric cells like "Rs. 5 Cr")          │    Compiled Tender OKF Concept Graph
   │                                               └──► Layer 3 (Long-Tail Specs): Parallel
   ▼                                                    Dense Vector (Top 25) + BM25 (Top 25)
2. Multi-Tier LLM Gateway (Circuit-Safe)                │
   • Active model pool + per-model cooldown             ▼
   • Hydrates 1-hop Referenced Clauses          2. Reciprocal Rank Fusion (RRF, k=60)
   • Dynamic Deontic Extractor (Zero static             │
     string stubs!)                                     ▼
   │                                            3. Small-to-Big Parent + 1-Hop Ref Expansion
   ▼                                               • Swaps Child for Parent + Hydrated Contract Data
3. Grounding, Contradiction & Deduplication             │
   • Clamps page_number & normalizes category           ▼
   • Flags intra-document contradictions        4. Cross-Encoder Rerank -> Grounded LLM Synthesis
```

---

### 7.1 Feature F6: Client Initialization & Gateway Resilience (`models/llm_client.py`)

1. **Decouple `enable_live_client` from `extractor_fn`:**
   In `models/llm_client.py`, instantiate `OpenAICompatibleLlmClient` whenever `settings.llm_api_key` is present unless `enable_live_client is False`. Treat `extractor_fn` strictly as a last-resort offline fallback when all live gateway models fail, never as a constructor flag that suppresses `self.live_client`.
2. **Per-Model Cooldown & Active Model Pool Rotation:**
   - Replace the deprecated `minimax/minimax-m3.1-flash:free` default with a verified active model slug and support provider rotation.
   - Track `_model_cooldown_until: dict[str, float]` per model slug:
     - **HTTP 404:** Mark only that model slug as permanently unavailable (`float("inf")`) and immediately try the next model in the pool.
     - **HTTP 429:** Place only that model on a 60-second cooldown (`time.monotonic() + 60.0`) and rotate to the next model.
     - **HTTP 401 / 403:** Trip `_live_circuit_broken = True` only on authentication/permission failure.

---

### 7.2 Feature F7: Complete Elimination of Synthetic Fallbacks (`pipeline.py` & `extraction/quote_resolver.py`)

To eradicate the synthetic stub defects documented in Section 3.3 (`"M of four/six laning** of"`, missing `Rs. 5 Crores` thresholds, and fake `INR 5,00,000` EMD stubs):

1. **Delete the Empty-Page Synthetic Stub (`INR 5,00,000` Hallucination Removal):**
   Remove the `text_stub = "The bidder must submit an Earnest Money Deposit (EMD) of INR 5,00,000 on a 100 Rupee stamp paper..."` fallback in `ProductionExtractionPipeline.execute()`. If `request.pages` is empty after `resolve_pdf_to_pages`, immediately raise a `ValueError` (or return `status="EXTRACTION_FAILED"`, `human_review_required=True`) so the pipeline never fabricates compliance requirements on failed PDF loads.
2. **Delete `_extract_verbatim_window` Offset Slicing:**
   Remove `idx - 15` / `idx + 85` character slicing completely. Replace it with `extract_complete_clause_window()`, which expands outward from any matched obligation to full grammatical sentence, sub-clause, and bound-table boundaries (`max_chars=650`) after whitespace normalization (`clean_whitespace`).
3. **Eliminate the 44 Hardcoded Static String Templates in `default_tender_extractor`:**
   - Remove static hardcoded descriptions that ignore the actual document text.
   - When the deterministic offline extractor runs (in unit tests or when the live LLM gateway is unreachable), construct every `CandidateComplianceItem` **dynamically from the parsed Parent Chunk**:
     - **Dynamic Parameter Injection:** Run `extract_monetary_amounts(clause_text)` (normalized to `value_in_inr`), `extract_percentages(clause_text)`, `extract_temporal_durations(clause_text)`, and bank/IFSC/form extractors on the full coalesced Parent Chunk and inject the actual document figures (`Rs. 5 Crores`, `30%`, `50%`, `60 months`, `Canara Bank A/c 0385201800065, IFSC CNRB0001624`) directly into `description`.
     - **Canonical Titles Only:** Keep `title` canonical and static per obligation type so cross-page deduplication (`consolidated_map`) never fragments items when two pages mention different numbers for the same topic, while updating `existing["description"] = payload["description"]` whenever `prefer_new_quote` selects a higher-scoring quote.
     - **Plain-Paper vs. Stamp-Paper Disambiguation:** Check for explicit `"plain paper"` directives (e.g., `10_NHAI...` Page 38 Integrity Pact) before setting `stamp_paper_required = True`.

---

### 7.3 Feature F8: Parser Paragraph De-Fragmentation, Spatial Tables, Deleted-Clause Filter & Guarded AST (`docling_parser.py` & `structure_builder.py`)

1. **Running Header / Footer Stripper (`docling_parser.py`):**
   Strip repetitive page headers, footers, and watermarks (`IHMCL`, `Indian Highways Management Company Limited`, `RFP FOR SELECTION... Page X of 142`) before line coalescing so multi-page tables stitch together without interruption.
2. **Deleted-Clause Filter (`docling_parser.py`):**
   Detect clauses and sub-clauses whose heading or trailing text ends with `- Deleted`, `- DELETED.`, or `Omitted` (such as GCC Clause 46 Mobilization Advance and Contract Data 7.1 Subcontracting in `01_NHAI_HAM_850Cr_NIT.pdf`) and set `is_deleted = True` to prevent ghost extractions.
3. **Paragraph Line-Wrap Coalescing & Spatial Table Detection (`docling_parser.py`):**
   - Merge consecutive wrapped visual lines into complete paragraph blocks until a blank line (`\n\n`) or a guarded clause/heading boundary occurs.
   - Reconstruct whitespace-aligned tabular layouts (`\s{2,}` column separation or `Sl. No.` / `Sr. No.` / `Table \d+` headers) into structured Markdown tables (`| Col1 | Col2 | ... |`), binding all trailing `*`, `**`, and `Note:` blocks and generating a `Table Row Key Map` (`Sr. No. 1 = Annual Turnover | Sr. No. 2 = Key Professionals`).
4. **Guarded Legal AST Pattern (`structure_builder.py`):**
   Restrict `CLAUSE_PATTERN` to `GUARDED_CLAUSE_PATTERN` requiring explicit divisional keywords (`Clause`, `Sub-Clause`, `Article`, `Section`, `Schedule`, `Annexure`, `Table`, `PQ`) or top-level clause numbering (`^[1-6]?\d(?:\.\d+){0,3}[.)]\s+[A-Z]`) while explicitly rejecting dates (`22.01.2026`), 3-decimal chainages (`348.000`, `93.140`), and inline decimals (`0.5 thus`, `9.45`).

---

### 7.4 Feature F9: 3-Tier Skeletal Parent-Child Chunking, Cross-Reference Hydration & Semantic Seeding (`tender_chunker.py` & `cross_reference_resolver.py`)

1. **Connect `chunker.chunk_document()` Directly to `retrieval_tool.seed_chunks()`:**
   Eliminate the whole-page dummy chunk (`chk_{doc_id}_{page}`) in `pipeline.py` and seed `ScopedRetrievalTool` with the actual structural chunks produced by `TenderChunker`, including a cross-page sliding window for clauses that span page boundaries.
2. **3-Tier Skeletal Splitting for Multi-Page Clauses & Tables:**
   When a clause, schedule, or table exceeds `MAX_PARENT_TOKENS` (1,000 tokens), extract a `Pinned Skeleton` (root clause preamble + table column headers + `Table Row Key Map`) and prepend it to every 800–1,000 token Sub-Parent Window.
3. **Bidirectional Cross-Reference Graph (`CrossReferenceResolver`):**
   Index every Parent Chunk by its `canonical_ref_id` (`"clause:45.1"`, `"contract_data:45.1"`, `"appendix_itb:4.4.b"`, `"nit:1.1"`, `"schedule:b.7"`) and hydrate 1-hop `outbound_refs` and `inbound_refs` into the prompt context so shell clauses in ITB/GCC are always evaluated alongside their concrete numbers in `Contract Data`, `Appendix to ITB`, and `NIT 1.1`.

---

### 7.5 Feature F10: Two-Layer OKF + Hybrid RAG Architecture (`okf_compiler.py` & `chat/workflow.py`)

To combine the deterministic precision of **OKF (Open Knowledge Format)** with the full-document recall of **Hybrid RAG**, TenderPulse AI implements a three-tier memory hierarchy:

1. **Layer 1: Native OKF for Company Evidence Vault & Statutory Playbooks (`vault_okf/`):**
   - Curated company facts (GSTIN, PAN, INFRACON Team ID, 5-year CA-audited turnover, UDIN, standalone Net Worth, and past project credentials) and statutory rules (GFR Rule 144(xi), MoRTH Gazette S.O. 3467(E), SAROD Rules) are stored as structured OKF concept nodes with YAML frontmatter and an `index.md` progressive-disclosure directory.
2. **Layer 2: Automated PDF-to-OKF Compilation for Operative Tender Clauses (`tender_okf/`):**
   - At the end of `ProductionExtractionPipeline.execute()`, the verified compliance obligations, hydrated cross-references (`outbound_refs` / `inbound_refs`), extracted YAML metrics (`value_in_inr`, `percentages`, `durations`), and flagged contradictions are compiled into a virtual **Tender OKF Bundle** (`tender_okf/index.md` + atomic concept nodes per clause).
3. **Layer 3: Hybrid RAG (`pgvector` HNSW + PostgreSQL `tsvector` BM25) for Long-Tail Specifications:**
   - All 3-Tier Parent-Child chunks across the 100-to-300-page tender remain indexed in PostgreSQL.
   - In `chat/workflow.py`, `tool_calling_node` follows an **OKF-First, RAG-Second** lookup strategy: checking `vault_okf/` and `tender_okf/` first for deterministic qualification/compliance answers, and invoking Hybrid RRF + Small-to-Big Parent Expansion for granular technical specification queries (e.g., server RAID-5 specs, camera shutter speeds, or individual SAROD rules).

---

### 7.6 Feature F11: Validation Node Hardening, Contradiction Detection & Quote-Overlap Consolidation (`nodes.py`, `validation.py` & `deduplication.py`)

1. **Canonical Category Normalization & Page Clamping (`validation_node`):**
   - Deterministically map all LLM-invented categories (`TECHNICAL_REQUIREMENT`, `SCOPE_OF_WORK`, `MANDATORY_SUBMISSION`, `ELIGIBILITY_CONDITION`, etc.) to the 7 canonical categories: `LEGAL`, `TECHNICAL`, `FINANCIAL`, `STATUTORY`, `OPERATIONAL`, `COMMERCIAL`, `EXECUTION`.
   - Clamp `candidate.provenance.page_number = page_no` on verification.
   - Normalize whitespace (`clean_whitespace`) on both `verbatim_quote` and `description`, and reject dangling mid-sentence fragments or unresolved table footnotes (`is_dangling_fragment`).
2. **Cross-Page Consolidation & Quote-Overlap Merging (`deduplication.py`):**
   - Merge items across pages when `(category, normalized_title)` match OR when normalized `verbatim_quote` overlaps (`min_len >= 35`) within the same category and related title scope.
   - When `prefer_new_quote` selects a superior quote, update `existing["description"] = payload["description"]` and preserve the specific `clauseReference` while appending supporting pages (`Clause 13.C (Pages 5, 6)` instead of overwriting with `"Clauses across Pages 5, 6"`).
3. **Automated Intra-Document Contradiction Detector (`uncertainty_verification_node`):**
   - Detect conflicting thresholds across sections of the same tender (e.g., `3%` vs. `10%` Performance Security in `01_NHAI...`; `inclusive of GST` vs. `except for GST` in `10_NHAI...`) and emit a `CLAUSE_CONTRADICTION` uncertainty item citing both pages and applying the contract's Order of Precedence (`Clause 2.3` / `Clause 1.2.5`).

---

### 7.7 Feature F12: Modular Refactoring of `pipeline.py` (`apps/ai/src/tenderpulse_ai/extraction/`)

Decompose the monolithic 3,145-line `apps/ai/src/tenderpulse_ai/pipeline.py` into dedicated, single-responsibility submodules under `apps/ai/src/tenderpulse_ai/extraction/`:

- `extraction/contracts.py`: `NormalizedPage`, `DocumentExtractionRequest`, `DocumentExtractionResponse`.
- `extraction/parsing.py`: Helper utilities interfacing with `DoclingParserEngine`, `RUNNING_FURNITURE_PATTERN`, and `DELETED_CLAUSE_PATTERN`.
- `extraction/metrics.py`: `extract_temporal_durations`, `extract_monetary_amounts` (with normalized `value_in_inr`), and `extract_percentages`.
- `extraction/clause_references.py`: `_extract_clause_reference` with `GUARDED_CLAUSE_PATTERN`, `is_toc_or_definition`, and `CrossReferenceResolver`.
- `extraction/quote_resolver.py`: `_extract_operative_clause`, `extract_complete_clause_window`, `_resolve_quote`, and `clean_whitespace`.
- `extraction/deduplication.py`: Cross-page consolidation, quote-overlap merging, `prefer_new_quote` description syncing, and contradiction detection.
- `extraction/okf_compiler.py`: Compiles verified compliance items and hydrated cross-references into `tender_okf/index.md` and structured OKF concept nodes.
- `extraction/rules/`: Domain-organized dynamic fallback extractors (`financial.py`, `technical.py`, `legal.py`, `statutory.py`, `execution.py`, `operational.py`, `commercial.py`) free of static string stubs.
- `extraction/orchestrator.py`: `ProductionExtractionPipeline` coordinating Docling, AST, 3-Tier Chunking, Cross-Reference Hydration, OKF Compilation, and LangGraph execution.
- `pipeline.py`: Lightweight (<150 lines) backward-compatible facade re-exporting public symbols for existing callers and tests.

---

### 7.8 Feature F13: High-Fidelity Re-Extraction & UI Presentation Verification

1. **Re-Extraction Verification across All 3 Tenders:**
   - Re-extract `02_NHAI_Greenfield_Exp_1450Cr_NIT.pdf` and verify capture of all **30 benchmark obligations (`B1`–`B30`)** with unsevered quotes, exact bank/IFSC details (`0385201800065` / `CNRB0001624`), complete turnover thresholds (`Rs. 5 Crores` across 5-yr avg or preceding 2 yrs), and full 4-tier capacity tables.
   - Verify `01_NHAI_HAM_850Cr_NIT.pdf` suppresses `- Deleted` clauses (`Clause 46`, `Contract Data 7.1`), hydrates `Contract Data` Pages 88–89 into GCC shell clauses, and flags the `3%` vs. `10%` Performance Security contradiction.
   - Verify `10_NHAI_Outer_Ring_Exp_1850Cr_NIT.pdf` (`IHMCL/RFP/WIM/2026/01`) captures the JV ban, GFR 144(xi) & HiSilicon bans, Legal Metrology `Rs. 5,00,000` penalty, and multi-page SLA table, while flagging the GST and PBG validity contradictions.
2. **Backend API Mapper & Frontend UI Clubbing (`apps/api` & `apps/web`):**
   - In `compliance-item.mapper.ts`, strip trailing `(Page X)` / `(Pages X, Y)` and generic `"Clause on Page X"` strings when populating `tenderClauseRef`.
   - In `ComplianceRow.tsx` and `SourceCitationDrawer.tsx`, render `item.description` inline below the title and use `whiteSpace: 'normal'` so citations wrap cleanly without mid-sentence PDF line breaks.
   - In `ComplianceTable.tsx`, support grouping by **Category** and **Parent Section / Clause** (`getClauseGroupKey` normalizing `13.A.1`, `13.B`, `13.C` under `Section / Clause 13`).
