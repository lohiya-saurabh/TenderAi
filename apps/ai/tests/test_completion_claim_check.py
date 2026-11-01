"""Completion events for long tenders exceed SQS's 1 MiB limit: store them in S3 instead."""

import json

from tenderpulse_ai.infrastructure.queue.publisher import (
    AwsSqsCompletionPublisher,
    DocumentExtractionCompletedEvent,
    claim_check_key,
)


class FakeS3:
    def __init__(self):
        self.objects: dict[str, bytes] = {}

    def put_object(self, Bucket, Key, Body, ContentType):  # noqa: N803 (boto3 casing)
        self.objects[f"{Bucket}/{Key}"] = Body


def _event(chunk_count: int) -> DocumentExtractionCompletedEvent:
    return DocumentExtractionCompletedEvent(
        job_id="job-1",
        organization_id="org_a",
        bid_id="bid_1",
        document_id="doc_1",
        items=[{"title": "EMD"}],
        chunks=[{"chunkId": f"c{i}", "text": "x" * 1000} for i in range(chunk_count)],
    )


def test_small_events_go_inline():
    s3 = FakeS3()
    publisher = AwsSqsCompletionPublisher(queue_url="q", bucket="bucket")
    body = json.loads(publisher.build_message_body(_event(3), s3))

    assert s3.objects == {}
    assert body["items"] == [{"title": "EMD"}]
    assert "payloadStorageReference" not in body


def test_large_events_are_stored_under_the_tenant_prefix_and_sent_as_a_pointer():
    s3 = FakeS3()
    publisher = AwsSqsCompletionPublisher(queue_url="q", bucket="bucket")
    event = _event(400)  # ~400 KB of chunks, over the 200 KB threshold

    body_text = publisher.build_message_body(event, s3)
    body = json.loads(body_text)

    key = claim_check_key(event)
    assert key.startswith("tenants/org_a/")
    assert body["payloadStorageReference"] == key
    assert body["itemsCount"] == 1
    assert "items" not in body and "chunks" not in body
    assert len(body_text) < 2_000
    stored = json.loads(s3.objects[f"bucket/{key}"])
    assert len(stored["chunks"]) == 400
    assert {k: stored[k] for k in ("jobId", "organizationId", "bidId", "documentId")} == {
        k: body[k] for k in ("jobId", "organizationId", "bidId", "documentId")
    }
