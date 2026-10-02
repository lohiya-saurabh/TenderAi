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

Before any PR can be merged to `main`:

1. `npm run type-check`: 0 TypeScript errors.
2. `npm run lint`: 0 ESLint errors or warnings.
3. `npm test`: 100% passing tests.
4. Security check: No secrets or raw PII in commit history.
