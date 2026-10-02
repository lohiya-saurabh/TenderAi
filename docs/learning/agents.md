# Educational Guide: AI, Structured Outputs, Tools, and Agents

This document is a technical mentor guide explaining the fundamentals of modern Artificial Intelligence and Agentic Systems, using **TenderPulse AI** as the concrete reference product.

---

## 1. What is an LLM? (Large Language Model)

At its mathematical core, a **Large Language Model (LLM)** (such as Claude 3.5 Sonnet, GPT-4o, or Gemini 1.5 Pro) is a **probabilistic auto-regressive next-token predictor**.

$$\text{Next Token} \sim P(w_t \mid w_1, w_2, \dots, w_{t-1})$$

It is a statistical neural network with hundreds of billions of parameters trained on trillions of words. It does **not** "think", it does **not** "know facts", and it possesses **zero deterministic logic**.

### In TenderPulse AI:

- **What it is great at**: Understanding dense, archaic, bureaucratic English. When an Indian government Standard Bidding Document (SBD) says:
  > _"The bidder shall, as part of Cover-I, furnish an affidavit of non-blacklisting executed on a non-judicial stamp paper of not less than Rs. 100/- denomination, solemnly affirmed before an Executive Magistrate or Notary Public."_
  > An LLM excels at reading this dense text and understanding that this sentence defines:
  1. An affidavit requirement.
  2. Execution on ₹100 stamp paper.
  3. Attestation by a Notary.
- **What it is terrible at**:
  - Exact arithmetic (e.g. subtracting numbers, calculating $50\%$ of ₹8.45 Crore).
  - Deterministic guarantees (unless constrained, it may invent a clause or page number).
  - Business rules and state transitions.

---

## 2. What is Structured Output?

By default, an LLM outputs unstructured natural language text (strings of Markdown).

### The Problem without Structured Output:

If you prompt an LLM: _"Find all required annexures in this tender text"_, it responds with conversational prose:

> _"Sure! Here are the annexures you need: First, there is Annexure-A which is a declaration. Also don't forget the ₹100 stamp paper mentioned in section 4..."_

A software backend cannot reliably parse, validate, or store conversational prose in a PostgreSQL database. Regex parsing breaks as soon as the model rephrases its answer.

### The Solution: Structured Output

Structured output forces the LLM's token generation to adhere strictly to a **formal schema (JSON Schema / Pydantic model)**. Modern LLM inference engines achieve this via **grammar-constrained decoding**: tokens that violate the JSON syntax or schema are mathematically masked out ($P = 0$) during sampling.

### In TenderPulse AI:

The LLM is constrained to output our exact TypeScript/Pydantic schema:

```json
{
  "category": "ANNEXURE_DECLARATION",
  "title": "Affidavit of Non-Blacklisting",
  "description": "Affirmation of non-debarment by Central/State govt.",
  "executionRules": {
    "stampPaperRequired": true,
    "stampPaperDenominationInr": 100,
    "notarizationRequired": true,
    "signingAuthorityRank": "Authorized Signatory",
    "udinRequired": false
  },
  "provenance": {
    "sourceDocumentId": "doc-uuid-1",
    "sourceFileName": "NIT_Volume_1.pdf",
    "pageNumber": 38,
    "clauseReference": "Section 3, Clause 14.2(b)",
    "verbatimQuote": "The bidder shall submit an affidavit on non-judicial stamp paper of minimum Rs. 100/- duly notarized...",
    "confidenceScore": 0.99
  }
}
```

Now, the output can be directly deserialized into domain entities and inserted into PostgreSQL without fragile string manipulation.

---

## 3. What is a Tool? (Function Calling)

A **Tool** is a deterministic function provided to the LLM that allows the model to interact with the outside world, perform exact calculations, or fetch dynamic information.

An LLM cannot run code itself. Instead, the mechanism works as a handshake:

1. We give the LLM a list of tool definitions with descriptions and parameter schemas.
2. The LLM decides: _"I need to run `calculate_turnover_shortfall` with `{ required: 45000000, actual: 42000000 }`"_.
3. The LLM pauses generation and outputs a **Tool Call Request**.
4. Our application code executes the tool deterministically and sends the **Tool Output** back to the LLM.
5. The LLM resumes generation using the tool's verified result.

### In TenderPulse AI:

- **Rule from AGENTS.md**: _"LLMs must never be the source of truth for calculations."_
- **Our Tools**:
  - `fetch_page_text(page_number: int)`: Allows the model to pull the exact raw text of a specific page to inspect a clause.
  - `verify_citation(page_number: int, quote: str)`: A deterministic Python string-matching tool that checks if the quoted text actually exists on that page.
  - `calculate_financial_gap(required_paise: int, actual_paise: int)`: Pure integer arithmetic returning the exact shortfall.

---

## 4. What is Retrieval? (RAG)

A typical government tender package is 200–400 pages (approx. 150,000–300,000 tokens).

### Why can't we just paste all 300 pages into a single LLM prompt?

1. **The "Lost in the Middle" Problem**: Research shows that when LLMs process massive context windows (100k+ tokens), recall accuracy degrades sharply for facts buried in the middle of the document. A critical ₹100 stamp paper clause on page 142 gets overlooked.
2. **Latency & Cost**: Sending 200,000 tokens on every prompt takes 30–60 seconds per call and incurs high inference fees.

### Retrieval:

Retrieval is the mechanism of searching an indexed store of document chunks (using vector semantic embeddings, BM25 keyword search, or hybrid search) to extract only the **top $K$ relevant chunks** (e.g. 5–10 pages) and feeding them to the LLM.

### In TenderPulse AI:

Instead of sending all 300 pages at once:

1. We chunk the tender by physical pages and logical sections (Eligibility, General Conditions, Special Conditions, Annexures).
2. When searching for eligibility thresholds, the retrieval engine queries for _"average annual turnover, similar work experience, net worth"_.
3. Only the 6 relevant pages are retrieved and passed to the extraction prompt.

---

## 5. What is an AI Workflow? (Deterministic DAG)

An **AI Workflow** is a system where the sequence of operations is **hardcoded in deterministic code**, and LLMs are called at specific, predefined steps.

```
[Start] ──> [Deterministic Step: Chunk PDF]
                 │
                 ▼
            [LLM Step: Extract Candidates]
                 │
                 ▼
            [Deterministic Step: Validate Citations]
                 │
                 ▼
            [Deterministic Step: Commit to PostgreSQL] ──> [End]
```

- In a workflow, **code governs the routing**.
- The LLM does not decide what step comes next.
- Workflows are predictable, highly testable, cost-effective, and fast.

---

## 6. What is an Agent?

An **Agent** is a system where the **LLM itself decides the control flow**.

Instead of following a rigid step-by-step pipeline, an agent operates in an autonomous loop:

```
┌────────────────────────────────────────────────────────┐
│                   THE AGENTIC LOOP                     │
│                                                        │
│   Goal: "Identify all liquidated damages traps"        │
│                                                        │
│   1. REASON: What do I need to find?                   │
│   2. ACT: Call tool `search_tender("liquidated")`      │
│   3. OBSERVE: Found Clause 18 in GCC: "0.5% per week"  │
│   4. REASON: But GCC can be overridden by SCC!         │
│   5. ACT: Call tool `search_scc("penalties")`          │
│   6. OBSERVE: Found SCC Clause 4: "1.0% per week, max" │
│   7. REASON: I have the full picture.                  │
│   8. FINISH: Return final risk synthesis.              │
└────────────────────────────────────────────────────────┘
```

The agent maintains an ongoing thought-action-observation cycle until it concludes the goal has been achieved.

---

## 7. When does an Agent NOT make sense?

Hype often tempts developers to use autonomous agents for everything. In enterprise SaaS, this is dangerous:

| Problem with Autonomous Agents     | Why it matters in TenderPulse AI                                                                                                                        |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Unpredictable Latency & Cost**   | An agent might decide to loop 25 times, making 25 LLM API calls and taking 4 minutes for something a single targeted prompt could extract in 5 seconds. |
| **Risk of Infinite Loops / Drift** | The agent may get sidetracked investigating an irrelevant electrical specification table when asked for legal annexures.                                |
| **Non-Deterministic Execution**    | One day it checks the stamp paper clause first; another day it skips it entirely because it "thought" it wasn't necessary.                              |
| **Lack of Legal Reproducibility**  | A contractor cannot have an AI that behaves unpredictably when millions of rupees in bid security are at stake.                                         |

### The Senior Engineering Rule:

> **Use deterministic workflows whenever the execution steps are known upfront.**
> **Use agentic loops ONLY where the query path is truly dynamic and unpredictable.**

For TenderPulse AI:

- **Tender Ingestion & Matrix Extraction** is an **AI Workflow** (Pipeline of known steps).
- **Interactive Risk Exploration** (e.g. _"What happens if our delivery is delayed by 3 weeks under this contract?"_) is an **Agent** (explores clauses across documents dynamically).

---

## Summary Matrix

| Concept               | What it is                           | Role in TenderPulse AI                                     |
| :-------------------- | :----------------------------------- | :--------------------------------------------------------- |
| **LLM**               | Probabilistic text predictor         | Natural language reader for dense government tenders.      |
| **Structured Output** | Schema-enforced JSON generation      | Guarantees outputs match our TypeScript/Pydantic entities. |
| **Tool**              | Deterministic function called by LLM | Verifies page citations, performs exact math.              |
| **Retrieval (RAG)**   | Finding relevant context chunks      | Isolates relevant clauses from 300-page tender packages.   |
| **AI Workflow**       | Deterministic pipeline calling LLMs  | Standard document parsing and compliance extraction.       |
| **Agent**             | LLM-driven autonomous control loop   | Dynamic contract risk exploration and Q&A.                 |
