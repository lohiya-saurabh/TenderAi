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

---

## 4. Local database

The API runs on real PostgreSQL 16 through `DATABASE_URL` (RDS in AWS). Tests use in-memory
PGlite (`PGLITE_DATA_DIR=memory://`), so they need no server.

One-time setup with Homebrew (`postgresql@16` is keg-only, hence the full paths):

```bash
brew install postgresql@16
brew services start postgresql@16
/opt/homebrew/opt/postgresql@16/bin/psql postgres -c "CREATE ROLE tenderpulse LOGIN CREATEDB PASSWORD 'tenderpulse_dev_password';"
/opt/homebrew/opt/postgresql@16/bin/createdb -O tenderpulse tenderpulse_db
```

Then set this in `.env` (it is already in `.env.example`):

```
DATABASE_URL=postgresql://tenderpulse:tenderpulse_dev_password@localhost:5432/tenderpulse_db
```

The API applies pending schema migrations on startup. Useful commands:

- `npm run db:status` / `npm run db:query "SELECT ..."`: inspect the database.
- `npm run db:seed`: load the demo data. `npm run db:wipe -- --local`: drop everything
  (refuses non-local hosts unless `--allow-remote`).

### Schema changes

Migrations live in `apps/api/src/common/database/migrations/`. To change the schema, edit the
Drizzle schema in `schema/` and add a new `NNNN_description.ts` migration with the matching SQL,
appended to `migrations/index.ts`. Never edit a migration that has been applied: the migrator
stores a checksum and refuses to start if one changes.

### Real-PostgreSQL tests

`apps/api/src/test/postgres/` covers the node-postgres driver, migrations, demo seed and
outbox claiming against a real server. It is skipped unless `TEST_DATABASE_URL` is set to a
role that can create databases; each run uses a throwaway database:

```bash
TEST_DATABASE_URL=postgresql://tenderpulse:tenderpulse_dev_password@localhost:5432/postgres \
  npx vitest run -w @tenderpulse/api src/test/postgres
```
