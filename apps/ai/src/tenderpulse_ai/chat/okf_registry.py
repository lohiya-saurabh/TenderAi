from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from tenderpulse_ai.extraction.okf_compiler import OKFBundle

_TENDER_OKF_STORE: dict[str, Any] = {}


def register_tender_okf(bid_id: str, bundle: OKFBundle) -> None:
    _TENDER_OKF_STORE[bid_id] = bundle


def get_tender_okf(bid_id: str | None) -> OKFBundle | None:
    if not bid_id:
        return None
    return _TENDER_OKF_STORE.get(bid_id)


def clear_okf_registry() -> None:
    _TENDER_OKF_STORE.clear()


__all__ = ["register_tender_okf", "get_tender_okf", "clear_okf_registry"]
