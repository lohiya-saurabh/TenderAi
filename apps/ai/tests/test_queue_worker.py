import pytest
from tenderpulse_ai.infrastructure.queue.consumer import (
    IngestionJobMessage,
    MockQueueConsumer,
    QueueMessage,
    get_queue_consumer,
)
from tenderpulse_ai.infrastructure.queue.publisher import (
    MockCompletionPublisher,
    get_completion_publisher,
)
from tenderpulse_ai.infrastructure.queue.worker import DocumentQueueConsumerWorker


@pytest.mark.asyncio
async def test_queue_worker_processes_and_publishes_to_completion_queue():
    consumer = MockQueueConsumer()
    publisher = MockCompletionPublisher()

    job_msg = IngestionJobMessage(
        job_id="job-test-101",
        organization_id="org_test_1",
        company_id="comp_test_1",
        bid_id="bid_test_1",
        document_id="doc_test_1",
        workflow_run_id="run_test_1",
        storage_reference="tenants/org_test_1/bids/bid_test_1/doc_test_1/NIT.pdf",
        document_type="NIT",
        file_name="NIT.pdf",
    )

    consumer.enqueue(job_msg)
    assert len(consumer.messages) == 1

    worker = DocumentQueueConsumerWorker(
        consumer=consumer,
        publisher=publisher,
        poll_interval_seconds=0.01,
        visibility_timeout_seconds=60,
        heartbeat_interval_seconds=10,
    )

    messages = await consumer.receive_messages(max_messages=1)
    assert len(messages) == 1

    success = await worker.process_single_message(messages[0])
    assert success is True

    # 1. Completion message published to completion queue
    assert len(publisher.published_events) == 1
    event = publisher.published_events[0]
    assert event.status == "COMPLETED"
    assert event.document_id == "doc_test_1"
    assert event.job_id == "job-test-101"
    assert len(event.items) > 0

    # 2. Ingestion message deleted from ingestion queue
    assert len(consumer.messages) == 0


@pytest.mark.asyncio
async def test_queue_worker_routes_to_dlq_on_terminal_failure():
    consumer = MockQueueConsumer()
    publisher = MockCompletionPublisher()

    job_msg = IngestionJobMessage(
        job_id="job-fail-202",
        organization_id="org_test_2",
        bid_id="bid_test_2",
        document_id="doc_test_2",
    )

    class FailingPipeline:
        async def execute(self, _request):
            raise ValueError("Corrupt PDF unrecoverable error")

    worker = DocumentQueueConsumerWorker(
        consumer=consumer,
        publisher=publisher,
        pipeline=FailingPipeline(),  # type: ignore[arg-type]
    )

    queue_message = QueueMessage(
        message_id="msg-fail",
        receipt_handle="receipt-fail",
        body=job_msg,
        receive_count=3,  # Terminal attempt
    )

    success = await worker.process_single_message(queue_message)
    assert success is False

    # 1. Moved to DLQ
    assert len(consumer.dead_letters) == 1
    assert consumer.dead_letters[0]["receive_count"] == 3

    # 2. FAILED completion event published to completion queue
    assert len(publisher.published_events) == 1
    fail_event = publisher.published_events[0]
    assert fail_event.status == "FAILED"
    assert "Corrupt PDF" in (fail_event.error or "")


def test_queue_consumer_factory():
    mock_consumer = get_queue_consumer("mock")
    assert isinstance(mock_consumer, MockQueueConsumer)

    mock_publisher = get_completion_publisher("mock")
    assert isinstance(mock_publisher, MockCompletionPublisher)


@pytest.mark.asyncio
async def test_gcp_pubsub_queue_consumer_client_and_methods(monkeypatch):
    from unittest.mock import MagicMock
    from tenderpulse_ai.infrastructure.queue.consumer import GcpPubSubQueueConsumer

    mock_subscriber = MagicMock()
    mock_subscriber.pull.return_value = MagicMock(received_messages=[])
    mock_subscriber.acknowledge.return_value = None
    mock_subscriber.modify_ack_deadline.return_value = None

    consumer = GcpPubSubQueueConsumer(
        subscription_name="projects/test-project/subscriptions/test-sub"
    )

    monkeypatch.setattr(consumer, "_get_subscriber_client", lambda: mock_subscriber)

    # Test receive_messages
    msgs = await consumer.receive_messages(max_messages=1, visibility_timeout_seconds=30)
    assert msgs == []

    # Test change_message_visibility
    visibility_ok = await consumer.change_message_visibility("receipt-123", 45)
    assert visibility_ok is True
    mock_subscriber.modify_ack_deadline.assert_called_once_with(
        subscription="projects/test-project/subscriptions/test-sub",
        ack_ids=["receipt-123"],
        ack_deadline_seconds=45,
    )

    # Test delete_message
    delete_ok = await consumer.delete_message("receipt-123")
    assert delete_ok is True
    mock_subscriber.acknowledge.assert_called_once_with(
        subscription="projects/test-project/subscriptions/test-sub",
        ack_ids=["receipt-123"],
    )

