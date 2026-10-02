# ADR 0010: Immutable Provenance Value Object for Zero-Ungrounded Compliance

## Status

Accepted

## Context

In government compliance, any extracted requirement without an exact source citation is a liability. If the system says "Stamp paper of ₹100 required" but cannot point to the exact page and clause in the tender, the user cannot trust the platform.

### The Problem

If provenance data (source file, page number, clause reference, verbatim quote) is treated as loose, optional primitive fields on an entity:

- Code paths can create compliance items with missing citations or partial data (e.g. page number without verbatim quote).
- Mutation bugs can alter the original citation when a user edits internal notes or status.

## Decision

We model **`Provenance`** as an **Immutable Value Object**:

1. **Structural Invariants**:
   A `Provenance` object cannot be instantiated unless it contains:
   - `sourceDocumentId`: Valid UUID of the uploaded tender document.
   - `sourceFileName`: Exact file name (e.g. `NIT_Road_Vol_1.pdf`).
   - `pageNumber`: Positive integer $\ge 1$.
   - `clauseReference`: Non-empty string (e.g. `Section 4, Clause 12.3(a)`).
   - `verbatimQuote`: Non-empty string representing the verbatim excerpt from the document.
   - `confidenceScore`: Float between $0.0$ and $1.0$.
2. **Immutability**:
   Once created by the extraction engine, `Provenance` is frozen (`readonly`). When a human user updates a compliance item (e.g. changing status to `READY` or adding notes), the provenance remains unchanged and tamper-proof.

## Alternatives Considered

1. **Loose Nullable Database Columns**: Rejected because it allows saving ungrounded or incomplete extractions.
2. **Raw JSON string without schema**: Rejected because TypeScript and runtime validators cannot enforce field completeness.

## Consequences

- **Positive**:
  - Guaranteed auditability: Every compliance requirement displayed on the frontend has a verifiable page and quote.
  - Type-safe domain invariants enforced in pure TypeScript.
- **Negative / Trade-off**:
  - Requires parsing and mapping into domain value objects on database reads.
