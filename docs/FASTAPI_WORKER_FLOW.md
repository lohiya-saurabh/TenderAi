# FastAPI Worker Flow — Runtime Verification

## Implementation update

The queue is now consumed by NestJS `DocumentProcessingRuntime`, not FastAPI. NestJS performs the storage checks/retrieval and PDF normalization, calls FastAPI `POST /api/v1/extract`, persists results transactionally in PostgreSQL, then acknowledges the queue delivery. FastAPI still runs LangGraph only as an HTTP extraction service; this file's queue-consumption verdict remains **no** for FastAPI.

## Verdict

FastAPI currently exposes HTTP endpoints that can run document extraction, but it does **not** consume the configured message queue. No queue client, subscription/poll loop, startup consumer task, or queue-to-handler dispatch is wired in the FastAPI application.

The actual runtime chain is:

```text
Queue
  -/-> FastAPI queue consumer (not implemented/wired)

HTTP caller
  → POST /api/v1/worker/process-message
  → process_queue_message()
  → StorageDocumentResolver only when pages are omitted
  → ProductionExtractionPipeline.execute()
  → LangGraph graph.ainvoke() for each supplied/resolved page
  → HTTP response containing extracted items
```

This distinction matters: calling `/api/v1/worker/process-message` with a JSON body shaped like a queue message does not make FastAPI a queue consumer.

## Answers

### 1. Where does the FastAPI worker start?

The AI service starts as a Uvicorn-hosted FastAPI application. `apps/ai/Dockerfile` runs:

```text
uvicorn tenderpulse_ai.main:app --host 0.0.0.0 --port 8000
```

`apps/ai/src/tenderpulse_ai/main.py` constructs the `FastAPI` app. This starts an HTTP server; no queue-consumer startup/lifespan handler is present.

### 2. Where does it connect to the queue?

It does not. The FastAPI app has no SQS or Pub/Sub client, queue credentials/configuration, subscription name, polling loop, or receive call. The AI service dependencies in `apps/ai/requirements.txt` do not include queue SDKs. Queue adapters exist in the NestJS API, not in the FastAPI service.

### 3. How does it receive a message?

It does not receive a queue message. The only worker-shaped entrypoint found is the HTTP route `POST /api/v1/worker/process-message`, which receives a `QueueProcessingRequest` from an HTTP caller. FastAPI does not pull or stream queue messages into this route.

### 4. Which handler receives it?

For an HTTP request, the handler is `process_queue_message(request)` in `apps/ai/src/tenderpulse_ai/main.py`. It requires the `X-Internal-Service-Key` dependency and validates the request body using `QueueProcessingRequest`.

There is no queue message handler because there is no FastAPI queue consumer.

### 5. What happens immediately after receipt?

For the HTTP route:

1. It uses `request.pages` if the caller supplied pages.
2. If `pages` is empty, it calls `StorageDocumentResolver.resolve_pages(storage_reference, file_name, document_type)`.
3. It builds a tenant-scoped `SecurityContext` from request identifiers.
4. It constructs a `DocumentExtractionRequest` and awaits `ProductionExtractionPipeline.execute()`.
5. On return, it responds with `processed=True`, `status="PROCESSED"`, and the extracted `items`.

The `processed=True` field describes the successful HTTP handler response; it is not a queue acknowledgement.

### 6. Does it retrieve the object from storage?

Not from the configured cloud object-storage service. `StorageDocumentResolver` in `main.py`:

- returns a hard-coded text fixture for a known storage key;
- otherwise attempts to interpret `storage_reference` as a local filesystem path and read it as UTF-8 text;
- if neither path succeeds, synthesizes fallback text from the file name, type, and storage reference.

It does not connect to GCS/S3, download PDF bytes, parse a PDF, or perform OCR. A successful response from this resolver is not proof that the referenced uploaded object exists or was read.

### 7. Does it invoke LangGraph?

Yes, when the HTTP handler calls the pipeline. `ProductionExtractionPipeline.execute()` in `apps/ai/src/tenderpulse_ai/pipeline.py` builds the compliance graph and awaits `graph.ainvoke(...)` for each page. The graph defined in `apps/ai/src/tenderpulse_ai/workflow/graph.py` runs scoped retrieval, model extraction, deterministic verification, optional targeted refinement/human-review routing, and a persistence node.

That graph invocation is part of an HTTP request path; it is not triggered by a queue delivery.

The graph's `make_persistence_node()` currently extends `ctx.persisted_records` and emits an audit event in workflow state. It does not write compliance records to PostgreSQL. The API response returns the resulting items; this endpoint does not itself persist them to the product database.

### 8. When is the message acknowledged?

There is no message acknowledgement in FastAPI. The HTTP route has no queue receipt handle and performs no Pub/Sub `acknowledge`, SQS `DeleteMessage`, or equivalent.

Therefore, no claim can be made that Pub/Sub acknowledges only after persistence or that SQS deletion occurs only after persistence. Neither operation occurs in this FastAPI path.

### 9. What happens on failure?

For an HTTP invocation, request validation/authentication errors produce HTTP errors, and an unhandled processing exception fails the HTTP request. There is no queue-specific retry, visibility-timeout extension, acknowledgement, deletion, or dead-letter handling in FastAPI.

The SQS visibility-timeout behavior and Pub/Sub acknowledgement behavior implemented by the NestJS queue adapters are not FastAPI consumer behavior. Since no FastAPI consumer polls either adapter, those settings do not establish delivery, retry, or acknowledgement semantics for the AI service.

## Queue-specific verification

| Provider | FastAPI consumer? | Acknowledgement/deletion after successful persistence? | Visibility / retry behavior in FastAPI |
|---|---:|---|---|
| **GCP Pub/Sub** | No | No acknowledgement call exists; no persistence-to-ack ordering exists. | No FastAPI pull or ack-deadline extension. |
| **AWS SQS** | No | No delete call exists; no persistence-to-delete ordering exists. | No FastAPI receive or visibility-timeout handling. |

Queue usage, even when connected, would generally provide at-least-once delivery rather than exactly-once execution. This code does not implement queue consumption at all, so it provides no queue delivery guarantee for FastAPI.

## Evidence locations

- **Process startup:** `apps/ai/Dockerfile` (`CMD` runs Uvicorn against `tenderpulse_ai.main:app`).
- **FastAPI app and HTTP handler:** `apps/ai/src/tenderpulse_ai/main.py` (`app`, `QueueProcessingRequest`, `StorageDocumentResolver`, `process_queue_message`).
- **Pipeline orchestration:** `apps/ai/src/tenderpulse_ai/pipeline.py` (`ProductionExtractionPipeline.execute`).
- **LangGraph construction and routing:** `apps/ai/src/tenderpulse_ai/workflow/graph.py`.
- **Workflow persistence behavior:** `apps/ai/src/tenderpulse_ai/workflow/nodes.py` (`make_persistence_node`).
- **FastAPI dependencies:** `apps/ai/requirements.txt` (no queue SDK).

## Conclusion

The implemented FastAPI path is:

```text
HTTP request → handler → fallback/page resolver → extraction pipeline → LangGraph → HTTP response
```

The intended path is not implemented:

```text
MessageQueue → FastAPI consumer → message handler → document workflow → acknowledgement
```

No exactly-once claim is warranted. No source implementation was changed for this verification.
