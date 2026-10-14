from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from tenderpulse_ai.logging.context import scoped_logging_context

logger = logging.getLogger("tenderpulse_ai.http")


class TraceLoggingMiddleware(BaseHTTPMiddleware):
    """
    Starlette/FastAPI middleware for request-level trace propagation,
    fiber-safe context binding, and structured request duration logging.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        trace_id = (
            request.headers.get("x-trace-id")
            or request.headers.get("x-correlation-id")
            or f"trc_{uuid.uuid4().hex[:16]}"
        )
        correlation_id = request.headers.get("x-correlation-id") or trace_id
        request_id = request.headers.get("x-request-id") or f"req_{uuid.uuid4().hex[:12]}"
        tenant_id = request.headers.get("x-tenant-id")

        method = request.method
        path = request.url.path

        start_time = time.perf_counter()

        with scoped_logging_context(
            trace_id=trace_id,
            correlation_id=correlation_id,
            request_id=request_id,
            tenant_id=tenant_id,
        ):
            try:
                response: Response = await call_next(request)
                duration_ms = round((time.perf_counter() - start_time) * 1000, 1)

                response.headers["X-Trace-Id"] = trace_id
                response.headers["X-Correlation-Id"] = correlation_id
                response.headers["X-Request-Id"] = request_id

                status_code = response.status_code
                log_level = (
                    logging.ERROR
                    if status_code >= 500
                    else (logging.WARNING if status_code >= 400 else logging.INFO)
                )

                logger.log(
                    log_level,
                    "%s %s %d (%.1fms)",
                    method,
                    path,
                    status_code,
                    duration_ms,
                    extra={
                        "event": "http.request.completed",
                        "duration_ms": duration_ms,
                        "metadata": {
                            "method": method,
                            "path": path,
                            "status_code": status_code,
                        },
                    },
                )
                return response
            except Exception:
                duration_ms = round((time.perf_counter() - start_time) * 1000, 1)
                logger.exception(
                    "%s %s failed (%.1fms)",
                    method,
                    path,
                    duration_ms,
                    extra={
                        "event": "http.request.failed",
                        "duration_ms": duration_ms,
                        "error_code": "ERR_HTTP_INTERNAL",
                        "metadata": {
                            "method": method,
                            "path": path,
                            "status_code": 500,
                        },
                    },
                )
                raise
