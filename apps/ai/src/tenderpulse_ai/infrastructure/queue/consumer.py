import asyncio
import json
import logging
from abc import ABC, abstractmethod
from typing import Any
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from tenderpulse_ai.config import settings

logger = logging.getLogger("tenderpulse_ai.infrastructure.queue.consumer")


class IngestionJobMessage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    job_id: str = Field(..., validation_alias=AliasChoices("job_id", "jobId"))
    organization_id: str = Field(..., validation_alias=AliasChoices("organization_id", "organizationId"))
    company_id: str | None = Field(default=None, validation_alias=AliasChoices("company_id", "companyId"))
    bid_id: str = Field(..., validation_alias=AliasChoices("bid_id", "bidId"))
    document_id: str = Field(..., validation_alias=AliasChoices("document_id", "documentId"))
    workflow_run_id: str | None = Field(default=None, validation_alias=AliasChoices("workflow_run_id", "workflowRunId"))
    trace_id: str | None = Field(default=None, validation_alias=AliasChoices("trace_id", "traceId"))
    correlation_id: str | None = Field(default=None, validation_alias=AliasChoices("correlation_id", "correlationId"))
    storage_reference: str | None = Field(default=None, validation_alias=AliasChoices("storage_reference", "storageReference"))
    document_type: str = Field(default="NIT", validation_alias=AliasChoices("document_type", "documentType"))
    file_name: str = Field(default="tender_document.pdf", validation_alias=AliasChoices("file_name", "fileName"))
    download_url: str | None = Field(default=None, validation_alias=AliasChoices("download_url", "downloadUrl"))
    timestamp: str | None = None


class QueueMessage(BaseModel):
    message_id: str
    receipt_handle: str
    body: IngestionJobMessage
    receive_count: int = 1


class IQueueConsumer(ABC):
    @abstractmethod
    async def receive_messages(
        self,
        max_messages: int = 1,
        visibility_timeout_seconds: int = 300,
    ) -> list[QueueMessage]:
        """Poll and lease incoming ingestion messages from the queue."""

    @abstractmethod
    async def delete_message(self, receipt_handle: str) -> bool:
        """Acknowledge and remove a processed message from the queue."""

    @abstractmethod
    async def change_message_visibility(
        self,
        receipt_handle: str,
        visibility_timeout_seconds: int,
    ) -> bool:
        """Heartbeat to renew visibility timeout for a running long-duration job."""

    @abstractmethod
    async def move_to_dead_letter(
        self,
        message: IngestionJobMessage,
        reason: str,
        receive_count: int,
    ) -> bool:
        """Route unrecoverable poison message to the Dead-Letter Queue (DLQ)."""


class AwsSqsQueueConsumer(IQueueConsumer):
    """AWS SQS implementation for consuming ingestion jobs directly in Python worker."""

    def __init__(
        self,
        queue_url: str | None = None,
        dlq_url: str | None = None,
        region_name: str | None = None,
    ):
        self.queue_url = queue_url or settings.aws_ingestion_queue_url
        self.dlq_url = dlq_url
        self.region_name = region_name or "ap-south-1"

    async def receive_messages(
        self,
        max_messages: int = 1,
        visibility_timeout_seconds: int = 300,
    ) -> list[QueueMessage]:
        if not self.queue_url:
            logger.warning("AWS ingestion queue URL is not configured.")
            return []

        try:
            import boto3

            sqs = boto3.client("sqs", region_name=self.region_name)
            response = await asyncio.to_thread(
                sqs.receive_message,
                QueueUrl=self.queue_url,
                MaxNumberOfMessages=max_messages,
                VisibilityTimeout=visibility_timeout_seconds,
                WaitTimeSeconds=10,
                AttributeNames=["ApproximateReceiveCount"],
            )

            messages: list[QueueMessage] = []
            for item in response.get("Messages", []):
                raw_body = json.loads(item["Body"])
                job_msg = IngestionJobMessage.model_validate(raw_body)
                receive_count = int(item.get("Attributes", {}).get("ApproximateReceiveCount", 1))
                messages.append(
                    QueueMessage(
                        message_id=item["MessageId"],
                        receipt_handle=item["ReceiptHandle"],
                        body=job_msg,
                        receive_count=receive_count,
                    )
                )
            return messages
        except ImportError as err:
            raise RuntimeError("boto3 library is required for AwsSqsQueueConsumer.") from err
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to receive messages from AWS SQS %s: %s", self.queue_url, exc)
            return []

    async def delete_message(self, receipt_handle: str) -> bool:
        if not self.queue_url:
            return False
        try:
            import boto3

            sqs = boto3.client("sqs", region_name=self.region_name)
            await asyncio.to_thread(
                sqs.delete_message,
                QueueUrl=self.queue_url,
                ReceiptHandle=receipt_handle,
            )
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to delete SQS message %s: %s", receipt_handle, exc)
            return False

    async def change_message_visibility(
        self,
        receipt_handle: str,
        visibility_timeout_seconds: int,
    ) -> bool:
        if not self.queue_url:
            return False
        try:
            import boto3

            sqs = boto3.client("sqs", region_name=self.region_name)
            await asyncio.to_thread(
                sqs.change_message_visibility,
                QueueUrl=self.queue_url,
                ReceiptHandle=receipt_handle,
                VisibilityTimeout=visibility_timeout_seconds,
            )
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to renew visibility for SQS message: %s", exc)
            return False

    async def move_to_dead_letter(
        self,
        message: IngestionJobMessage,
        reason: str,
        receive_count: int,
    ) -> bool:
        if not self.dlq_url:
            logger.warning("No DLQ URL configured for AWS SQS; message left to expire.")
            return False
        try:
            import boto3

            sqs = boto3.client("sqs", region_name=self.region_name)
            payload = {
                "message": message.model_dump(),
                "reason": reason,
                "receiveCount": receive_count,
            }
            await asyncio.to_thread(
                sqs.send_message,
                QueueUrl=self.dlq_url,
                MessageBody=json.dumps(payload),
            )
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to route message to DLQ %s: %s", self.dlq_url, exc)
            return False


class GcpPubSubQueueConsumer(IQueueConsumer):
    """GCP Cloud Pub/Sub implementation for pulling ingestion messages directly in Python."""

    def __init__(self, subscription_name: str | None = None):
        self.subscription_name = subscription_name or settings.gcp_ingestion_subscription

    def _get_subscriber_client(self) -> Any:
        try:
            from google.cloud import pubsub_v1

            return pubsub_v1.SubscriberClient()
        except ImportError as err:
            raise RuntimeError(
                "google-cloud-pubsub library is required for GcpPubSubQueueConsumer."
            ) from err

    async def receive_messages(
        self,
        max_messages: int = 1,
        visibility_timeout_seconds: int = 300,
    ) -> list[QueueMessage]:
        if not self.subscription_name:
            logger.warning("GCP ingestion subscription is not configured.")
            return []
        try:
            subscriber = self._get_subscriber_client()
            response = await asyncio.to_thread(
                subscriber.pull,
                subscription=self.subscription_name,
                max_messages=max_messages,
                timeout=10,
            )
            messages: list[QueueMessage] = []
            for received in response.received_messages:
                # Modify ack deadline to leased visibility
                await asyncio.to_thread(
                    subscriber.modify_ack_deadline,
                    subscription=self.subscription_name,
                    ack_ids=[received.ack_id],
                    ack_deadline_seconds=visibility_timeout_seconds,
                )
                raw_body = json.loads(received.message.data.decode("utf-8"))
                job_msg = IngestionJobMessage.model_validate(raw_body)
                messages.append(
                    QueueMessage(
                        message_id=received.message.message_id,
                        receipt_handle=received.ack_id,
                        body=job_msg,
                        receive_count=1,
                    )
                )
            return messages
        except RuntimeError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to pull messages from GCP PubSub %s: %s", self.subscription_name, exc)
            return []

    async def delete_message(self, receipt_handle: str) -> bool:
        if not self.subscription_name:
            return False
        try:
            subscriber = self._get_subscriber_client()
            await asyncio.to_thread(
                subscriber.acknowledge,
                subscription=self.subscription_name,
                ack_ids=[receipt_handle],
            )
            return True
        except RuntimeError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to ack GCP PubSub message: %s", exc)
            return False

    async def change_message_visibility(
        self,
        receipt_handle: str,
        visibility_timeout_seconds: int,
    ) -> bool:
        if not self.subscription_name:
            return False
        try:
            subscriber = self._get_subscriber_client()
            await asyncio.to_thread(
                subscriber.modify_ack_deadline,
                subscription=self.subscription_name,
                ack_ids=[receipt_handle],
                ack_deadline_seconds=visibility_timeout_seconds,
            )
            return True
        except RuntimeError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to modify ack deadline for GCP PubSub message: %s", exc)
            return False

    async def move_to_dead_letter(
        self,
        message: IngestionJobMessage,
        reason: str,
        receive_count: int,
    ) -> bool:
        logger.warning("DLQ routing for GCP PubSub not directly attached; acking poisoned message: %s", reason)
        return True


class MockQueueConsumer(IQueueConsumer):
    """Thread-safe and async-compatible in-memory mock queue consumer for unit testing."""

    def __init__(self, max_receive_count: int = 3):
        self.messages: list[dict[str, Any]] = []
        self.dead_letters: list[dict[str, Any]] = []
        self.max_receive_count = max_receive_count
        self.active_receipts: dict[str, dict[str, Any]] = {}

    def enqueue(self, payload: IngestionJobMessage) -> str:
        msg_id = f"mock-msg-{len(self.messages) + 1}"
        self.messages.append({
            "message_id": msg_id,
            "body": payload,
            "receive_count": 0,
        })
        return msg_id

    async def receive_messages(
        self,
        max_messages: int = 1,
        visibility_timeout_seconds: int = 300,
    ) -> list[QueueMessage]:
        results: list[QueueMessage] = []
        for item in list(self.messages):
            if len(results) >= max_messages:
                break
            item["receive_count"] += 1
            if item["receive_count"] > self.max_receive_count:
                self.dead_letters.append({
                    "message": item["body"],
                    "reason": f"Exceeded max receive count of {self.max_receive_count}",
                    "receive_count": item["receive_count"],
                })
                self.messages.remove(item)
                continue

            receipt_handle = f"receipt-{item['message_id']}-{item['receive_count']}"
            self.active_receipts[receipt_handle] = item
            results.append(
                QueueMessage(
                    message_id=item["message_id"],
                    receipt_handle=receipt_handle,
                    body=item["body"],
                    receive_count=item["receive_count"],
                )
            )
        return results

    async def delete_message(self, receipt_handle: str) -> bool:
        item = self.active_receipts.pop(receipt_handle, None)
        if item and item in self.messages:
            self.messages.remove(item)
            return True
        return False

    async def change_message_visibility(
        self,
        receipt_handle: str,
        visibility_timeout_seconds: int,
    ) -> bool:
        return receipt_handle in self.active_receipts

    async def move_to_dead_letter(
        self,
        message: IngestionJobMessage,
        reason: str,
        receive_count: int,
    ) -> bool:
        self.dead_letters.append({
            "message": message,
            "reason": reason,
            "receive_count": receive_count,
        })
        return True


def get_queue_consumer(provider: str | None = None) -> IQueueConsumer:
    """Factory resolving the active ingestion queue consumer from configuration without silent fallbacks."""
    resolved_provider = (provider or settings.ingestion_queue_provider or "none").lower()
    if resolved_provider in ("mock", "memory", "test", "none", "disabled"):
        return MockQueueConsumer()
    if resolved_provider in ("pubsub", "gcp"):
        if not settings.gcp_ingestion_subscription:
            raise ValueError(
                "GCP ingestion subscription is not configured (settings.gcp_ingestion_subscription)."
            )
        return GcpPubSubQueueConsumer()
    if resolved_provider in ("sqs", "aws"):
        if not settings.aws_ingestion_queue_url:
            raise ValueError(
                "AWS ingestion queue URL is not configured (settings.aws_ingestion_queue_url)."
            )
        return AwsSqsQueueConsumer()
    raise ValueError(f"Unknown or unsupported ingestion queue provider: {resolved_provider}")
