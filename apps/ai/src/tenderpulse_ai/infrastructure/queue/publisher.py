import asyncio
import json
import logging
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any

import httpx
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from tenderpulse_ai.config import settings

logger = logging.getLogger("tenderpulse_ai.infrastructure.queue.publisher")


class DocumentExtractionCompletedEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    job_id: str = Field(..., validation_alias=AliasChoices("job_id", "jobId"))
    organization_id: str = Field(
        ..., validation_alias=AliasChoices("organization_id", "organizationId")
    )
    company_id: str | None = Field(
        default=None, validation_alias=AliasChoices("company_id", "companyId")
    )
    bid_id: str = Field(..., validation_alias=AliasChoices("bid_id", "bidId"))
    document_id: str = Field(..., validation_alias=AliasChoices("document_id", "documentId"))
    status: str = "COMPLETED"
    items: list[dict[str, Any]] = Field(default_factory=list)
    chunks: list[dict[str, Any]] = Field(default_factory=list)
    conflicts: list[dict[str, Any]] = Field(default_factory=list)
    coverage: dict[str, Any] | None = None
    error: str | None = None
    workflow_run_id: str | None = Field(
        default=None, validation_alias=AliasChoices("workflow_run_id", "workflowRunId")
    )
    trace_id: str | None = Field(default=None, validation_alias=AliasChoices("trace_id", "traceId"))
    correlation_id: str | None = Field(
        default=None, validation_alias=AliasChoices("correlation_id", "correlationId")
    )
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_camel_case_dict(self) -> dict[str, Any]:
        """Serialize to camelCase dictionary expected by NestJS API."""
        return {
            "jobId": self.job_id,
            "organizationId": self.organization_id,
            "companyId": self.company_id,
            "bidId": self.bid_id,
            "documentId": self.document_id,
            "status": self.status,
            "items": self.items,
            "chunks": self.chunks,
            "conflicts": self.conflicts,
            "coverage": self.coverage,
            "error": self.error,
            "workflowRunId": self.workflow_run_id,
            "traceId": self.trace_id,
            "correlationId": self.correlation_id,
            "timestamp": self.timestamp,
        }


class CompletionPublisher(ABC):
    @abstractmethod
    async def publish_completion(self, event: DocumentExtractionCompletedEvent) -> bool:
        """Publish extraction completion event to downstream consumer."""


class HttpCallbackCompletionPublisher(CompletionPublisher):
    """
    Webhook callback publisher: sends HTTP POST to NestJS internal webhook
    (POST /api/v1/internal/extraction-completed) authenticated with X-Internal-Service-Key.
    """

    def __init__(
        self,
        base_url: str | None = None,
        webhook_path: str | None = None,
        internal_service_key: str | None = None,
        timeout_seconds: float = 30.0,
    ):
        self.base_url = (base_url or settings.api_gateway_url).rstrip("/")
        self.webhook_path = webhook_path or settings.completion_webhook_path
        self.internal_service_key = internal_service_key or settings.internal_service_key
        self.timeout_seconds = timeout_seconds

    @property
    def endpoint_url(self) -> str:
        path = self.webhook_path if self.webhook_path.startswith("/") else f"/{self.webhook_path}"
        return f"{self.base_url}{path}"

    async def publish_completion(self, event: DocumentExtractionCompletedEvent) -> bool:
        payload = event.to_camel_case_dict()
        headers = {
            "Content-Type": "application/json",
            "X-Internal-Service-Key": self.internal_service_key,
        }
        if event.trace_id:
            headers["X-Trace-Id"] = event.trace_id
        if event.correlation_id:
            headers["X-Correlation-Id"] = event.correlation_id
        logger.info(
            "Publishing completion event to webhook %s for doc_id=%s, job_id=%s",
            self.endpoint_url,
            event.document_id,
            event.job_id,
        )
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(self.endpoint_url, json=payload, headers=headers)
                if response.status_code in (200, 201, 202, 204):
                    logger.info("Successfully delivered completion event to %s", self.endpoint_url)
                    return True
                logger.warning(
                    "Webhook callback %s responded with status %d: %s",
                    self.endpoint_url,
                    response.status_code,
                    response.text[:200],
                )
                return False
        except httpx.RequestError as exc:
            logger.warning(
                "Could not reach completion webhook %s: %s (safe in offline test environments)",
                self.endpoint_url,
                exc,
            )
            return False


class GcpPubSubCompletionPublisher(CompletionPublisher):
    """GCP Cloud Pub/Sub completion publisher for cloud-native event choreography."""

    def __init__(self, topic_name: str | None = None):
        self.topic_name = topic_name or settings.gcp_completion_topic

    async def publish_completion(self, event: DocumentExtractionCompletedEvent) -> bool:
        if not self.topic_name:
            logger.warning("GCP completion topic is not configured; skipping Pub/Sub publish.")
            return False
        try:
            from google.cloud import pubsub_v1

            publisher = pubsub_v1.PublisherClient()
            data = json.dumps(event.to_camel_case_dict()).encode("utf-8")
            future = publisher.publish(self.topic_name, data)
            future.result(timeout=10)
            logger.info("Published completion event to Pub/Sub topic %s", self.topic_name)
            return True
        except ImportError as err:
            raise RuntimeError(
                "google-cloud-pubsub library is required for GcpPubSubCompletionPublisher."
            ) from err
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to publish to GCP Pub/Sub topic %s: %s", self.topic_name, exc)
            return False


# SQS rejects messages over 1 MiB. Events for long tenders carry every page's chunks and
# can be several MB, so above this size the full event goes to object storage and the
# queue message carries only a pointer to it (claim-check pattern).
CLAIM_CHECK_THRESHOLD_BYTES = 200_000

# Envelope fields kept on the queue message when the payload is claim-checked.
_ENVELOPE_KEYS = (
    "jobId",
    "organizationId",
    "companyId",
    "bidId",
    "documentId",
    "status",
    "error",
    "workflowRunId",
    "traceId",
    "correlationId",
    "timestamp",
)


def claim_check_key(event: DocumentExtractionCompletedEvent) -> str:
    """Object key under the tenant's own prefix; the API refuses anything outside it."""
    return (
        f"tenants/{event.organization_id}/bids/{event.bid_id}/{event.document_id}"
        f"/completion-events/{event.job_id}.json"
    )


class AwsSqsCompletionPublisher(CompletionPublisher):
    """AWS SQS completion publisher for AWS deployments."""

    def __init__(
        self,
        queue_url: str | None = None,
        region_name: str | None = None,
        bucket: str | None = None,
        claim_check_threshold_bytes: int = CLAIM_CHECK_THRESHOLD_BYTES,
    ):
        self.queue_url = queue_url or settings.aws_completion_queue_url
        self.region_name = region_name or settings.aws_region or "ap-south-1"
        self.bucket = bucket or settings.aws_s3_bucket
        self.claim_check_threshold_bytes = claim_check_threshold_bytes

    def build_message_body(self, event: DocumentExtractionCompletedEvent, s3: Any) -> str:
        """Returns the SQS body, storing the full event in S3 first when it is too large."""
        payload = event.to_camel_case_dict()
        body = json.dumps(payload)
        size = len(body.encode("utf-8"))
        if size <= self.claim_check_threshold_bytes:
            return body
        key = claim_check_key(event)
        s3.put_object(
            Bucket=self.bucket, Key=key, Body=body.encode("utf-8"), ContentType="application/json"
        )
        logger.info(
            "Completion event for doc_id=%s is %d bytes; stored at s3://%s/%s (claim check).",
            event.document_id,
            size,
            self.bucket,
            key,
        )
        envelope = {k: payload.get(k) for k in _ENVELOPE_KEYS}
        envelope.update(
            {
                "payloadStorageReference": key,
                "payloadSizeBytes": size,
                "itemsCount": len(event.items),
            }
        )
        return json.dumps(envelope)

    async def publish_completion(self, event: DocumentExtractionCompletedEvent) -> bool:
        if not self.queue_url:
            raise ValueError(
                "AWS completion queue URL is not configured (settings.aws_completion_queue_url)."
            )
        try:
            import boto3  # type: ignore

            sqs = boto3.client("sqs", region_name=self.region_name)
            s3 = boto3.client("s3", region_name=self.region_name)
            body = await asyncio.to_thread(self.build_message_body, event, s3)
            await asyncio.to_thread(sqs.send_message, QueueUrl=self.queue_url, MessageBody=body)
            logger.info("Published completion event to SQS queue %s", self.queue_url)
            return True
        except ImportError as err:
            raise RuntimeError("boto3 library is required for AwsSqsCompletionPublisher.") from err
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to publish to AWS SQS queue %s: %s", self.queue_url, exc)
            return False


class MockCompletionPublisher(CompletionPublisher):
    """In-memory mock publisher for unit and regression testing."""

    def __init__(self):
        self.published_events: list[DocumentExtractionCompletedEvent] = []

    async def publish_completion(self, event: DocumentExtractionCompletedEvent) -> bool:
        self.published_events.append(event)
        return True


def get_completion_publisher(provider: str | None = None) -> CompletionPublisher:
    """Factory resolving the active completion publisher from configuration without silent fallbacks."""
    resolved_provider = (provider or settings.completion_queue_provider or "mock").lower()
    if resolved_provider in ("mock", "memory", "test"):
        return MockCompletionPublisher()
    if resolved_provider in ("pubsub", "gcp"):
        if not settings.gcp_completion_topic:
            raise ValueError(
                "GCP completion topic is not configured (settings.gcp_completion_topic)."
            )
        return GcpPubSubCompletionPublisher()
    if resolved_provider in ("sqs", "aws"):
        if not settings.aws_completion_queue_url:
            raise ValueError(
                "AWS completion queue URL is not configured (settings.aws_completion_queue_url)."
            )
        return AwsSqsCompletionPublisher()
    if resolved_provider == "http":
        return HttpCallbackCompletionPublisher()
    raise ValueError(f"Unsupported completion queue provider: {resolved_provider}")
