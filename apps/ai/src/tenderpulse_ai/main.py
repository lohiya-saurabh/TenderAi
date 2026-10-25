import asyncio
import logging
import os
import secrets
import sys
from contextlib import asynccontextmanager
from logging.handlers import RotatingFileHandler
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from tenderpulse_ai.agent import (
    AgentInput,
    AgentOutput,
    TenderRequirementAgent,
    default_requirement_model,
)
from tenderpulse_ai.chat import (
    ChatCopilotAgent,
    ChatQueryRequest,
    ChatQueryResponse,
)
from tenderpulse_ai.config import settings
from tenderpulse_ai.decision import (
    BidDecisionAgent,
    BidDecisionRequest,
    BidDecisionResponse,
)
from tenderpulse_ai.domain.evidence_extractor import (
    CompanyEvidenceExtractionRequest,
    CompanyEvidenceExtractionResponse,
    CompanyEvidenceExtractor,
)
from tenderpulse_ai.infrastructure.queue import (
    DocumentExtractionCompletedEvent,
    DocumentQueueConsumerWorker,
    get_completion_publisher,
)
from tenderpulse_ai.logging import (
    ConsoleLogFormatter,
    JSONLogFormatter,
    TraceLoggingMiddleware,
    scoped_logging_context,
)
from tenderpulse_ai.pipeline import (
    DocumentExtractionRequest,
    DocumentExtractionResponse,
    NormalizedPage,
    ProductionExtractionPipeline,
)
from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.tools.page_text import PageTextTool
from tenderpulse_ai.tools.retrieval import ScopedRetrievalTool

# Initialize dual-sink logging: Rotated File (full structured JSON) + Console (clean one-liner)
root_logger = logging.getLogger()
for handler in list(root_logger.handlers):
    root_logger.removeHandler(handler)

console_level = getattr(logging, settings.log_level_console.upper(), logging.INFO)
file_level = getattr(logging, settings.log_level_file.upper(), logging.DEBUG)
root_logger.setLevel(min(console_level, file_level))

# 1. Console Stream Handler (minimal, high-signal)
stream_handler = logging.StreamHandler(sys.stdout)
stream_handler.setLevel(console_level)
if os.getenv("LOG_FORMAT") == "json":
    stream_handler.setFormatter(JSONLogFormatter(service_name="fastapi"))
else:
    stream_handler.setFormatter(ConsoleLogFormatter(service_name="fastapi"))
root_logger.addHandler(stream_handler)

# 2. Rotated File Handler (high-fidelity machine logs with retention caps)
if os.getenv("LOG_TO_FILE", "true").lower() != "false":
    log_dir_path = Path.cwd() / settings.log_dir
    log_dir_path.mkdir(parents=True, exist_ok=True)
    file_handler = RotatingFileHandler(
        str(log_dir_path / "ai.log"),
        maxBytes=settings.log_max_bytes,
        backupCount=settings.log_backup_count,
        encoding="utf-8",
    )
    file_handler.setLevel(file_level)
    file_handler.setFormatter(JSONLogFormatter(service_name="fastapi"))
    root_logger.addHandler(file_handler)

# Silence third-party network and polling spam on console
if console_level >= logging.INFO:
    for noisy in ("httpx", "httpcore", "urllib3", "boto3", "botocore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

logger = logging.getLogger("tenderpulse_ai.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    worker: DocumentQueueConsumerWorker | None = None
    if settings.ingestion_queue_provider.lower() not in ("none", "disabled"):
        logger.info(
            "Initializing background DocumentQueueConsumerWorker (provider: %s)...",
            settings.ingestion_queue_provider,
        )
        worker = DocumentQueueConsumerWorker()
        await worker.start()
        app.state.queue_worker = worker
    yield
    if worker:
        await worker.stop()


app = FastAPI(
    title="TenderPulse AI Engine",
    description="Internal AI extraction and document intelligence worker service",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(TraceLoggingMiddleware)


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


class QueueProcessingRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    job_id: str = Field(
        ...,
        min_length=1,
        validation_alias=AliasChoices("job_id", "jobId"),
    )
    organization_id: str = Field(
        ...,
        min_length=1,
        validation_alias=AliasChoices("organization_id", "organizationId"),
    )
    company_id: str | None = Field(
        default=None, validation_alias=AliasChoices("company_id", "companyId")
    )
    bid_id: str = Field(
        ...,
        min_length=1,
        validation_alias=AliasChoices("bid_id", "bidId"),
    )
    document_id: str = Field(
        ...,
        min_length=1,
        validation_alias=AliasChoices("document_id", "documentId"),
    )
    workflow_run_id: str = Field(
        ...,
        min_length=1,
        validation_alias=AliasChoices("workflow_run_id", "workflowRunId"),
    )
    trace_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("trace_id", "traceId"),
    )
    correlation_id: str = Field(
        ...,
        min_length=1,
        validation_alias=AliasChoices("correlation_id", "correlationId"),
    )
    storage_reference: str | None = Field(
        default=None,
        validation_alias=AliasChoices("storage_reference", "storageReference"),
    )
    download_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("download_url", "downloadUrl"),
    )
    async_mode: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "async_mode", "asyncMode", "async_execution", "asyncExecution"
        ),
    )
    document_type: str = Field(
        default="NIT", validation_alias=AliasChoices("document_type", "documentType")
    )
    file_name: str = Field(
        default="document.pdf", validation_alias=AliasChoices("file_name", "fileName")
    )
    pages: list[NormalizedPage] = Field(default_factory=list)


class QueueProcessingResponse(BaseModel):
    processed: bool
    status: str
    job_id: str
    organization_id: str
    company_id: str | None
    bid_id: str
    document_id: str
    workflow_run_id: str
    correlation_id: str
    storage_reference: str | None
    items: list[dict]


class StorageDocumentResolver:
    """Resolve queued documents from their storage reference when pages are absent."""

    @classmethod
    def resolve_pages(
        cls,
        storage_reference: str | None,
        file_name: str,
        document_type: str,
    ) -> list[NormalizedPage]:
        if not storage_reference:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Queue message must include a storage_reference when document pages are absent.",
            )

        candidate_path = Path(storage_reference)
        if not candidate_path.is_file():
            repo_candidate = Path(__file__).resolve().parents[4] / storage_reference
            if repo_candidate.is_file():
                candidate_path = repo_candidate

        if candidate_path.is_file():
            if candidate_path.suffix.lower() == ".pdf":
                try:
                    from pypdf import PdfReader

                    reader = PdfReader(str(candidate_path))
                    resolved_pages = []
                    for idx, page in enumerate(reader.pages, start=1):
                        txt = page.extract_text() or ""
                        if txt.strip():
                            resolved_pages.append(NormalizedPage(page_number=idx, text=txt))
                    if resolved_pages:
                        return resolved_pages
                except Exception as exc:
                    logger.warning(
                        "Failed to extract PDF text from candidate path %s: %s", candidate_path, exc
                    )
            return [
                NormalizedPage(
                    page_number=1, text=candidate_path.read_text(encoding="utf-8", errors="ignore")
                )
            ]

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Storage document '{storage_reference}' could not be resolved from storage or filesystem.",
        )


def verify_internal_key(
    x_internal_service_key: str | None = Header(None, alias="X-Internal-Service-Key"),
) -> None:
    if not x_internal_service_key or not secrets.compare_digest(
        x_internal_service_key, settings.internal_service_key
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized internal service call",
        )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="tenderpulse-ai",
        version="0.1.0",
    )


@app.get("/")
async def root():
    return {"message": "TenderPulse AI Service Operational"}


@app.post(
    "/api/v1/extract",
    response_model=DocumentExtractionResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def extract_document(request: DocumentExtractionRequest):
    logger.info(
        "Received extraction request for doc_id=%s, bid_id=%s (pages=%d, tenant=%s)",
        request.document_id,
        request.bid_id,
        len(request.pages),
        request.security_context.tenant_id,
    )
    pipeline = ProductionExtractionPipeline()
    result = await pipeline.execute(request)
    logger.info(
        "Completed extraction for doc_id=%s (extracted %d items, status=%s)",
        request.document_id,
        len(result.items),
        result.status,
    )
    return result


async def _execute_and_publish_extraction(
    request: QueueProcessingRequest,
    pages: list[NormalizedPage],
    download_url: str | None,
) -> DocumentExtractionResponse:
    publisher = get_completion_publisher()
    trace_id = request.trace_id or request.correlation_id or request.job_id
    with scoped_logging_context(
        trace_id=trace_id,
        correlation_id=request.correlation_id,
        job_id=request.job_id,
        tenant_id=request.organization_id,
        tender_id=request.bid_id,
        document_id=request.document_id,
        workflow_id=request.workflow_run_id,
    ):
        try:
            security_context = SecurityContext(
                tenant_id=request.organization_id,
                user_id="tenderpulse-worker",
                company_id=request.company_id,
                workflow_run_id=request.workflow_run_id,
                roles=["WORKER"],
                permissions=["document.processing"],
                allowed_document_ids=[request.document_id],
                allowed_source_ids=[request.storage_reference] if request.storage_reference else [],
                purpose="COMPLIANCE_EXTRACTION",
            )

            extraction_request = DocumentExtractionRequest(
                security_context=security_context,
                bid_id=request.bid_id,
                document_id=request.document_id,
                document_type=request.document_type,
                file_name=request.file_name,
                download_url=download_url,
                pages=pages,
            )

            pipeline = ProductionExtractionPipeline()
            result = await pipeline.execute(extraction_request)

            event = DocumentExtractionCompletedEvent(
                job_id=request.job_id,
                organization_id=request.organization_id,
                company_id=request.company_id,
                bid_id=request.bid_id,
                document_id=request.document_id,
                status="COMPLETED",
                items=result.items,
                chunks=getattr(result, "chunks", []),
                workflow_run_id=request.workflow_run_id,
                trace_id=trace_id,
                correlation_id=request.correlation_id,
            )
            await publisher.publish_completion(event)
            return result
        except Exception as exc:
            logger.error(
                "Extraction pipeline failed for job_id=%s, doc_id=%s: %s",
                request.job_id,
                request.document_id,
                exc,
                extra={"event": "extraction.failed", "error_code": "ERR_EXTRACTION_FAILED"},
            )
            fail_event = DocumentExtractionCompletedEvent(
                job_id=request.job_id,
                organization_id=request.organization_id,
                company_id=request.company_id,
                bid_id=request.bid_id,
                document_id=request.document_id,
                status="FAILED",
                items=[],
                error=str(exc),
                workflow_run_id=request.workflow_run_id,
                trace_id=trace_id,
                correlation_id=request.correlation_id,
            )
            try:
                await publisher.publish_completion(fail_event)
            except Exception as pub_err:  # noqa: BLE001
                logger.warning("Failed to publish failure completion event: %s", pub_err)
            raise


@app.post(
    "/api/v1/worker/process-message",
    response_model=QueueProcessingResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def process_queue_message(request: QueueProcessingRequest):
    """Queue-consumer entrypoint for the async document processing worker.

    Validates the queued job, executes document extraction (synchronously or asynchronously
    depending on async_mode), and publishes completion events to the configured completion sink.
    """
    logger.info(
        "Received worker queue message for job_id=%s, doc_id=%s, bid_id=%s (async=%s)",
        request.job_id,
        request.document_id,
        request.bid_id,
        request.async_mode,
    )
    pages = request.pages
    if not pages and not request.download_url:
        pages = StorageDocumentResolver.resolve_pages(
            storage_reference=request.storage_reference,
            file_name=request.file_name,
            document_type=request.document_type,
        )

    if request.async_mode:
        logger.info(
            "Dispatching asynchronous background extraction task for job_id=%s, doc_id=%s",
            request.job_id,
            request.document_id,
        )
        asyncio.create_task(
            _execute_and_publish_extraction(
                request=request,
                pages=pages,
                download_url=request.download_url,
            )
        )
        return QueueProcessingResponse(
            processed=True,
            status="ACCEPTED",
            job_id=request.job_id,
            organization_id=request.organization_id,
            company_id=request.company_id,
            bid_id=request.bid_id,
            document_id=request.document_id,
            workflow_run_id=request.workflow_run_id,
            correlation_id=request.correlation_id,
            storage_reference=request.storage_reference,
            items=[],
        )

    result = await _execute_and_publish_extraction(
        request=request,
        pages=pages,
        download_url=request.download_url,
    )

    return QueueProcessingResponse(
        processed=True,
        status="PROCESSED",
        job_id=request.job_id,
        organization_id=request.organization_id,
        company_id=request.company_id,
        bid_id=request.bid_id,
        document_id=request.document_id,
        workflow_run_id=request.workflow_run_id,
        correlation_id=request.correlation_id,
        storage_reference=request.storage_reference,
        items=result.items,
    )


@app.post(
    "/api/v1/agent/analyze-requirements",
    response_model=AgentOutput,
    dependencies=[Depends(verify_internal_key)],
)
async def analyze_requirements(request: AgentInput):
    """Tender Requirement Intelligence Agent: bounded, read-only, tenant-scoped."""
    agent = TenderRequirementAgent(
        retrieval_tool=ScopedRetrievalTool(),
        page_text_tool=PageTextTool(),
        model_fn=default_requirement_model,
    )
    return await agent.analyze(request)


@app.post(
    "/api/v1/agent/bid-decision",
    response_model=BidDecisionResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def analyze_bid_decision(request: BidDecisionRequest):
    """Bid/No-Bid Decision Intelligence Agent: evaluates company profile against tender."""
    agent = BidDecisionAgent()
    return await agent.evaluate(request)


@app.post(
    "/api/v1/evidence/extract",
    response_model=CompanyEvidenceExtractionResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def extract_company_evidence(request: CompanyEvidenceExtractionRequest):
    """Automated extraction & chunking of company evidence documents (balance sheets, work orders, ISO certs)."""
    logger.info(
        "Received company evidence extraction request for doc_id=%s, type=%s, org=%s, comp=%s",
        request.evidence_document_id,
        request.evidence_type,
        request.organization_id,
        request.company_id,
    )
    extractor = CompanyEvidenceExtractor()
    result = await extractor.extract(request)
    logger.info(
        "Completed company evidence extraction for doc_id=%s (generated %d chunks)",
        request.evidence_document_id,
        len(result.chunks),
    )
    return result


@app.get("/api/v1/worker/queue-status", dependencies=[Depends(verify_internal_key)])
async def get_queue_status():
    """Returns runtime state of the ingestion queue consumer and completion publisher."""
    worker = getattr(app.state, "queue_worker", None)
    return {
        "ingestion_queue_provider": settings.ingestion_queue_provider,
        "completion_queue_provider": settings.completion_queue_provider,
        "worker_running": bool(worker and worker.is_running),
    }


@app.post(
    "/api/v1/chat/query",
    response_model=ChatQueryResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def chat_query(request: ChatQueryRequest):
    """Tender Chat Copilot: conversational RAG intelligence with LangGraph stateful workflow."""
    logger.info(
        "Received chat query for org=%s, bid=%s, company=%s, conv=%s",
        request.security_context.tenant_id,
        request.bid_id,
        request.company_id,
        request.conversation_id,
    )
    agent = ChatCopilotAgent()
    return await agent.query(request)
