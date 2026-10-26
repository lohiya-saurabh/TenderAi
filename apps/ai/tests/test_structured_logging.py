"""
Comprehensive Unit Tests for Structured Logging and Secret Sanitization in TenderPulse AI.
Verifies canonical schema compliance, context propagation, and strict PII/secret scrubbing.
"""

import json
import logging

import pytest
from fastapi.testclient import TestClient

from tenderpulse_ai.logging.context import (
    get_logging_context,
    scoped_logging_context,
    set_logging_context,
    trace_id_var,
)
from tenderpulse_ai.logging.formatter import JSONLogFormatter
from tenderpulse_ai.main import app
from tenderpulse_ai.security.sanitizer import SecretSanitizer


class TestSecretSanitizer:
    def test_scrubs_jwt_and_bearer_tokens(self):
        raw = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc"
        sanitized, was_scrubbed = SecretSanitizer.scrub(raw)
        assert was_scrubbed is True
        assert "[REDACTED_JWT]" in sanitized
        assert "eyJhbGciOi" not in sanitized

    def test_scrubs_aws_credentials(self):
        raw = "Connecting with access key AKIAIOSFODNN7EXAMPLE and secret key"
        sanitized, was_scrubbed = SecretSanitizer.scrub(raw)
        assert was_scrubbed is True
        assert "[REDACTED_AWS_KEY]" in sanitized
        assert "AKIAIOSFODNN7EXAMPLE" not in sanitized

    def test_scrubs_presigned_signatures(self):
        url = "https://bucket.s3.amazonaws.com/doc.pdf?X-Amz-Signature=d41d8cd98f00b204e9800998ecf8427e&X-Amz-Expires=3600"
        sanitized, was_scrubbed = SecretSanitizer.scrub(url)
        assert was_scrubbed is True
        assert "X-Amz-Signature=[REDACTED]" in sanitized
        assert "d41d8cd98f00b204e9800998ecf8427e" not in sanitized

    def test_scrubs_indian_pii_pan_gstin_aadhaar(self):
        doc = "Bidder PAN: ABCDE1234F, GSTIN: 27AABCU9603R1ZX, Aadhaar: 9876 5432 1098"
        sanitized, was_scrubbed = SecretSanitizer.scrub(doc)
        assert was_scrubbed is True
        assert "[REDACTED_PAN]" in sanitized
        assert "ABCDE1234F" not in sanitized
        assert "[REDACTED_GSTIN]" in sanitized
        assert "27AABCU9603R1ZX" not in sanitized
        assert "[REDACTED_AADHAAR]" in sanitized
        assert "9876 5432 1098" not in sanitized


class TestJSONLogFormatter:
    def test_formats_canonical_schema_with_context(self):
        formatter = JSONLogFormatter(service_name="fastapi", environment="test")
        logger = logging.getLogger("test_canonical_logger")

        with scoped_logging_context(
            trace_id="trace-test-123",
            tenant_id="tenant-acme",
            document_id="doc-tender-999",
            job_id="job-extraction-42",
        ):
            record = logger.makeRecord(
                name="test_canonical_logger",
                level=logging.INFO,
                fn="test.py",
                lno=10,
                msg="Document parsed successfully",
                args=(),
                exc_info=None,
                extra={"event": "docling.parse.completed", "duration_ms": 124.5},
            )
            formatted = formatter.format(record)
            payload = json.loads(formatted)

            # Assert canonical schema keys
            assert payload["service"] == "fastapi"
            assert payload["environment"] == "test"
            assert payload["level"] == "INFO"
            assert payload["event"] == "docling.parse.completed"
            assert payload["message"] == "Document parsed successfully"
            assert payload["trace_id"] == "trace-test-123"
            assert payload["tenant_id"] == "tenant-acme"
            assert payload["document_id"] == "doc-tender-999"
            assert payload["job_id"] == "job-extraction-42"
            assert payload["duration_ms"] == 124.5
            assert "timestamp" in payload

    def test_sanitizes_pii_in_log_messages(self):
        formatter = JSONLogFormatter(service_name="fastapi")
        logger = logging.getLogger("test_sanitizing_logger")

        record = logger.makeRecord(
            name="test_sanitizing_logger",
            level=logging.INFO,
            fn="test.py",
            lno=15,
            msg="Processing tender for vendor with PAN ABCDE1234F and bearer token Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc",
            args=(),
            exc_info=None,
        )
        formatted = formatter.format(record)
        payload = json.loads(formatted)

        assert "[REDACTED_PAN]" in payload["message"]
        assert "ABCDE1234F" not in payload["message"]
        assert "[REDACTED_JWT]" in payload["message"]
        assert "eyJhbGciOi" not in payload["message"]

    def test_sanitizes_pii_in_metadata(self):
        formatter = JSONLogFormatter(service_name="fastapi")
        logger = logging.getLogger("test_metadata_sanitizing")

        record = logger.makeRecord(
            name="test_metadata_sanitizing",
            level=logging.INFO,
            fn="test.py",
            lno=20,
            msg="Parsed vendor attributes",
            args=(),
            exc_info=None,
            extra={
                "metadata": {
                    "gstin": "27AABCU9603R1ZX",
                    "presigned_url": "https://s3.amazonaws.com/doc.pdf?X-Amz-Signature=secret1234567890abcdef",
                }
            },
        )
        formatted = formatter.format(record)
        payload = json.loads(formatted)

        assert "[REDACTED_GSTIN]" in payload["metadata"]["gstin"]
        assert "X-Amz-Signature=[REDACTED]" in payload["metadata"]["presigned_url"]
        assert "secret1234567890abcdef" not in payload["metadata"]["presigned_url"]


class TestLoggingContext:
    def test_scoped_logging_context_restores_state(self):
        set_logging_context(trace_id="outer-trace", tenant_id="outer-tenant")
        assert trace_id_var.get() == "outer-trace"

        with scoped_logging_context(trace_id="inner-trace", tenant_id="inner-tenant"):
            assert trace_id_var.get() == "inner-trace"
            ctx = get_logging_context()
            assert ctx["trace_id"] == "inner-trace"
            assert ctx["tenant_id"] == "inner-tenant"

        assert trace_id_var.get() == "outer-trace"


class TestTraceLoggingMiddleware:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_propagates_incoming_trace_and_correlation_headers(self, client):
        custom_trace = "trace-custom-uuid-999"
        custom_corr = "corr-custom-uuid-888"

        response = client.get(
            "/health",
            headers={
                "X-Trace-Id": custom_trace,
                "X-Correlation-Id": custom_corr,
            },
        )

        assert response.status_code == 200
        assert response.headers.get("X-Trace-Id") == custom_trace
        assert response.headers.get("X-Correlation-Id") == custom_corr

    def test_generates_trace_id_when_omitted(self, client):
        response = client.get("/health")

        assert response.status_code == 200
        assert "X-Trace-Id" in response.headers
        assert len(response.headers["X-Trace-Id"]) > 0


class TestDualSinkLoggingAndTruncation:
    def test_truncates_oversized_prompts_and_document_content(self):
        huge_prompt = "Extract all requirements from the following tender " * 20
        raw_payload = json.dumps({"prompt": huge_prompt, "other_field": "safe"})

        scrubbed, was_scrubbed = SecretSanitizer.scrub(raw_payload)
        assert was_scrubbed is True
        assert "[TRUNCATED:" in scrubbed
        assert "chars omitted for log safety" in scrubbed

        # Ensure valid JSON output after truncation
        parsed = json.loads(scrubbed)
        assert parsed["other_field"] == "safe"
        assert len(parsed["prompt"]) < 400

    def test_console_log_formatter_emits_clean_single_line(self):
        from tenderpulse_ai.logging.formatter import ConsoleLogFormatter

        formatter = ConsoleLogFormatter(service_name="fastapi")
        logger = logging.getLogger("test_console")

        with scoped_logging_context(trace_id="trc_test_9999", tenant_id="tenant_acme"):
            record = logger.makeRecord(
                name="test_console",
                level=logging.INFO,
                fn="test.py",
                lno=42,
                msg="Pipeline step completed",
                args=(),
                exc_info=None,
                extra={"duration_ms": 45.2},
            )
            line = formatter.format(record)

            assert "INFO" in line
            assert "[fastapi]" in line
            assert "[trc_test_999]" in line
            assert "Pipeline step completed" in line
            assert "(45.2ms)" in line
            assert "{" not in line  # Not raw JSON!

    def test_rotating_file_handler_rotates_and_enforces_retention(self, tmp_path):
        from logging.handlers import RotatingFileHandler

        log_file = tmp_path / "test_ai.log"
        handler = RotatingFileHandler(str(log_file), maxBytes=200, backupCount=2, encoding="utf-8")
        handler.setFormatter(JSONLogFormatter(service_name="fastapi"))

        test_logger = logging.getLogger("test_rotator")
        test_logger.setLevel(logging.INFO)
        test_logger.addHandler(handler)

        try:
            for i in range(5):
                test_logger.info("Log line #%d with some long content padding %s", i, "y" * 60)
            handler.flush()
            handler.close()

            assert log_file.exists()
            assert (tmp_path / "test_ai.log.1").exists()
        finally:
            test_logger.removeHandler(handler)


def test_aadhaar_redaction_is_checksum_and_context_aware():
    from tenderpulse_ai.security.sanitizer import SecretSanitizer

    queue = "https://sqs.ap-south-1.amazonaws.com/234567890124/tenderai-compq"
    assert SecretSanitizer.scrub(f"Published to {queue}")[0].endswith(queue)
    # Unlabelled 12-digit tender identifier failing the UIDAI checksum stays intact
    assert "Ref 987654321098" in SecretSanitizer.scrub("Ref 987654321098")[0]
    # Checksum-valid Aadhaar is redacted even without a label
    assert "[REDACTED_AADHAAR]" in SecretSanitizer.scrub("ID 2345 6789 0124")[0]
