from __future__ import annotations

import contextlib
from collections.abc import Generator
from contextvars import ContextVar

# Fiber-safe context storage for distributed tracing and multi-tenant correlation
trace_id_var: ContextVar[str | None] = ContextVar("trace_id", default=None)
correlation_id_var: ContextVar[str | None] = ContextVar("correlation_id", default=None)
request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
tenant_id_var: ContextVar[str | None] = ContextVar("tenant_id", default=None)
user_id_var: ContextVar[str | None] = ContextVar("user_id", default=None)
tender_id_var: ContextVar[str | None] = ContextVar("tender_id", default=None)
document_id_var: ContextVar[str | None] = ContextVar("document_id", default=None)
job_id_var: ContextVar[str | None] = ContextVar("job_id", default=None)
workflow_id_var: ContextVar[str | None] = ContextVar("workflow_id", default=None)
node_var: ContextVar[str | None] = ContextVar("node", default=None)


def set_logging_context(
    *,
    trace_id: str | None = None,
    correlation_id: str | None = None,
    request_id: str | None = None,
    tenant_id: str | None = None,
    user_id: str | None = None,
    tender_id: str | None = None,
    document_id: str | None = None,
    job_id: str | None = None,
    workflow_id: str | None = None,
    node: str | None = None,
) -> None:
    """Sets active logging context variables for the current execution fiber."""
    if trace_id is not None:
        trace_id_var.set(trace_id)
    if correlation_id is not None:
        correlation_id_var.set(correlation_id)
    if request_id is not None:
        request_id_var.set(request_id)
    if tenant_id is not None:
        tenant_id_var.set(tenant_id)
    if user_id is not None:
        user_id_var.set(user_id)
    if tender_id is not None:
        tender_id_var.set(tender_id)
    if document_id is not None:
        document_id_var.set(document_id)
    if job_id is not None:
        job_id_var.set(job_id)
    if workflow_id is not None:
        workflow_id_var.set(workflow_id)
    if node is not None:
        node_var.set(node)


def get_logging_context() -> dict[str, str | None]:
    """Retrieves all active context variables as a dictionary."""
    return {
        "trace_id": trace_id_var.get(),
        "correlation_id": correlation_id_var.get(),
        "request_id": request_id_var.get(),
        "tenant_id": tenant_id_var.get(),
        "user_id": user_id_var.get(),
        "tender_id": tender_id_var.get(),
        "document_id": document_id_var.get(),
        "job_id": job_id_var.get(),
        "workflow_id": workflow_id_var.get(),
        "node": node_var.get(),
    }


def clear_logging_context() -> None:
    """Resets all context variables to None."""
    trace_id_var.set(None)
    correlation_id_var.set(None)
    request_id_var.set(None)
    tenant_id_var.set(None)
    user_id_var.set(None)
    tender_id_var.set(None)
    document_id_var.set(None)
    job_id_var.set(None)
    workflow_id_var.set(None)
    node_var.set(None)


@contextlib.contextmanager
def scoped_logging_context(
    *,
    trace_id: str | None = None,
    correlation_id: str | None = None,
    request_id: str | None = None,
    tenant_id: str | None = None,
    user_id: str | None = None,
    tender_id: str | None = None,
    document_id: str | None = None,
    job_id: str | None = None,
    workflow_id: str | None = None,
    node: str | None = None,
) -> Generator[None, None, None]:
    """Context manager that scopes context variable overrides to a specific block."""
    tokens = []
    if trace_id is not None:
        tokens.append((trace_id_var, trace_id_var.set(trace_id)))
    if correlation_id is not None:
        tokens.append((correlation_id_var, correlation_id_var.set(correlation_id)))
    if request_id is not None:
        tokens.append((request_id_var, request_id_var.set(request_id)))
    if tenant_id is not None:
        tokens.append((tenant_id_var, tenant_id_var.set(tenant_id)))
    if user_id is not None:
        tokens.append((user_id_var, user_id_var.set(user_id)))
    if tender_id is not None:
        tokens.append((tender_id_var, tender_id_var.set(tender_id)))
    if document_id is not None:
        tokens.append((document_id_var, document_id_var.set(document_id)))
    if job_id is not None:
        tokens.append((job_id_var, job_id_var.set(job_id)))
    if workflow_id is not None:
        tokens.append((workflow_id_var, workflow_id_var.set(workflow_id)))
    if node is not None:
        tokens.append((node_var, node_var.set(node)))

    try:
        yield
    finally:
        for var, token in reversed(tokens):
            var.reset(token)
