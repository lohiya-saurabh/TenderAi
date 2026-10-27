# Engineering & Git Conventions

## 1. Commit Message Convention (Conventional Commits)

All commit messages must adhere to the Conventional Commits specification:

```
<type>(<scope>): <short description in imperative mood>

[optional body explaining WHY and trade-offs]

[optional footer(s)]
```

### Allowed Types:

- `feat`: A new user-facing or domain feature.
- `fix`: A bug fix.
- `docs`: Documentation changes (ADRs, guides, STATUS.md).
- `style`: Formatting, missing semi-colons, white-space (no production code change).
- `refactor`: Code restructuring without changing behavior.
- `test`: Adding or updating tests.
- `chore`: Build scripts, dependencies, CI/CD configuration.
- `security`: Security patches, tenant isolation, guardrail updates.

### Allowed Scopes:

`api`, `web`, `ai`, `shared-types`, `ui`, `infra`, `security`, `bids`, `compliance`.

### Examples:

- `feat(compliance): enforce immutable provenance value object in batch ingestion`
- `security(ai): add VPC egress deny-by-default rule and XML data framing`
- `fix(bids): prevent concurrency conflict when updating bid deadline`

---

## 2. Branch Naming Strategy

Branches follow the standard prefix structure:

- `feature/<ticket-or-name>`: New feature work.
- `fix/<ticket-or-name>`: Bug fixes.
- `refactor/<name>`: Refactoring.
- `docs/<name>`: Documentation only.

---

## 3. Pull Request & Quality Gate Requirements

Work is merged into `develop`. `main` only ever receives merges from `develop`; CI rejects anything else (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) §2).

Before any PR is merged:

1. `npm run type-check`: 0 TypeScript errors.
2. `npm run lint`: 0 ESLint errors or warnings.
3. `npm test`: 100% passing tests.
4. `uv run ruff check src tests` and `uv run pytest -m unit` in `apps/ai`.
5. Security check: no secrets or raw PII in commit history.
6. The affected docs are updated in the same PR.

---

## 4. Local setup

Local development (PostgreSQL, dev queues, provider keys, running the stack) and the verification gates are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Schema changes and migrations are in [docs/DATABASE.md](docs/DATABASE.md) §2.

## 5. Documentation

Every change updates the documents it affects in the same commit; [docs/README.md](docs/README.md) says which document covers what.
