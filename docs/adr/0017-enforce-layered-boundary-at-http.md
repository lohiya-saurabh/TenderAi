# ADR 0017: Enforce the Layered Boundary at HTTP (Eliminate the CRUD Bypass)

## Status

Accepted (2026-10-05)

## Context

The audit (`docs/CURRENT_STATE.md` §2/§4) found two parallel controller stacks in `apps/api`:

1. **DDD stack**: `modules/*/application/*UseCase.ts` + `modules/*/presentation/*Controller.ts` (plain classes taking `organizationId`/`userId` explicitly, enforcing `TenantContextHolder.requirePermission`).
2. **Live HTTP stack**: NestJS `@Controller` classes calling CRUD services (`bids.service.ts`, `compliance.service.ts`, `documents.service.ts`) that do domain work directly, with a hardcoded tenant and no permission checks.

The DDD stack is dead code at runtime; the live stack bypasses the domain layer entirely. RBAC exists only in the unused use cases.

### The Problem

1. **Authorization is not enforced at the HTTP boundary** — any caller reaches tenant data.
2. **Domain rules live in the wrong layer** — state transitions, metric rollups, and cascade rules are scattered in CRUD services, untestable in isolation.
3. **Two stacks drift** — new features get built on the wrong one; the divergence compounds.

## Decision

1. **HTTP controllers delegate to application use cases only.** Controllers resolve identity/tenant from the request (JWT guard → `TenantContextHolder.run()`), validate the DTO, and call a use case. No controller touches repositories or Drizzle directly.
2. **CRUD services are eliminated or reduced to thin read-model projections.** Write paths go through use cases; domain entities enforce their own invariants.
3. **Guards are mandatory infrastructure**: `JwtAuthGuard` (verify signature, expiry) → `TenantGuard` (resolve tenant from token claims, never from request body) → `PermissionGuard` (atomic permission check). Deny by default.
4. **One stack, one way**: the `presentation/` DDD controllers become the HTTP controllers (NestJS decorators on top of the existing use-case delegation), and the CRUD services are deleted after migration.

## Consequences

- **Positive**:
  - Every request is authenticated, tenant-scoped, and permission-checked — the `SECURITY_MODEL.md` promise becomes real.
  - Domain logic is testable without HTTP; use cases already have specs.
  - The audit's critical findings (forgeable tokens, no guards, hardcoded tenant) are addressed by construction, not by convention.
- **Negative / Trade-offs**:
  - Migration effort is non-trivial: every endpoint must be re-pointed; tests must be added at the HTTP level (current tests inject tenant context manually, which masked the gap).
  - Slightly more indirection per request (controller → use case → entity), which is the intended cost of the layered architecture (ADR 0008).
- **Failure modes**: a forgotten guard on one route reopens the hole — mitigated by a global deny-by-default guard and an HTTP-level auth test suite that asserts 401/403/404 on every route.

## References

ADR 0008 (DDD layered architecture), `docs/SECURITY_MODEL.md`, `docs/CURRENT_STATE.md` §3/§4/§5.
