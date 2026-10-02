# ADR 0004: LangGraph for Stateful Extraction Loops (Rejecting Generic LangChain Chains)

## Status

Accepted

## Context

Extracting compliance requirements from dense Indian government procurement documents cannot be solved with a naive single-shot prompt (`LLMChain`):

- A 200-page tender contains conflicting clauses (e.g., standard GCC says "Affidavit on ₹50 stamp paper", but SCC overrides it with "Mandatory ₹100 stamp paper").
- Extracted items must be verified against the original text: every single item must have an exact page number and verbatim quote.
- If an extracted item fails verification (e.g., hallucinated clause reference or missing stamp paper denomination), the system must loop back, perform targeted re-reading, and refine the extraction before committing to the database.

### The Problem

- **LangChain Core (`LLMChain`, `SequentialChain`)**:
  - Treats LLM workflows as a Directed Acyclic Graph (DAG) or linear pipe.
  - Linear pipes cannot handle **cycles, conditional re-tries, state rollback, or human-in-the-loop pauses**.
  - LangChain has accumulated extensive leaky abstractions, bloated dependencies, and breaking API changes that make debugging production prompts unnecessarily difficult.
- **Raw OpenAI/Anthropic SDK without a state machine**:
  - Writing ad-hoc `while` loops and manual state dictionaries quickly degrades into unmaintainable spaghetti code when handling multi-stage reasoning (Extraction $\rightarrow$ Verification $\rightarrow$ Citation Mapping $\rightarrow$ Gap Analysis).

## Decision

We select **LangGraph** (within the FastAPI AI engine) as the stateful workflow orchestrator and reject generic LangChain chains:

1. **Explicit Typed State**: The workflow state is a strictly typed Pydantic object (`ComplianceExtractionState`) passed between graph nodes.
2. **Cyclic Control Flow**: LangGraph allows cycles: Node A (Extract) $\rightarrow$ Node B (Validate Citations & Deterministic Math) $\rightarrow$ _If validation fails_ $\rightarrow$ Node C (Refine Extraction with Targeted Context) $\rightarrow$ Node B.
3. **Persistence & Checkpointing**: LangGraph natively supports state persistence. If an extraction step fails halfway, the workflow can resume from the last checkpoint without restarting from page 1.
4. **Clean Boundary**: LangGraph is isolated entirely inside the Python FastAPI worker. The rest of the SaaS (NestJS, React) only interacts with clean, validated JSON schemas in PostgreSQL.

## Alternatives Considered

1. **Generic LangChain Chains**: Rejected due to lack of cyclic graphs, leaky abstractions, and poor debuggability.
2. **Custom Python `while` Loops**: Feasible for tiny scripts, but lacks standardized checkpointing, state inspection, visualization, and error boundary handling.
3. **LlamaIndex Query Engines**: Strong for document retrieval, but less suited for multi-step agentic extraction graphs requiring conditional branching and state mutation.

## Consequences

- **Positive**:
  - Deterministic validation loops: AI cannot output data to the user until the verification node validates page citations against raw text.
  - Inspectability: Every step of the graph is trace-enabled and observable.
  - Ready for future human-in-the-loop flows (e.g., pausing the graph to ask the user to clarify an ambiguous tender clause).
- **Negative / Trade-off**:
  - Requires learning curve for the LangGraph state machine abstraction.
  - Adds a dependency within the Python service (mitigated by strict boundary isolation).
