# API

The NestJS API (`apps/api`) is the only public backend. Every route is under `/api/v1`. Unless marked otherwise, a route needs `Authorization: Bearer <access JWT>` and is scoped to the caller's organization (from the token, never from the request). The permission each route requires is set with `@RequirePermission`; roles and permissions are in [SECURITY.md](SECURITY.md).

Source of truth: the controllers under `apps/api/src/modules/**`. When you add or change a route, update this file in the same commit.

## Auth (public)

| Method | Path                  | Notes                                                                               |
| ------ | --------------------- | ----------------------------------------------------------------------------------- |
| POST   | `/auth/register`      | Creates the organization and its first user (ADMIN)                                 |
| POST   | `/auth/accept-invite` | Sets an invited member's password from their one-time invite link and signs them in |
| POST   | `/auth/login`         | Returns access + refresh token and the user; 400 without email and password         |
| POST   | `/auth/refresh`       | Rotates the refresh token (the old one is revoked)                                  |
| POST   | `/auth/logout`        | Revokes the refresh token                                                           |

## Bids

| Method      | Path                                                                                                       | Notes                                                                                                                                                                                                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET, POST   | `/bids`                                                                                                    | List / create bids                                                                                                                                                                                                                                                                          |
| GET, DELETE | `/bids/:id`                                                                                                | One bid / delete it                                                                                                                                                                                                                                                                         |
| GET, POST   | `/bids/:id/bid-decision`                                                                                   | Read / run the bid-or-no-bid evaluation (AI `/api/v1/agent/bid-decision`). GET returns 204 when the bid was never evaluated. POST returns 503 when the engine is unreachable; there is no local fallback engine                                                                             |
| GET         | `/bids/:id/readiness`, `/review-tasks`, `/evidence-matches`, `/risk-findings`, `/deadlines`, `/amendments` | Derived views of a bid                                                                                                                                                                                                                                                                      |
| GET         | `/bids/:id/evidence-matches`                                                                               | Clauses that ask for proof (turnover, similar work, a named certificate, a registration), each linked to the company's evidence: `MATCHED` (verified), `PARTIAL` (read by AI, not verified), `EXPIRED` (invalid on the deadline) or `UNMATCHED`. Clauses that need no document are left out |
| GET         | `/tenders/amendments`                                                                                      | Amendments across bids                                                                                                                                                                                                                                                                      |
| GET         | `/bids/:bidId/audit-events`                                                                                | Audit trail                                                                                                                                                                                                                                                                                 |

## Documents

| Method    | Path                                                                          | Notes                                                                                                            |
| --------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| POST      | `/bids/:bidId/upload-url`                                                     | Presigned PUT URL and storage path                                                                               |
| POST      | `/bids/:bidId/documents/confirm`                                              | Verifies the object and queues processing (outbox)                                                               |
| POST      | `/bids/:bidId/documents/:docId/reprocess`                                     | Re-queues extraction; human reviews are kept                                                                     |
| GET       | `/bids/:bidId/documents/:docId/download-url`                                  | Presigned GET URL                                                                                                |
| DELETE    | `/bids/:bidId/documents/:docId`                                               | Removes the document and all of its clauses                                                                      |
| GET       | `/bids/:bidId/documents/:documentId/pages/:page`                              | Page text, for showing a clause in its source                                                                    |
| GET (SSE) | `/bids/:bidId/extraction-progress` (aliases `/progress`, `/documents/stream`) | Server-sent progress events. The web client streams it with `fetch` and the Bearer header; `?token=` is rejected |
| PUT, GET  | `/mock-upload/...`, `/mock-download/...` (public)                             | Only for mock storage in local development                                                                       |

## Clauses (compliance items)

| Method     | Path                                                        | Notes                                                                                                                                                             |
| ---------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET        | `/bids/:bidId/clauses`                                      | Clause workspace list (filters, search, facets)                                                                                                                   |
| GET        | `/bids/:bidId/clauses/:clauseId`                            | One clause with provenance                                                                                                                                        |
| POST       | `/bids/:bidId/clauses/:clauseId/review`                     | Confirm / correct / reject one clause                                                                                                                             |
| POST       | `/bids/:bidId/clauses/bulk-review`                          | Review several clauses                                                                                                                                            |
| PATCH      | `/bids/:bidId/clauses/:clauseId/fulfilment`                 | Set a clause's preparation status (`NOT_STARTED` … `DONE`, `AT_RISK`, `NOT_APPLICABLE`) and owner, with `expectedVersion`; audited as `CLAUSE_FULFILMENT_UPDATED` |
| GET        | `/bids/:bidId/conflicts`                                    | Contradictions between clauses (e.g. two PBG percentages)                                                                                                         |
| PATCH      | `/bids/:bidId/conflicts/:conflictId`                        | Resolve a conflict                                                                                                                                                |
| GET        | `/bids/:bidId/coverage`                                     | Extraction coverage per document (`COMPLETE` / `PARTIAL`, failed pages)                                                                                           |
| GET        | `/bids/:bidId/summary`                                      | Counts for the bid header                                                                                                                                         |
| GET, PATCH | `/bids/:bidId/compliance-items[/:itemId]`, `PATCH .../bulk` | Older checklist endpoints, still used by the checklist page                                                                                                       |

## Companies and evidence

| Method            | Path                                                                                                                                   | Notes                                                                                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET, POST         | `/companies`, `/companies/:id`                                                                                                         | Companies of the organization                                                                                                                                                                                        |
| GET, POST         | `/companies/:id/profile`, `GET .../profile/versions/:versionId`                                                                        | Versioned capability profile                                                                                                                                                                                         |
| PATCH             | `/companies/:id/onboarding-preferences`                                                                                                | Onboarding answers                                                                                                                                                                                                   |
| GET               | `/companies/:id/expiring-certificates`                                                                                                 | Certificates about to expire                                                                                                                                                                                         |
| GET, POST         | `/company-profile`, `/company-profile/versions/:versionId`, `/company-profile/expiring-certificates`                                   | Profile of the caller's default company                                                                                                                                                                              |
| POST              | `/company-profile/evidence/:evidenceId/apply?companyId=`                                                                               | Adds what an evidence document states (turnover per year, a completed project, a certificate) to the profile as a new version; returns `added` and `skipped` (fields the document did not state are never filled in) |
| GET, POST, DELETE | `/companies/:companyId/evidence[...]`                                                                                                  | Upload, list, import from cloud drives, download, delete, and `POST /:evidenceId/extract` (AI `/api/v1/evidence/extract`)                                                                                            |
| POST, GET         | `/companies/:companyId/verification/{gstin,mca,udyam}`, `digilocker/authorize`, `digilocker/callback`, `history`, `review-discrepancy` | Third-party registry checks. Mock providers locally; in production an unconfigured provider answers 503 (unless `ALLOW_MOCK_SERVICES=true`). The web has no DigiLocker control: there is no OAuth callback page      |

## Workspace

| Method            | Path                                                                                                       | Notes                                                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST, GET, DELETE | `/chat/messages`, `/chat/conversations[/:id[/messages]]`                                                   | Tender chat (AI `/api/v1/chat/query`)                                                                                                                                                  |
| GET               | `/dashboard/metrics`                                                                                       | Dashboard numbers                                                                                                                                                                      |
| GET, PATCH, POST  | `/notifications`, `/notifications/:id/read`, `/notifications/mark-all-read`, `/notifications/trigger-scan` | In-app notifications                                                                                                                                                                   |
| GET, PATCH        | `/settings/workspace`                                                                                      | Organization settings                                                                                                                                                                  |
| GET, POST         | `/teams/members`, `/teams/invite`, `/teams/members/:id/invite-link`                                        | Team management. An invite returns a one-time `inviteUrl` (valid 7 days; only its hash is stored, and no email is sent yet). `invite-link` issues a fresh link and retires the old one |
| GET, PATCH, POST  | `/users/me`, `/users/change-password`                                                                      | The caller's account                                                                                                                                                                   |
| GET, POST         | `/billing/plans` (public), `/billing/subscription`, `/billing/usage`, `/billing/change-plan`               | Plans and usage. `change-plan` answers 503 in production (no payment provider) unless `ALLOW_MOCK_SERVICES=true`                                                                       |

## Internal

| Method | Path                             | Notes                                                                                                      |
| ------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| POST   | `/internal/extraction-completed` | HTTP completion callback for the worker's `http` publisher; needs `X-Internal-Service-Key`, not a user JWT |

## AI worker endpoints (internal)

The worker (`apps/ai`, port 8000) is not exposed publicly. Its routes need `X-Internal-Service-Key`:

| Method | Path                             | Notes                                                                                                            |
| ------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                        | Liveness                                                                                                         |
| POST   | `/api/v1/extract`                | Synchronous extraction, for debugging and tests. Returns HTTP 503 `LLM_EXTRACTION_FAILED` when no model answered |
| POST   | `/api/v1/worker/process-message` | Processes one ingestion message without the queue                                                                |
| GET    | `/api/v1/worker/queue-status`    | Consumer state                                                                                                   |
| POST   | `/api/v1/agent/bid-decision`     | Bid decision engine                                                                                              |
| POST   | `/api/v1/evidence/extract`       | Company evidence attributes                                                                                      |
| POST   | `/api/v1/chat/query`             | Tender chat                                                                                                      |

FastAPI serves its interactive docs at `http://localhost:8000/docs` in development.
