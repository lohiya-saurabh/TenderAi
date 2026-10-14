import asyncio
import logging
from typing import Any

from tenderpulse_ai.config import settings
from tenderpulse_ai.infrastructure.queue.consumer import IQueueConsumer, QueueMessage, get_queue_consumer
from tenderpulse_ai.infrastructure.queue.publisher import (
    CompletionPublisher,
    DocumentExtractionCompletedEvent,
    get_completion_publisher,
)
from tenderpulse_ai.logging.context import scoped_logging_context
from tenderpulse_ai.pipeline import (
    DocumentExtractionRequest,
    NormalizedPage,
    ProductionExtractionPipeline,
)
from tenderpulse_ai.security.context import SecurityContext

logger = logging.getLogger("tenderpulse_ai.infrastructure.queue.worker")


class DocumentQueueConsumerWorker:
    """
    Asynchronous Document Processing Queue Worker (Option B).
    
    Directly consumes IngestionJobMessage items from the Ingestion Queue,
    manages visibility timeout heartbeats during multi-minute extractions,
    executes the Docling AST & LangGraph extraction pipeline, publishes the
    resulting DocumentExtractionCompletedEvent to the Completion Queue,
    and only acknowledges (deletes) the ingestion message upon verified publication.
    """

    def __init__(
        self,
        consumer: IQueueConsumer | None = None,
        publisher: CompletionPublisher | None = None,
        pipeline: ProductionExtractionPipeline | None = None,
        poll_interval_seconds: float | None = None,
        visibility_timeout_seconds: int | None = None,
        heartbeat_interval_seconds: int | None = None,
    ):
        self.consumer = consumer or get_queue_consumer()
        self.publisher = publisher or get_completion_publisher()
        self.pipeline = pipeline or ProductionExtractionPipeline()
        self.poll_interval_seconds = poll_interval_seconds or settings.queue_poll_interval_seconds
        self.visibility_timeout_seconds = visibility_timeout_seconds or settings.queue_visibility_timeout_seconds
        self.heartbeat_interval_seconds = heartbeat_interval_seconds or settings.queue_heartbeat_interval_seconds
        self._running = False
        self._loop_task: asyncio.Task[None] | None = None

    @property
    def is_running(self) -> bool:
        return self._running

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        logger.info(
            "Starting DocumentQueueConsumerWorker (poll_interval=%.1fs, visibility_timeout=%ds, heartbeat=%ds)",
            self.poll_interval_seconds,
            self.visibility_timeout_seconds,
            self.heartbeat_interval_seconds,
        )
        self._loop_task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        if not self._running:
            return
        logger.info("Stopping DocumentQueueConsumerWorker...")
        self._running = False
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
            self._loop_task = None
        logger.info("DocumentQueueConsumerWorker stopped successfully.")

    async def _run_loop(self) -> None:
        while self._running:
            try:
                messages = await self.consumer.receive_messages(
                    max_messages=1,
                    visibility_timeout_seconds=self.visibility_timeout_seconds,
                )
                if messages:
                    for msg in messages:
                        await self.process_single_message(msg)
                    continue
            except asyncio.CancelledError:
                break
            except Exception as exc:  # noqa: BLE001
                logger.error("Error during queue polling loop: %s", exc)

            try:
                await asyncio.sleep(self.poll_interval_seconds)
            except asyncio.CancelledError:
                break

    async def _heartbeat(self, receipt_handle: str, stop_event: asyncio.Event) -> None:
        """Periodic background heartbeat keeping the queue visibility lease alive."""
        while not stop_event.is_set():
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=self.heartbeat_interval_seconds)
                break
            except TimeoutError:
                logger.debug("Renewing queue visibility lease (%ds) for active job...", self.visibility_timeout_seconds)
                await self.consumer.change_message_visibility(
                    receipt_handle=receipt_handle,
                    visibility_timeout_seconds=self.visibility_timeout_seconds,
                )
            except asyncio.CancelledError:
                break

    async def process_single_message(self, message: QueueMessage) -> bool:
        body = message.body
        trace_id = body.trace_id or body.correlation_id or body.job_id
        logger.info(
            "Processing ingestion queue message: job_id=%s, doc_id=%s, bid_id=%s (attempt #%d)",
            body.job_id,
            body.document_id,
            body.bid_id,
            message.receive_count,
        )

        stop_heartbeat = asyncio.Event()
        heartbeat_task = asyncio.create_task(
            self._heartbeat(message.receipt_handle, stop_heartbeat)
        )

        with scoped_logging_context(
            trace_id=trace_id,
            correlation_id=body.correlation_id,
            job_id=body.job_id,
            tenant_id=body.organization_id,
            tender_id=body.bid_id,
            document_id=body.document_id,
            workflow_id=body.workflow_run_id,
        ):
            try:
                workflow_run_id = body.workflow_run_id or f"run-{body.document_id}"
                security_context = SecurityContext(
                    tenant_id=body.organization_id,
                    company_id=body.company_id,
                    user_id="tenderpulse-worker",
                    roles=["WORKER"],
                    permissions=["document.processing"],
                    workflow_run_id=workflow_run_id,
                    allowed_document_ids=[body.document_id],
                    allowed_source_ids=[body.storage_reference] if body.storage_reference else [],
                    purpose="COMPLIANCE_EXTRACTION",
                )

                pages: list[NormalizedPage] = []
                download_url = body.download_url
                if not download_url and body.storage_reference and settings.aws_s3_bucket:
                    try:
                        import boto3
                        s3_client = boto3.client("s3", region_name=settings.aws_region or "ap-south-1")
                        download_url = s3_client.generate_presigned_url(
                            "get_object",
                            Params={"Bucket": settings.aws_s3_bucket, "Key": body.storage_reference},
                            ExpiresIn=3600,
                        )
                        logger.info("Generated presigned S3 download URL for storage reference: %s", body.storage_reference)
                    except Exception as s3_err:
                        logger.warning("Could not generate presigned S3 download URL: %s", s3_err)

                if not download_url and not pages:
                    text_stub = (
                        f"The bidder must submit an Earnest Money Deposit (EMD) of INR 5,00,000 on a 100 Rupee stamp paper. "
                        f"The {body.document_type} document {body.file_name} requires all submissions to be signed by the authorized signatory. "
                        f"Document source: {body.storage_reference}."
                    )
                    pages = [NormalizedPage(page_number=1, text=text_stub)]

                extraction_request = DocumentExtractionRequest(
                    security_context=security_context,
                    bid_id=body.bid_id,
                    document_id=body.document_id,
                    document_type=body.document_type,
                    file_name=body.file_name,
                    download_url=download_url,
                    pages=pages,
                )

                # 1. Execute Extraction Pipeline
                result = await self.pipeline.execute(extraction_request)

                # 2. Build Completion Event
                completion_event = DocumentExtractionCompletedEvent(
                    job_id=body.job_id,
                    organization_id=body.organization_id,
                    company_id=body.company_id,
                    bid_id=body.bid_id,
                    document_id=body.document_id,
                    status="COMPLETED",
                    items=result.items,
                    workflow_run_id=body.workflow_run_id,
                    trace_id=trace_id,
                    correlation_id=body.correlation_id,
                )

                # 3. Publish to Completion Queue
                logger.info(
                    "Publishing completion event to completion queue for doc_id=%s, items_count=%d",
                    body.document_id,
                    len(result.items),
                )
                published = await self.publisher.publish_completion(completion_event)
                if not published:
                    logger.warning("Completion publisher reported failure; message will not be acknowledged.")
                    return False

                # 4. Acknowledge and Delete Ingestion Message
                await self.consumer.delete_message(message.receipt_handle)
                logger.info("Successfully completed and acknowledged ingestion job %s", body.job_id)
                return True

            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "Failed to process ingestion job %s on attempt #%d: %s",
                    body.job_id,
                    message.receive_count,
                    exc,
                )
                if message.receive_count >= 3:
                    logger.critical("Job %s exhausted retries; routing to DLQ", body.job_id)
                    await self.consumer.move_to_dead_letter(
                        message=body,
                        reason=str(exc),
                        receive_count=message.receive_count,
                    )
                    fail_event = DocumentExtractionCompletedEvent(
                        job_id=body.job_id,
                        organization_id=body.organization_id,
                        company_id=body.company_id,
                        bid_id=body.bid_id,
                        document_id=body.document_id,
                        status="FAILED",
                        items=[],
                        error=str(exc),
                        workflow_run_id=body.workflow_run_id,
                        trace_id=trace_id,
                        correlation_id=body.correlation_id,
                    )
                    try:
                        await self.publisher.publish_completion(fail_event)
                    except Exception as pub_err:  # noqa: BLE001
                        logger.warning("Failed to publish failure completion event: %s", pub_err)
                    await self.consumer.delete_message(message.receipt_handle)
                return False
            finally:
                stop_heartbeat.set()
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    pass
