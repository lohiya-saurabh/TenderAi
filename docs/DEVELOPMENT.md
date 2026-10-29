# Local development

Everything needed to run TenderPulse AI on a Mac and to verify a change. Git conventions are in [CONTRIBUTING.md](../CONTRIBUTING.md).

## 1. Prerequisites

| Tool            | Version                                   | Notes                                                         |
| --------------- | ----------------------------------------- | ------------------------------------------------------------- |
| Node.js / npm   | 22 or later (CI uses 22)                  | npm workspaces                                                |
| Python          | 3.14 via [uv](https://docs.astral.sh/uv/) | The only environment is `apps/ai/.venv`, built from `uv.lock` |
| PostgreSQL      | 16 (Homebrew `postgresql@16`)             | The API needs it; tests do not                                |
| AWS credentials | For the dev SQS queues (§4)               | `ap-south-1`                                                  |

## 2. Install

```bash
npm install
(cd apps/ai && uv sync --extra dev)
cp .env.example .env              # API and web settings
cp apps/ai/.env.example apps/ai/.env   # AI worker settings
```

`npm install` also installs the git pre-commit hook (`.githooks/pre-commit`). The hook scans for secrets, then runs ESLint, the type-check and ruff.

## 3. Database

One-time setup (`postgresql@16` is keg-only, hence the full paths):

```bash
brew install postgresql@16
brew services start postgresql@16
/opt/homebrew/opt/postgresql@16/bin/psql postgres -c "CREATE ROLE tenderpulse LOGIN CREATEDB PASSWORD 'tenderpulse_dev_password';"
/opt/homebrew/opt/postgresql@16/bin/createdb -O tenderpulse tenderpulse_db
```

Then set this in `.env`:

```
DATABASE_URL=postgresql://tenderpulse:tenderpulse_dev_password@localhost:5432/tenderpulse_db
```

The API applies pending migrations on startup. `SEED_DEMO_DATA=true` loads demo users, a company profile and bids on an empty database. The `npm run db:*` commands are in [DATABASE.md](DATABASE.md) §6.

## 4. Queues and storage

Extraction only runs when the API and the worker share real queues. With mock queues the job never reaches the worker. Local development uses dedicated **dev** SQS queues in `ap-south-1`. They are separate from production, so the deployed ECS API cannot pick up local completions.

| Queue                                             | Producer → consumer | Variables                                                                                                                           |
| ------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `tenderai-dev-dociq` (DLQ `tenderai-dev-docidlq`) | API → worker        | `.env`: `AWS_SQS_INGESTION_QUEUE_URL`, `AWS_SQS_DLQ_URL`. `apps/ai/.env`: `AWS_INGESTION_QUEUE_URL`, `INGESTION_QUEUE_PROVIDER=sqs` |
| `tenderai-dev-compq` (DLQ `tenderai-dev-compdlq`) | worker → API        | `.env` and `apps/ai/.env`: `AWS_SQS_COMPLETION_QUEUE_URL`, `AWS_SQS_COMPLETION_DLQ_URL`. Worker: `COMPLETION_QUEUE_PROVIDER=sqs`    |

These queues were created by hand and are not in Terraform yet (see [DEPLOYMENT.md](DEPLOYMENT.md) §5).

**Storage.** Set `AWS_S3_BUCKET` to a dev bucket in both `.env` and `apps/ai/.env`. Uploads then go to S3, and completion events over 200 KB are claim-checked there; that happens for long tenders, roughly 100 pages or more. Both services must use the same bucket. If you leave the bucket unset, the API uses in-memory mock storage: uploads go to `/api/v1/mock-upload/...` and the worker downloads the PDF from `/api/v1/mock-download/...`. In that mode, completions too large for a queue message cannot be delivered.

Leave `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` unset to use your AWS CLI profile. Both templates (`.env.example`, `apps/ai/.env.example`) list every variable described here, with placeholders such as `<account-id>` in place of real values.

## 5. LLM providers

The worker rotates across the free tiers whose keys are set (in `.env` or `apps/ai/.env`; the worker reads both):

| Variable                                      | Provider                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `CEREBRAS_API_KEY`                            | Cerebras (`gpt-oss-120b`)                                                             |
| `GROQ_API_KEY`                                | Groq (`gpt-oss-120b`, `gpt-oss-20b`)                                                  |
| `GEMINI_API_KEY`                              | Google Gemini (`gemini-3.5-flash`, `gemini-3.1-flash-lite`)                           |
| `SAMBANOVA_API_KEY`                           | SambaNova (`DeepSeek-V3.2`, `gpt-oss-120b`)                                           |
| `OPENROUTER_API_KEY`                          | OpenRouter; currently commented out, so disabled                                      |
| `LLM_API_KEY` (+ `LLM_BASE_URL`, `LLM_MODEL`) | Optional single endpoint for tender chat; without it, chat uses the provider rotation |

Tuning knobs, with defaults:

- `LLM_MAX_CONCURRENCY=8`: parallel page windows.
- `BATCH_PAGE_WINDOW_SIZE=3`: pages per window, capped at 3.
- `LLM_TIMEOUT_SECONDS=45`, `LLM_MAX_TOKENS=4096`.
- `LLM_RATE_LIMIT_MAX_WAIT_SECONDS=180`.

How the rotation, rate limits and category schema work is in [AI_PIPELINE.md](AI_PIPELINE.md) §3. Dense retrieval downloads the local embedding model on first use (`EMBEDDING_PROVIDER=local`, about 67 MB); set `EMBEDDING_PROVIDER=none` for BM25 only.

## 6. Run

```bash
npm run dev
```

`scripts/dev.sh` does the following:

- builds `shared-types`, `ui` and the API;
- clears stale processes on ports 8000, 3000 and 5173;
- starts all three services;
- prints the demo logins.

| Service   | URL                                         | Reload                              |
| --------- | ------------------------------------------- | ----------------------------------- |
| AI worker | http://localhost:8000 (`/docs` for Swagger) | uvicorn `--reload` on `apps/ai/src` |
| API       | http://localhost:3000/api/v1                | `tsc -w` + `scripts/watch-api.js`   |
| Web       | http://localhost:5173                       | Vite HMR                            |

Logs go to `logs/` (for example `logs/ai.log`). To follow one document, `grep` its `corr-…` correlation id. To reprocess a document, use `POST /api/v1/bids/:bidId/documents/:docId/reprocess`; reviewed clauses are kept.

**Stopping one service:** stop it by port, for example `lsof -ti :3000 | xargs kill`. Never use `pkill -f <pattern>`: the pattern also matches the shell running it.

## 7. Verify a change

Run the gates that match what you touched. CI runs all of them.

```bash
# AI worker (from apps/ai)
uv run ruff check src tests && uv run ruff format --check src tests
uv run pytest -m unit        # ~20 s, no PDFs, no network
uv run pytest                # adds realdoc tests over data/procurement-evidence PDFs
uv run python -m tenderpulse_ai.evaluation.benchmark --docs 02,04 --compare last

# Packages and apps
npm run build -w @tenderpulse/shared-types
npm run build -w @tenderpulse/api
npm run build -w @tenderpulse/web
npm run type-check
npm test -w @tenderpulse/api
npm test -w @tenderpulse/web

# Browser tests: clause workspace U1–U13, on their own API, fresh demo DB and Vite
npx playwright test
```

Notes:

- **Ruff.** Use only the `uv.lock` version (`apps/ai/.venv/bin/ruff`). Homebrew's ruff formats differently.
- **Prettier.** Use `.prettierrc` (single quotes, width 100). The edit hook formats each file you change; never run a repo-wide `prettier --write`.
- **API test output** prints logs only for failing tests, so read the `Test Files` / `Tests` summary lines.
- **Clause contract change:** regenerate the golden fixture with `UPDATE_FIXTURES=1 uv run pytest tests/test_clause_contract.py`.
- **Real-Postgres API tests:** `TEST_DATABASE_URL=postgresql://tenderpulse:tenderpulse_dev_password@localhost:5432/postgres npx vitest run -w @tenderpulse/api src/test/postgres`.
