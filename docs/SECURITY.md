# Security

Tender documents, bid prices and company financials are commercially sensitive, and exposing one bidder's data to another is the worst possible failure. The model is treated as an untrusted text component: deterministic code owns authentication, authorization, tenant scoping and validation.

## 1. Authentication

- **Passwords** are hashed with bcrypt. Login always runs a bcrypt compare, against a dummy hash for unknown emails, so response timing does not reveal which accounts exist.
- **Access tokens** are HS256 JWTs signed with `JWT_SECRET`, valid for 1 hour (`JWT_ACCESS_TTL_SECONDS`). They carry the user id, organization id, role and permissions.
- **Refresh tokens** are valid for 7 days (`JWT_REFRESH_TTL_SECONDS`). Only their SHA-256 hash is stored (`refresh_tokens.token_hash`). Each refresh rotates the token and revokes the old one; a revoked token is rejected, and logout revokes it.
- **Guards.** `JwtAuthGuard` protects every route except those marked `@Public()`: auth, the billing plan list, and the local mock storage routes. It reads the token from the `Authorization: Bearer` header, or from an `HttpOnly` `tp_access_token` cookie. A `?token=` query parameter is never read, so tokens stay out of URLs and access logs; the SSE progress stream is read with `fetch` and the header for the same reason.
- **Service to service.** The AI worker's routes and the API's `/internal/extraction-completed` callback require `X-Internal-Service-Key` (`INTERNAL_SERVICE_KEY`), checked by `InternalServiceGuard` and `verify_internal_key`.

**Known gap:** the web app keeps the refresh token in `localStorage`. Moving it to an `HttpOnly` cookie (Phase 1.1) is blocked on deciding whether the web app and the API share an origin.

## 2. Authorization (RBAC)

Permissions are atomic strings (`apps/api/src/common/security/permissions.ts`). A route declares the permission it needs with `@RequirePermission`, and `RolesGuard` enforces it.

| Permission                                  | ADMIN | BID_MANAGER | REVIEWER | VIEWER |
| ------------------------------------------- | :---: | :---------: | :------: | :----: |
| `org:manage`, `org:users:manage`            |   ✓   |             |          |        |
| `bids:create`, `bids:update`                |   ✓   |      ✓      |          |        |
| `bids:delete`                               |   ✓   |             |          |        |
| `bids:read`, `documents:read`, `audit:read` |   ✓   |      ✓      |    ✓     |   ✓    |
| `documents:upload`                          |   ✓   |      ✓      |          |        |
| `compliance:review`                         |   ✓   |      ✓      |    ✓     |        |
| `company-profile:manage`                    |   ✓   |             |          |        |

`INTERNAL_WORKER` holds only `compliance:bulk_ingest`. The legacy role name `COMPLIANCE_OFFICER` maps to REVIEWER.

## 3. Tenant isolation

- **The tenant comes from the token, never the request.** `TenantContextInterceptor` puts the verified `organizationId` into an `AsyncLocalStorage` context (`TenantContextHolder`). Repositories filter every query by it (`WHERE organization_id = :org`).
- **Not found, not forbidden.** A resource from another tenant answers 404 rather than 403, so its existence is not revealed.
- **Storage keys** always start with `tenants/{organizationId}/`. File names are sanitized of path separators and `..`, and a server-generated document id in the path prevents overwrites.
- **Presigned URLs** are short-lived: 15 minutes for uploads, 5 minutes for downloads. They are signed only for keys the API derived itself.
- **Completions are re-verified.** Before persisting a completion event, the API loads the bid and document from PostgreSQL and checks they belong to the event's organization; any mismatch aborts. A claim-checked payload is read only under that tenant's prefix, and its ids must match the envelope.
- **AI scope.**
  - Each worker call carries an immutable `SecurityContext`: tenant, company, user, workflow run, allowed document and source ids, and purpose.
  - Retrieval only ever sees chunks already filtered to that scope (`ScopedRetrievalTool`), with at most 15 retrieval calls per run.
  - Chat and bid decisions use the same scope, so a workflow on document A cannot read document B.

## 4. Prompt injection

Document text is data, not instructions.

- **Page chunks** go to the model inside `<untrusted_document_data>` tags.
- **Other document-derived text** is wrapped in `<untrusted_context source="...">` by `SecretSanitizer.wrap_untrusted_context`. That covers verification feedback, which quotes model output, plus tender titles and the re-asked off-taxonomy items.
- **Tag-like text** inside either block is escaped, so a document cannot close the boundary early.
- **Every system prompt** that receives such text ends with `UNTRUSTED_DATA_DIRECTIVE`. It tells the model never to follow instructions, role changes, verdict or scoring requests, or format changes found inside those tags.
- **Output is validated, never trusted.** The schema is enforced, quotes must be exact substrings of the page, categories must be on the list, and numbers in the description must appear in the quote. The model cannot issue a verdict or compute an amount: eligibility is evaluated deterministically (`decision/evaluator.py`).

## 5. Secrets and personal data

Before a prompt leaves the worker, `SecretSanitizer.scrub` redacts:

- AWS keys and secrets;
- JWTs and Bearer tokens;
- Postgres URLs with credentials;
- private keys;
- key=value secrets.

Aadhaar numbers are redacted only when the 12-digit number passes the UIDAI Verhoeff checksum or is labelled Aadhaar/UID. Redaction never fires inside AWS contexts (`amazonaws.com/`, `arn:aws`), because account ids there are not personal data. GSTIN-shaped values are recognised too.

The pre-commit hook scans staged changes for credentials.

## 6. Transport and infrastructure

- **CORS.** Only `APP_BASE_URL` is allowed in production; any origin is allowed outside production. JSON bodies are capped at 1 MB.
- **Database TLS.** RDS uses `DATABASE_SSL=verify-full` with the RDS CA bundle baked into the API image (`DATABASE_SSL_CA_FILE`).
- **Encryption.** Terraform creates KMS keys for RDS, S3, SQS and Secrets Manager. The S3 tenant bucket blocks public access and denies non-TLS requests. `DATABASE_URL` and the app secrets live in Secrets Manager.
- **IAM.** The ECS API and AI tasks have separate IAM task roles.

## 7. Known gaps

| Gap                                                                                                                               | Where                                | Status                                                        |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| Refresh token in `localStorage`                                                                                                   | `apps/web/src/auth/AuthProvider.tsx` | Phase 1.1, blocked on same-origin decision                    |
| Production CORS also allows any origin _containing_ `.cloudfront.net` or `.s3-website.ap-south-1.amazonaws.com` (substring match) | `apps/api/src/main.ts`               | Open: should be exact origins                                 |
| `NetworkEgressGuard` (deny-by-default outbound hosts) exists but is not called anywhere                                           | `apps/ai/.../tools/network_guard.py` | Open: no egress restriction in code; rely on VPC egress rules |
| The API has no request rate limiting                                                                                              | `apps/api`                           | Open                                                          |

The original threat model and decisions are in [ADR 0011](adr/0011-ai-security-and-tenant-isolation.md), [ADR 0013](adr/0013-ai-security-and-rag-isolation.md) and [ADR 0025](adr/0025-modular-security-perimeter-and-persistence-hardening.md).
