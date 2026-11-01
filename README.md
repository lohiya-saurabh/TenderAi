# TenderPulse AI

TenderPulse AI helps Indian bidders get through government tenders. Upload a tender (NIT, RFP, GCC/SCC, often hundreds of pages) and it:

- extracts every bidder obligation with the **exact quote, page and clause** it comes from;
- flags contradictions between clauses;
- lists any pages it could not process;
- gives the bid team a workspace to confirm each clause and track bid preparation.

Nothing is made up: an item without a verbatim quote from the tender is rejected, and a value the tender does not state stays "Not stated".

## What it does

- **Clause extraction.** An LLM-only LangGraph pipeline turns each tender into categorized, quoted obligations: financial, technical, statutory, legal, operational, commercial and execution. Every quote is checked against the page text.
- **Clause workspace.** Reviewers confirm, correct or reject each clause against its source. Conflicts get their own resolution view, and re-extraction never overwrites a review.
- **Company profile and evidence.** A versioned capability profile, plus uploaded certificates and financials, with GSTIN, MCA, Udyam and DigiLocker verification.
- **Bid or no-bid.** Eligibility is evaluated deterministically against the profile, with an AI summary of risks.
- **Tender chat.** Questions answered from the tender, with citations, over tenant-scoped retrieval (BM25 plus local embeddings).

## How it is built

```
React SPA ──► NestJS API ──► PostgreSQL 16
                 │  ▲
       SQS job   ▼  │  SQS completion (claim-check to S3 for large results)
             FastAPI AI worker (Docling, LangGraph, multi-provider LLM rotation)
```

- **Web:** `apps/web`, built with React 18, Vite, Tailwind and Radix.
- **API:** `apps/api`, built with NestJS 12, Drizzle ORM and node-postgres. It owns authentication, tenancy and every database write.
- **AI worker:** `apps/ai`, built with Python 3.14, FastAPI, LangGraph, Docling and fastembed. It is a pure compute service that never touches the database.
- **Shared packages:** the clause contract and DTOs in `packages/shared-types`, and components in `packages/ui`.
- **Infrastructure:** Terraform for AWS (ECS Fargate, RDS, S3, SQS, KMS) in `infrastructure/terraform`, with CI/CD in GitHub Actions.

## Quick start

You need Node 22+, [uv](https://docs.astral.sh/uv/), PostgreSQL 16 and AWS credentials for the dev queues. The one-time database and queue setup is in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

```bash
npm install
(cd apps/ai && uv sync --extra dev)
cp .env.example .env && cp apps/ai/.env.example apps/ai/.env   # then fill in DATABASE_URL, queues, LLM keys
npm run dev
```

| Service   | URL                                        |
| --------- | ------------------------------------------ |
| Web       | http://localhost:5173                      |
| API       | http://localhost:3000/api/v1               |
| AI worker | http://localhost:8000 (Swagger at `/docs`) |

`npm run dev` prints the demo logins. Run the checks before you push:

```bash
npm run type-check && npm run lint && npm test
(cd apps/ai && uv run ruff check src tests && uv run pytest -m unit)
```

## Repository layout

```
apps/api/          NestJS API
apps/ai/           FastAPI AI worker
apps/web/          React SPA
packages/          shared-types (clause contract), ui, config
infrastructure/    Terraform (AWS environments and modules, gcp-local)
scripts/           dev runner, DB tools, setup helpers
docs/              guides, ADRs, audits
```

## Documentation

| Topic                          | Document                                                             |
| ------------------------------ | -------------------------------------------------------------------- |
| Index of all docs              | [docs/README.md](docs/README.md)                                     |
| Product and domain             | [docs/PRODUCT.md](docs/PRODUCT.md), [docs/DOMAIN.md](docs/DOMAIN.md) |
| Architecture and data flow     | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                         |
| HTTP API                       | [docs/API.md](docs/API.md)                                           |
| Extraction pipeline and models | [docs/AI_PIPELINE.md](docs/AI_PIPELINE.md)                           |
| Security                       | [docs/SECURITY.md](docs/SECURITY.md)                                 |
| Database                       | [docs/DATABASE.md](docs/DATABASE.md)                                 |
| Local development and tests    | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)                           |
| Deployment and CI/CD           | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)                             |
| Engineering rules              | [AGENTS.md](AGENTS.md), [CONTRIBUTING.md](CONTRIBUTING.md)           |
