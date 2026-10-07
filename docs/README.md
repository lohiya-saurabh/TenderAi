# Documentation Index

This directory keeps the active product docs plus the workflow and gap-analysis notes needed to complete the AI and processing work without reintroducing broader, redundant audit clutter.

## Canonical entry points

- [STATUS.md](STATUS.md) — active milestone tracker and current implementation status.
- [PRODUCT.md](PRODUCT.md) — bidder-side product vision and business positioning.
- [MVP.md](MVP.md) — MVP scope and delivery milestones.
- [ARCHITECTURE.md](ARCHITECTURE.md) — architecture overview and system-level design expectations.
- [DOMAIN.md](DOMAIN.md) — domain model and business rules.
- [SECURITY_MODEL.md](SECURITY_MODEL.md) — security model and trust boundaries.

## Core platform and architecture docs

- [SERVICE_BOUNDARY.md](SERVICE_BOUNDARY.md) — service responsibilities and handoff boundaries.
- [ASYNC.md](ASYNC.md) — async delivery and idempotency model.
- [ASYNC_DOCUMENT_HANDOFF.md](ASYNC_DOCUMENT_HANDOFF.md) — document-specific async workflow.
- [STORAGE_ARCHITECTURE.md](STORAGE_ARCHITECTURE.md) — storage and object-integrity design.
- [DATABASE.md](DATABASE.md) — data model and persistence design.
- [EVENTS.md](EVENTS.md) — domain events, delivery semantics, and retry behavior.
- [CICD.md](CICD.md) — CI/CD pipeline and deployment flow.
- [HUMAN_REVIEW.md](HUMAN_REVIEW.md) — human-in-the-loop review model.

## Gap analysis and AI workflow docs

- [DOCUMENT_PROCESSING_CURRENT_FLOW.md](DOCUMENT_PROCESSING_CURRENT_FLOW.md) — current runtime flow and boundaries.
- [DOCUMENT_PROCESSING_ARCHITECTURE_GAP.md](DOCUMENT_PROCESSING_ARCHITECTURE_GAP.md) — architecture gap between target and actual runtime.
- [DOCUMENT_EXTRACTION_FLOW.md](DOCUMENT_EXTRACTION_FLOW.md) — parsing and requirement extraction flow.
- [COMPLIANCE_PERSISTENCE_FLOW.md](COMPLIANCE_PERSISTENCE_FLOW.md) — compliance item creation and persistence path.
- [FASTAPI_WORKER_FLOW.md](FASTAPI_WORKER_FLOW.md) — worker and FastAPI processing responsibilities.
- [LANGGRAPH_DOCUMENT_WORKFLOW.md](LANGGRAPH_DOCUMENT_WORKFLOW.md) — LangGraph execution and workflow boundaries.
- [DOCUMENT_PROCESSING_RELIABILITY.md](DOCUMENT_PROCESSING_RELIABILITY.md) — retries, idempotency, and failure handling.
- [DOCUMENT_PROCESSING_SECURITY.md](DOCUMENT_PROCESSING_SECURITY.md) — tenant and company context propagation.
- [END_TO_END_DOCUMENT_PROCESSING_TEST.md](END_TO_END_DOCUMENT_PROCESSING_TEST.md) — validation of the end-to-end workflow.

## AI and security docs

- [AI.md](AI.md) — overall AI architecture.
- [AI_EVALUATION.md](AI_EVALUATION.md) — evaluation and regression framework.
- [AI_SECURITY.md](AI_SECURITY.md) — AI security controls.
- [SECURITY_REVIEW.md](SECURITY_REVIEW.md) — focused security review of the processing and AI workflows.

## Cloud and environment setup

- [AWS.md](AWS.md) and [AWS_DEV_SETUP.md](AWS_DEV_SETUP.md) — AWS design and local setup.
- [GCP.md](GCP.md) and [GCP_DEV_SETUP.md](GCP_DEV_SETUP.md) — GCP design and local setup.

## Architectural decision records

- [adr/](adr/) — ADR directory with the decision history.

## Current policy

The repository keeps the active product documents plus the workflow and gap-analysis notes that directly support completing the AI-processing path and closing the remaining architecture gaps.
