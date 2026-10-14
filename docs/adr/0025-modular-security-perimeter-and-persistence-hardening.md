# ADR 0025: Modular Security Perimeter, Stateless Token Revocation, and Persistence Hardening

## Status

Accepted (2026-10-10)

## Context

Following the comprehensive cross-tier system audit documented in `docs/END_TO_END_AUDIT.md`, multiple architectural and security deficiencies were identified across the frontend (React 18), API gateway (NestJS 10), and persistence tiers:

1. **Token Transport Vulnerabilities**:
   - The frontend stored both JWT access and refresh tokens in browser `localStorage`. Any Cross-Site Scripting (XSS) vulnerability (e.g., via third-party npm dependencies or unsanitized tender text) would grant full, persistent account takeover.
   - Long-lived refresh tokens could not be revoked on the server side upon user logout, leaving them valid until expiration.
   - Real-time Server-Sent Events (SSE) connections passed access tokens in URL query parameters (`?token=...`), leaking sensitive credentials into reverse-proxy logs, browser histories, and server access logs.
2. **Unauthenticated Development Endpoints**:
   - The `POST /api/v1/documents/mock-upload` endpoint lacked authentication guards and environment gating, creating a surface where arbitrary files could be injected into processing queues without validation in production.
3. **Frontend Asynchronous Race Conditions**:
   - In `useApi.ts`, asynchronous data fetches lacked cancellation or generation tracking. In high-latency or fluctuating network conditions, out-of-order promise completions would overwrite fresh UI state with stale responses.
4. **Database Schema Drift & Index Deficits**:
   - The file `apps/api/src/infrastructure/persistence/schema.sql` contained an obsolete 3-table snapshot that had diverged completely from the canonical 17-table Drizzle schema (`schema.ts`).
   - An orphaned `schema.prisma` file remained in the codebase, causing architectural ambiguity regarding the source of truth for persistence.
   - Missing composite indexes on tenant and relationship foreign keys (`organization_id`, `bid_id`) risked full-table scans during tenant-scoped queries under load.
5. **Domain Flow Disconnects**:
   - The company onboarding wizard silently dropped user sector selections upon wizard completion instead of writing them to the active company profile version.
   - The cloud drive file listing endpoint in `companies.ts` contained a hardcoded `/dummy/` path instead of dynamically utilizing the user-selected folder ID.

## Decision

We implement a hardened, modular security perimeter and persistence architecture across the gateway, authentication provider, database, and client layers:

### 1. Dual-Transport Authentication & HTTP-Only Cookie Perimeter

- **Access & Refresh Cookies**: On `/api/v1/auth/login`, `/register`, and `/refresh`, the backend issues `httpOnly`, `Secure`, `SameSite=Strict` cookies:
  - `tp_access_token` (15-minute TTL, path: `/`)
  - `tp_refresh_token` (7-day TTL, path: `/api/v1/auth`)
- **Dual Credential Extraction in `JwtAuthGuard`**:
  - The guard first inspects the `Authorization: Bearer <token>` header (preserving headless CLI, test runner, and third-party webhook compatibility).
  - If absent, it extracts `tp_access_token` from request cookies.
- **SSE Without Query Leakage**:
  - The `useSSE` hook initializes `EventSource` with `{ withCredentials: true }`, relying on the `tp_access_token` cookie rather than appending tokens to query strings.

### 2. Server-Side Refresh Token Rotation & Revocation Store

- **`refresh_tokens` Canonical Table**:
  - Schema: `id`, `user_id`, `organization_id`, `token_hash` (SHA-256), `expires_at`, `revoked_at`, `replaced_by_token_id`, `created_at`.
  - Tokens are never stored in plaintext; only the SHA-256 cryptographic digest is stored.
- **Rotation & Reuse Detection**:
  - Every invocation of `/api/v1/auth/refresh` rotates the token: the old token is marked `revoked_at = NOW()`, linked to `replaced_by_token_id`, and a new token is issued.
  - If a revoked token is presented for refresh (indicating token theft), all active refresh tokens for that user are immediately revoked (the entire token family is invalidated).
- **Explicit Logout**:
  - `POST /api/v1/auth/logout` revokes the active refresh token hash and clears both `tp_access_token` and `tp_refresh_token` cookies with expired headers.

### 3. Environment-Gated Development Vectors

- In `documents.controller.ts`, the `mockUpload` endpoint is guarded with:
  ```typescript
  if (process.env.NODE_ENV === 'production') {
    throw new ForbiddenException('Mock upload is disabled in production environments');
  }
  ```

### 4. Generation Counter Guard Against Frontend Race Conditions

- In `useApi.ts`, an `activeRequestId` counter ensures that when multiple requests are dispatched in rapid succession (e.g., search filtering, page switching), responses with a generation counter lower than the current counter are discarded before updating state.

### 5. Canonical PostgreSQL DDL & Index Hardening

- Rebuilt `apps/api/src/infrastructure/persistence/schema.sql` into a 17-table canonical schema aligned with `apps/api/src/common/database/schema.ts`.
- Deleted orphaned `schema.prisma`.
- Added composite indexes:
  - `idx_bids_org` (`bids(organization_id)`)
  - `idx_tender_documents_bid_org` (`tender_documents(bid_id, organization_id)`)
  - `idx_compliance_items_bid_org` (`compliance_items(bid_id, organization_id)`)
  - `idx_comp_ev_status` (`company_evidence(company_id, verification_status)`)
  - `idx_bid_decisions_bid` (`bid_decisions(bid_id)`)

### 6. Domain Flow Consistency

- Repaired `companies.ts` to correctly route folder paths in `listCloudFiles`.
- Updated `OnboardingPage.tsx` to commit user sector selections into company profile versions via `createCompanyProfileVersion`.

---

## Architectural Analysis & Interview Defensibility

### WHY

Storing JWTs in `localStorage` is an anti-pattern for enterprise SaaS because client-side JavaScript has full access to `window.localStorage`. In the event of an XSS flaw in a dependency, an attacker can exfiltrate tokens and maintain indefinite session access. Furthermore, pure stateless JWTs cannot be revoked if a user logs out or if their credentials are compromised.

By adopting `httpOnly` cookies with server-side SHA-256 token rotation, tokens are unreachable by client JavaScript, and server-side revocation provides immediate kill-switch capability while preserving sub-millisecond JWT access validation.

### WHAT

A dual-transport security architecture that:

1. Secures browser clients using `httpOnly`, `Secure`, `SameSite=Strict` cookies.
2. Supports API clients and SDKs via standard `Authorization: Bearer` headers.
3. Implements refresh token rotation with token-family reuse detection in PostgreSQL.
4. Aligns database DDL and indexes with the domain model and eliminates UI race conditions.

### HOW

1. **NestJS `AuthService`**: Manages hashing (`crypto.createHash('sha256')`), token table persistence, rotation logic, and revocation.
2. **NestJS `AuthController`**: Sets `Set-Cookie` response headers with security flags and handles logout.
3. **NestJS `JwtAuthGuard`**: Extracts tokens from either `req.headers.authorization` or `req.cookies.tp_access_token`.
4. **React `client.ts` & `useSSE.ts`**: Configured with `credentials: 'include'` and `withCredentials: true`.
5. **React `useApi.ts`**: Maintains `activeRequestId.current += 1` to guard state updates.
6. **PostgreSQL**: Implements `refresh_tokens` table and composite indexes for multi-tenant isolation queries.

### WHY NOT Alternatives

| Alternative                                                    | Evaluation & Why Rejected                                                                                                                                                                                                                            |
| :------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keep tokens exclusively in localStorage**                    | Rejected. High XSS vulnerability. Tokens cannot be revoked server-side upon logout or breach.                                                                                                                                                        |
| **Store full session state in Redis for every request**        | Deferred per ADR 0007. Introduces a hard operational dependency on Redis before traffic justifies it. Hashed refresh tokens in PostgreSQL provide server-side revocation on refresh, while short-lived access JWTs keep standard requests stateless. |
| **Full OAuth 2.0 Authorization Server (Keycloak / Ory Hydra)** | Overkill for the current phase. Introduces heavy operational overhead before product-market fit. The internal dual-token architecture satisfies enterprise compliance while keeping deployment self-contained.                                       |
| **URL-based JWT tokens for SSE**                               | Rejected. Query string tokens appear in reverse proxy logs, APM traces, and browser history, creating an unacceptable credential leak surface.                                                                                                       |

### TRADE-OFFS

- **Cookie CORS Complexity**: Using credentials (`credentials: 'include'`) requires explicit `Access-Control-Allow-Credentials: true` and forbids wildcard `Access-Control-Allow-Origin: *`. The gateway must maintain an explicit allowed-origin whitelist.
- **CSRF Consideration**: Storing access tokens in cookies introduces CSRF risk. This is mitigated by `SameSite=Strict` (or `Lax` in staging cross-subdomain setups) and requiring custom headers (`X-Requested-With` / `Content-Type: application/json`) on mutating requests.

### FAILURE MODES & MITIGATIONS

1. **Refresh Token Theft & Replay**:
   - _Failure Mode_: An attacker intercepts a refresh token and attempts to use it after the legitimate user has already rotated it.
   - _Mitigation_: The reuse detection mechanism detects that the token was already replaced, flags a potential breach, and revokes all active refresh tokens for the user, forcing a re-login.
2. **Database Outage During Refresh**:
   - _Failure Mode_: PostgreSQL is unavailable when a client attempts to refresh their access token.
   - _Mitigation_: The refresh request fails with a 500 error; the client retries with exponential backoff. Short-lived access tokens continue working for their remaining lifespan on all other stateless routes.
3. **Out-of-Order Responses in UI**:
   - _Failure Mode_: A slow search query resolves after a fast, newer search query, corrupting the UI display.
   - _Mitigation_: The `activeRequestId` counter in `useApi.ts` rejects any response whose request ID does not match the latest dispatched request.

### SECURITY IMPLICATIONS

- **XSS Mitigation**: Sensitive tokens cannot be read by `document.cookie` or `window.localStorage`.
- **Log Leakage Elimination**: SSE streams no longer log JWTs in reverse proxy or CDN access logs.
- **Tenant Boundary Enforcement**: All database indexes are explicitly compound-indexed with `organization_id` to ensure tenant partitioning is optimized and verifiable in query execution plans.
