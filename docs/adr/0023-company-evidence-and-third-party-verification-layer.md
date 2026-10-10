# ADR 0023: Company Evidence Onboarding & Third-Party Verification Layer

## Status

Accepted (2026-10-10)

## Context

For Indian MSME contractors bidding on public procurement tenders (via GeM, CPPP, State e-Procurement Portals), winning or getting disqualified rarely comes down to bid pricing alone. The predominant failure mode in Indian tender evaluation is **technical and statutory non-compliance**:
1. Expired, missing, or mismatched statutory certificates (GSTIN, Udyam, Incorporation/MCA, PAN).
2. Failure to prove mandatory financial eligibility thresholds (average annual turnover over the last 3 financial years, positive net worth, working capital lines).
3. Unsubstantiated past performance claims (required work orders, completion certificates of minimum contract values for similar works).
4. Subtle discrepancies between self-declared bidding profiles and statutory government registries (e.g., trade name mismatch, revoked GST status, non-matching MSME enterprise classification).

Previously, tender bidding platforms treated company data entry as unverified free-text forms or ad-hoc file attachments uploaded repeatedly for each tender. This creates massive friction, high risk of rejection, and lack of auditable provenance for compliance evaluation.

We need a persistent, reusable **Company Evidence and Third-Party Verification Layer** that answers:
- *Is this business registered, active, and legally eligible?*
- *Which statutory certificates and licenses does it hold, and are they source-verified?*
- *Does it meet turnover, net worth, and past-experience requirements with verifiable documents?*
- *Which evidence is missing, expired, or needs human compliance review?*

## Decision

We establish an **Evidence-First Company Onboarding & Verification Architecture** structured around the following design pillars:

### 1. Vendor-Independent Hexagonal Ports & Adapters
To prevent vendor lock-in and preserve cloud-provider neutrality, domain logic interacts strictly with abstract domain ports:
- **`BusinessVerificationProvider` / `IGstVerificationPort`**: Contract for GSTIN taxpayer verification (`verifyGstin(gstin)` returning legal name, trade name, status, taxpayer type, registration date, and derived PAN).
  - Adapter: `IrisIrpGstAdapter` (production REST client for IRIS IRP / GSP APIs).
  - Adapter: `MockGstVerificationAdapter` (deterministic unit testing & local sandbox).
- **`CompanyRegistryProvider`**: Contract for MCA CIN/LLPIN master data verification (`verifyCompany(cin)` returning entity status, incorporation date, class, authorized/paid-up capital, RoC jurisdiction).
  - Adapter: `McaRegistryAdapter` (production client for Ministry of Corporate Affairs / API Setu).
  - Adapter: `MockMcaRegistryAdapter` (deterministic unit testing).
- **`IMsmeVerificationPort`**: Contract for MSME Udyam verification (`verifyUdyam(udyamNumber)` returning enterprise category: `MICRO`, `SMALL`, `MEDIUM`, major activity: `MANUFACTURING`, `SERVICES`, and NIC codes).
  - Adapter: `UdyamVerificationAdapter` (production client for Udyam Portal / API Setu).
  - Adapter: `MockMsmeVerificationAdapter` (deterministic unit testing).
- **`DigitalDocumentProvider` / `IDigitalLockerPort`**: Contract for official digital document depository integration (`getAuthorizationUrl()`, `exchangeCodeForToken()`, `getIssuedDocuments()`).
  - Adapter: `DigiLockerAdapter` (production OAuth2 client for DigiLocker / API Setu partner APIs).
  - Adapter: `MockDigitalLockerAdapter` (deterministic mock issuing signed certificates).
- **`DocumentSourceConnector`**: Contract for external document repository ingestion (`listFiles()`, `downloadFile()`).
  - Adapters: `GoogleDriveConnector` (Google Drive API), `OneDriveConnector` (Microsoft Graph API), `LocalUploadConnector` (browser binary stream).

### 2. Six-State Evidence Verification Lifecycle
Evidence documents adhere strictly to a deterministic 6-state lifecycle:
```
  [DIRECT UPLOAD / CLOUD IMPORT]
                │
                ▼
           ┌──────────┐
           │ IMPORTED │ (SHA-256 computed, stored in tenant-isolated ObjectStorage)
           └────┬─────┘
                │
                ▼
           ┌───────────┐
           │ EXTRACTED │ (Metadata / OCR text extracted)
           └────┬──────┘
                │
        ┌───────┴────────────────────────┐
        │                                │
 (Registry match)             (Mismatch / Questionable)
        │                                │
        ▼                                ▼
┌─────────────────┐             ┌──────────────────┐
│ SOURCE_VERIFIED │             │   NEEDS_REVIEW   │ ◄─── (Human review override)
└───────┬─────────┘             └────────┬─────────┘
        │                                │
  (Past validTo)                  (Invalid / Forged)
        │                                │
        ▼                                ▼
  ┌───────────┐                    ┌──────────┐
  │  EXPIRED  │                    │ REJECTED │
  └───────────┘                    └──────────┘
```
- **`IMPORTED`**: Binary received, SHA-256 hash computed, registered in database, persisted in polymorphic object storage.
- **`EXTRACTED`**: Document attributes (issuer, dates, reference numbers, financial figures) extracted.
- **`SOURCE_VERIFIED`**: Cryptographically authenticated via direct API handshake with an authoritative statutory source (IRIS IRP, MCA, Udyam, DigiLocker).
- **`NEEDS_REVIEW`**: Discrepancy detected between self-declared company profile and authoritative registry (e.g. trade name drift), or human verification required.
- **`EXPIRED`**: Validity period (`validTo`) has elapsed relative to bid submission date.
- **`REJECTED`**: Document failed verification, was revoked, or explicitly rejected by compliance reviewer.

### 3. Discrepancy Detection Over Blind Overwriting
When statutory registries return data that diverges from user-entered profile fields (e.g. user entered "Acme Infra Ltd", but IRIS IRP registered legal name is "Acme Infrastructure India Private Limited"):
- The system **does not** silently overwrite or fail the operation.
- It records the authoritative data, transitions the verification status to `NEEDS_REVIEW`, and appends structured `discrepancyNotes`.
- A compliance officer or bid manager must review and explicitly accept the discrepancy (`reviewEvidenceDiscrepancy`), capturing an immutable audit trail.

### 4. Cryptographic Integrity & Anti-Tampering Anchor
- Every evidence document is fingerprinted upon entry using SHA-256 (`crypto.createHash('sha256')`).
- DigiLocker OAuth2 authorization flows use HMAC-SHA256 signed state tokens (`tenantId:companyId:nonce:timestamp:signature`) with a strict 15-minute validity window, eliminating CSRF and cross-tenant session injection attacks.
- All verification events (GSTIN lookups, CIN checks, Udyam verifications, DigiLocker imports, human overrides) are appended to an immutable audit ledger (`evidence_verification_history`).

### 5. Zero-Trust Multi-Tenant Isolation (Anti-IDOR)
- All evidence endpoints and verification workflows resolve `organizationId` strictly from the authenticated JWT session via `TenantContextHolder`.
- All database queries and object storage operations enforce strict compound predicates: `WHERE id = :companyId AND organization_id = :orgId`.
- Any attempt to verify, upload, or inspect documents belonging to another tenant immediately throws `NotFoundError`, denying resource enumeration.

## Alternatives Considered

1. **Direct Point-to-Point Vendor Integrations Without Ports:**
   - *Why Not:* Coupling domain code to specific vendor SDKs (e.g., calling IRIS IRP or Google Drive SDKs directly from controllers) locks the system to external proprietary APIs. Swapping GSTIN providers (e.g., from IRIS IRP to Surepass or API Setu) or adding alternative cloud drives would require breaking core business workflows. Ports and adapters insulate the domain completely.
2. **Blindly Trusting OCR / LLM-Extracted Document Data as "Verified":**
   - *Why Not:* In Indian government procurement, an LLM extracting a valid-looking GST number from a scanned PDF does not prove the taxpayer is active or that the certificate is authentic. Treating OCR output as authoritative creates severe liability during CVC tender scrutiny. Only cryptographic signatures or direct GSP/Registry API handshakes can award `SOURCE_VERIFIED` status.
3. **Synchronous Full-Registry Sync on Every Page Load:**
   - *Why Not:* Statutory registry lookups incur API latency, external rate limits, and commercial query fees (₹0.40–₹0.80 per lookup). Company verification must be cached with verifiable timestamps (`gstinVerifiedAt`, `mcaVerifiedAt`) and refreshed on-demand or during scheduled rechecks.

## Consequences & Trade-Offs

### Positive
- **Auditable & Traceable:** Every claim in the company profile links back to a source-verified document, registration number, or official registry snapshot with exact timestamps.
- **Reusable Profile:** MSME contractors upload certificates once and reuse them across dozens of tenders on GeM and CPPP without re-uploading.
- **Cloud-Provider Agnostic:** All storage operations run via `IStorageService`, enabling zero-code transitions between AWS S3, Google Cloud Storage, and local storage.
- **Defense in Depth:** Zero-trust tenant scoping, SHA-256 hashing, signed OAuth states, and immutable verification history prevent cross-tenant data leaks and tampering.

### Negative & Mitigations
- **External API Availability & Cost:** Government registries (MCA, GSTN) experience periodic maintenance or downtime.
  - *Mitigation:* Resilient timeout handling, fallback to cached verified state, clear error reporting, and mock adapters for test environments.
- **Manual Review Overhead on Discrepancies:** Minor punctuation or abbreviation differences trigger `NEEDS_REVIEW`.
  - *Mitigation:* Normalized string comparison heuristics and one-click compliance review workflows.

## Security Implications

- **No Raw External Access:** External connectors (Google Drive, OneDrive) operate via scoped OAuth2 access tokens and pass downloaded files through standard byte sanitization and SHA-256 hashing before storing.
- **No LLM Decision Authority:** LLMs are never permitted to alter verification states or override statutory checks. Verification status is computed deterministically by domain services.
- **Tenant Storage Isolation:** Physical storage paths strictly isolate tenant spaces: `tenants/${orgId}/companies/${companyId}/evidence/${docId}/${fileName}`.

## References
- `AGENTS.md` (Global architecture rules, port/adapter conventions, zero-trust tenant boundaries)
- ADR 0008 (Domain-Driven Layered Architecture)
- ADR 0010 (Provenance Value Object & Immutability)
- ADR 0014 (Cloud-Agnostic Ports & Adapters)
- ADR 0021 (Evidence-First Compliance Engine)
