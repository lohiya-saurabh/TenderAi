# ADR 0020: External Data Connectors behind an Enrichment Port

## Status

Accepted (2026-10-05)

## Context

The Company Capability Profile is the product's differentiator, but manual profile entry is high-friction. India offers legitimate, consent-based channels for authoritative data:

- **DigiLocker**: OAuth 2.0 consent flow for government-issued, digitally-signed documents (GST certificate, PAN, IEC, incorporation documents).
- **Account Aggregator (AA) framework** (RBI): consent-artifact-based sharing of bank financial data.
- **GSP (GST Suvidha Provider) APIs**: GST return/turnover data — API-key based, requires a GSP agreement (not OAuth).
- **MCA aggregators** (Tofler, Zauba, Signzy, etc.): company financials — paid API access (not OAuth).
- **ICAI UDIN verification**: lookup-by-number API for certificate authenticity.

### The Problem

1. **No generic integration point**: each source has different auth (OAuth, consent artifacts, API keys), different payloads, and different reliability.
2. **Secret handling risk**: OAuth tokens and API keys are tenant-scoped secrets; mishandling them (or letting them reach the AI context) would be a critical breach.
3. **Compliance**: DPDP Act 2023 requires purpose limitation, consent records, retention limits, and data residency for personal data.
4. **Anti-scope integrity**: the product bans portal scraping and DSC automation; connector integrations must be provably _official, user-consented_ channels, not scrapers.

## Decision

1. **New infrastructure port `IConnector`** (a.k.a. Enrichment Port): `connect(tenantId, source, scopes)`, `refresh(tenantId, connectionId)`, `fetchDocuments(connectionId, documentTypes)`, `revoke(tenantId, connectionId)`. Domain code knows nothing of DigiLocker, AA, GSP, or MCA.
2. **Infrastructure adapters per source**: `DigiLockerConnector` (OAuth 2.0 authorization-code flow + PKCE), `AccountAggregatorConnector` (consent artifacts), `GspConnector` (API key), `McaAggregatorConnector` (paid API). Selectable via config; Mock connector for tests.
3. **`ExternalDataConnection` entity** (tenant-scoped): source, scopes, encrypted tokens at rest, consent receipt reference, refresh state, revocation. Tokens are secrets: encrypted, tenant-isolated, never logged, never sent to the AI service.
4. **Connectors enrich; they never decide.** Fetched documents land as `EvidenceDocument`s with `verificationTier: AUTHORITY_VERIFIED` (DigiLocker/AA) or `SELF_ATTESTED` (user upload), provenance recording source, fetched-at, and consent reference. The MatchingEngine treats tiers as evidence quality, and the MatchScorecard displays it.
5. **Phased adoption**: Phase 1 MVP = manual upload/entry only (no external dependency). Phase 2 = DigiLocker + AA. Phase 3 = GSP + MCA aggregators. Manual path always remains the fallback so the product never blocks on a partner integration.
6. **Scopes are minimized** per source (only the document types needed); consent is re-confirmed on scope expansion; consent receipts are stored with the connection.

## Consequences

- **Positive**:
  - Authoritative, digitally-signed evidence raises the trust tier of the profile — a genuine competitive edge over self-attested checklists.
  - Cloud-agnostic by construction (the port hides vendor specifics, per ADR 0014's pattern).
  - Manual path keeps shipping while partnerships mature.
- **Negative / Trade-offs**:
  - Each connector is a maintained integration surface with rate limits, uptime, and compliance overhead; phased adoption bounds this.
  - OAuth/consent flows add redirect complexity to the SPA; tokens must be exchanged server-side only.
- **Failure modes**: stale/expired consent → connectors mark evidence STALE and fall back to manual; connector outage → queued retries with DLQ (existing `IJobQueue` machinery); a compromised token → tenant-scoped revocation and audit event.

## References

`docs/PRODUCT.md` §4 (Company Capability Profile), ADR 0014 (cloud-agnostic ports), ADR 0011/0013 (AI security & tenant isolation), `docs/PRODUCT.md` anti-scope (no scraping, no DSC automation).
