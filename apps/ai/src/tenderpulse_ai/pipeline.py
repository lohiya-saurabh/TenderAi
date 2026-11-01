"""Backward-compatible facade for tender compliance extraction.

All extraction logic lives in tenderpulse_ai.extraction; items come only from the LLM.
"""

from __future__ import annotations

from tenderpulse_ai.extraction.contracts import (
    DocumentExtractionRequest,
    DocumentExtractionResponse,
    NormalizedPage,
)
from tenderpulse_ai.extraction.orchestrator import ProductionExtractionPipeline

__all__ = [
    "NormalizedPage",
    "DocumentExtractionRequest",
    "DocumentExtractionResponse",
    "ProductionExtractionPipeline",
]
