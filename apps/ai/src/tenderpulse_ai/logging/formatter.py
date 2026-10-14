from __future__ import annotations

import datetime
import json
import logging
import os
from typing import Any

from tenderpulse_ai.logging.context import get_logging_context
from tenderpulse_ai.security.sanitizer import SecretSanitizer


class JSONLogFormatter(logging.Formatter):
    """
    Production JSON log formatter adhering to the canonical TenderPulse schema.
    Enforces deterministic scrubbing of credentials, signatures, and PII before output.
    """

    def __init__(self, service_name: str = "fastapi", environment: str | None = None) -> None:
        super().__init__()
        self.service_name = service_name
        self.environment = (
            environment
            or os.environ.get("ENVIRONMENT")
            or os.environ.get("NODE_ENV", "development")
        )

    def _map_level(self, levelname: str) -> str:
        upper = levelname.upper()
        if upper == "WARNING":
            return "WARN"
        if upper == "CRITICAL":
            return "FATAL"
        return upper

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.datetime.fromtimestamp(record.created, tz=datetime.UTC).isoformat()

        context = get_logging_context()

        # Check for explicit log attributes passed via extra={}
        event = getattr(record, "event", None) or "app.message"
        duration_ms = getattr(record, "duration_ms", None)
        error_code = getattr(record, "error_code", None)
        metadata = getattr(record, "metadata", None) or {}

        # If exception information is attached, record it
        if record.exc_info and record.exc_info[1]:
            exc = record.exc_info[1]
            if not isinstance(metadata, dict):
                metadata = {"extra": metadata}
            metadata["exception_type"] = type(exc).__name__
            metadata["exception_message"] = str(exc)
            if hasattr(exc, "code"):
                error_code = error_code or str(exc.code)

        trace_id = getattr(record, "trace_id", None) or context.get("trace_id")
        correlation_id = getattr(record, "correlation_id", None) or context.get("correlation_id")
        request_id = getattr(record, "request_id", None) or context.get("request_id")
        tenant_id = getattr(record, "tenant_id", None) or context.get("tenant_id")
        user_id = getattr(record, "user_id", None) or context.get("user_id")
        tender_id = getattr(record, "tender_id", None) or context.get("tender_id")
        document_id = getattr(record, "document_id", None) or context.get("document_id")
        job_id = getattr(record, "job_id", None) or context.get("job_id")
        workflow_id = getattr(record, "workflow_id", None) or context.get("workflow_id")
        node = getattr(record, "node", None) or context.get("node")

        payload: dict[str, Any] = {
            "timestamp": timestamp,
            "level": self._map_level(record.levelname),
            "service": self.service_name,
            "environment": self.environment,
            "event": event,
            "message": record.getMessage(),
            "trace_id": trace_id,
            "request_id": request_id,
            "correlation_id": correlation_id,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "tender_id": tender_id,
            "document_id": document_id,
            "job_id": job_id,
            "workflow_id": workflow_id,
            "node": node,
            "duration_ms": duration_ms,
            "error_code": error_code,
            "metadata": metadata if isinstance(metadata, dict) else {"data": metadata},
        }

        try:
            json_str = json.dumps(payload, ensure_ascii=False, default=str)
        except (TypeError, ValueError):
            # Fallback if any un-serializable object is deeply nested
            payload["metadata"] = {"error": "Serialization failure"}
            json_str = json.dumps(payload, default=str)

        # Centralized pre-output secret and PII scrubber
        scrubbed_json, _ = SecretSanitizer.scrub(json_str)
        return scrubbed_json


class ConsoleLogFormatter(logging.Formatter):
    """
    Concise human-friendly one-line console formatter for developer terminals.
    Emits timestamp, level, context tags, message, and latency without noisy JSON clutter.
    """

    def __init__(self, service_name: str = "fastapi") -> None:
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        time_str = datetime.datetime.fromtimestamp(record.created).strftime("%H:%M:%S")
        level = record.levelname.upper()
        if level == "WARNING":
            level = "WARN"
        elif level == "CRITICAL":
            level = "FATAL"

        context = get_logging_context()
        trace_id = getattr(record, "trace_id", None) or context.get("trace_id")
        tenant_id = getattr(record, "tenant_id", None) or context.get("tenant_id")
        duration_ms = getattr(record, "duration_ms", None)

        trace_tag = f" [{trace_id[:12]}]" if trace_id else ""
        tenant_tag = f" [{tenant_id}]" if tenant_id else ""
        duration_tag = f" ({duration_ms}ms)" if duration_ms is not None else ""

        message = record.getMessage()
        scrubbed_msg, _ = SecretSanitizer.scrub(message)

        line = f"[{time_str}] {level:<5} [{self.service_name}]{trace_tag}{tenant_tag} {scrubbed_msg}{duration_tag}"

        if record.exc_info and record.exc_info[1]:
            exc_str = self.formatException(record.exc_info)
            line = f"{line}\n{exc_str}"

        return line
