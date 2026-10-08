from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from tenderpulse_ai.infrastructure.queue import (
    DocumentExtractionCompletedEvent,
    HttpCallbackCompletionPublisher,
    MockCompletionPublisher,
)
from tenderpulse_ai.main import app


def test_completion_event_camel_case_serialization():
    event = DocumentExtractionCompletedEvent(
        job_id="job-123",
        organization_id="org-tata",
        company_id="comp-tata-01",
        bid_id="bid-456",
        document_id="doc-789",
        status="COMPLETED",
        items=[{"title": "EMD", "category": "FINANCIAL"}],
        workflow_run_id="run-1",
        correlation_id="corr-1",
    )

    data = event.to_camel_case_dict()
    assert data["jobId"] == "job-123"
    assert data["organizationId"] == "org-tata"
    assert data["companyId"] == "comp-tata-01"
    assert data["bidId"] == "bid-456"
    assert data["documentId"] == "doc-789"
    assert data["status"] == "COMPLETED"
    assert len(data["items"]) == 1
    assert data["workflowRunId"] == "run-1"
    assert data["correlationId"] == "corr-1"


@pytest.mark.asyncio
async def test_mock_completion_publisher():
    publisher = MockCompletionPublisher()
    event = DocumentExtractionCompletedEvent(
        job_id="job-abc",
        organization_id="org-1",
        bid_id="bid-1",
        document_id="doc-1",
        status="COMPLETED",
    )
    success = await publisher.publish_completion(event)
    assert success is True
    assert len(publisher.published_events) == 1
    assert publisher.published_events[0].job_id == "job-abc"


@pytest.mark.asyncio
async def test_http_callback_completion_publisher():
    publisher = HttpCallbackCompletionPublisher(
        base_url="http://mock-api.internal",
        webhook_path="/api/v1/internal/extraction-completed",
        internal_service_key="secret-key-123",
    )
    event = DocumentExtractionCompletedEvent(
        job_id="job-xyz",
        organization_id="org-1",
        bid_id="bid-1",
        document_id="doc-1",
        status="COMPLETED",
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        success = await publisher.publish_completion(event)
        assert success is True
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "http://mock-api.internal/api/v1/internal/extraction-completed"
        assert kwargs["headers"]["X-Internal-Service-Key"] == "secret-key-123"
        assert kwargs["json"]["jobId"] == "job-xyz"


def test_api_worker_process_message_async_mode():
    client = TestClient(app)
    headers = {"X-Internal-Service-Key": "tenderpulse-internal-secret-2026"}

    payload = {
        "job_id": "job-async-test-01",
        "organization_id": "org_worker_async",
        "company_id": "comp_worker_async",
        "bid_id": "bid_async_1",
        "document_id": "doc_async_1",
        "workflow_run_id": "run_async_01",
        "correlation_id": "corr_async_01",
        "async_mode": True,
        "pages": [
            {
                "page_number": 1,
                "text": "The bidder must submit an Earnest Money Deposit (EMD) of INR 10,00,000 on Rs 100 stamp paper.",
            }
        ],
    }

    mock_pub = MockCompletionPublisher()
    with patch("tenderpulse_ai.main.get_completion_publisher", return_value=mock_pub):
        response = client.post("/api/v1/worker/process-message", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["processed"] is True
        assert data["status"] == "ACCEPTED"
        assert data["job_id"] == "job-async-test-01"
        assert data["items"] == []
