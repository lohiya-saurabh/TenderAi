# Documentation

Start with the root [README](../README.md) for a quick start. The engineering rules every change follows are in [AGENTS.md](../AGENTS.md).

## Guides

| Document                           | Read it for                                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [PRODUCT.md](PRODUCT.md)           | What we build and for whom: bidder workflows, the company capability profile, MVP scope                              |
| [DOMAIN.md](DOMAIN.md)             | Indian public procurement (tender anatomy, two-packet bidding, disqualification cases) and the ubiquitous language   |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Services, code layout, the upload → outbox → queue → worker → completion flow, adapters, failure handling            |
| [API.md](API.md)                   | Every HTTP route of the API and the internal AI worker routes                                                        |
| [AI_PIPELINE.md](AI_PIPELINE.md)   | Extraction stages, the LangGraph workflow, the model rotation and rate limits, retrieval, human review, benchmarking |
| [SECURITY.md](SECURITY.md)         | Authentication, RBAC, tenant isolation, prompt-injection boundaries, secret scrubbing, known gaps                    |
| [DATABASE.md](DATABASE.md)         | PostgreSQL setup per environment, migrations, tables, the clause row                                                 |
| [DEVELOPMENT.md](DEVELOPMENT.md)   | Running everything locally (Postgres, dev queues, provider keys) and the verification gates                          |
| [DEPLOYMENT.md](DEPLOYMENT.md)     | AWS Terraform, CI/CD, GCP adapters, and what must be fixed before the next production deploy                         |

## Decision records

[`adr/`](adr/) holds the architectural decisions in the form they were taken; they are not rewritten afterwards. Where the code has since moved on, the guides above describe the current state:

Some ADRs cite documents that have since been merged into the guides:

- `ASYNC_DOCUMENT_HANDOFF.md`, `SERVICE_BOUNDARY.md`, `LLD.md`, `EVENTS.md` and `STORAGE_ARCHITECTURE.md` are now in ARCHITECTURE.md;
- `SECURITY_MODEL.md` and `AI_SECURITY.md` are now in SECURITY.md;
- `AI.md`, `AI_EVALUATION.md` and `HUMAN_REVIEW.md` are now in AI_PIPELINE.md;
- `AWS.md`, `CICD.md` and `GCP.md` are now in DEPLOYMENT.md.

| ADR                                                                          | Note                                                                                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [0012](adr/0012-domain-events-and-eventbridge.md)                            | Domain events run on the in-process bus; EventBridge remains deferred                                                          |
| [0019](adr/0019-deterministic-eligibility-matching-engine.md)                | The deterministic evaluator lives in the AI worker (`decision/evaluator.py`), not in NestJS                                    |
| [0020](adr/0020-external-data-connectors-enrichment-port.md)                 | Implemented as the company-verification providers (GSTIN, MCA, Udyam, DigiLocker)                                              |
| [0028](adr/0028-high-recall-candidate-scoring-context-fusion-rescue-pass.md) | Superseded in part: extraction is LLM-only and sends every clause chunk of a window to the model; there is no rescue-pass node |

## Audits and benchmarks

[`audits/`](audits/) records diagnoses, benchmark results and the decisions taken from them:

- [MODEL_ROTATION_QUALITY_BENCHMARK.md](audits/MODEL_ROTATION_QUALITY_BENCHMARK.md) — why qwen was dropped from the rotation (2026-10-27)
- [END_TO_END_AUDIT.md](audits/END_TO_END_AUDIT.md) — the system audit whose remediation Phases 1–4 are complete
- [PIPELINE_DIAGNOSTICS_AND_BENCHMARK_AUDIT.md](audits/PIPELINE_DIAGNOSTICS_AND_BENCHMARK_AUDIT.md) — pipeline stages, the 30-obligation benchmark matrix, multi-tender hazards
- [DOCUMENT_AGNOSTIC_GENERALIZATION_AUDIT.md](audits/DOCUMENT_AGNOSTIC_GENERALIZATION_AUDIT.md) — the move to LLM-only, document-agnostic extraction

## Keeping docs current

Every change updates the documents it affects in the same commit (rule in [AGENTS.md](../AGENTS.md) §3). In particular:

- new or changed routes → `API.md`;
- schema or migrations → `DATABASE.md`;
- pipeline, models or prompts → `AI_PIPELINE.md`;
- infrastructure or CI → `DEPLOYMENT.md`;
- local setup → `DEVELOPMENT.md`.

A benchmark or decision that changes behaviour gets a note in `audits/`.
