"""Record / replay of raw LLM chat-completion responses (LLM_REPLAY_MODE).

- ``record``: every successful response is saved as ``<sha256(messages)>.json`` under
  ``LLM_REPLAY_DIR``; run once where the provider is reachable.
- ``replay``: no network; the saved response for the exact same messages is parsed by the
  normal client code path. A missing recording is an explicit error, never a fallback.
- ``off`` (default): live calls only.

Any change to the prompt text changes the key, so recordings must be refreshed with it.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

DEFAULT_DIR = Path(__file__).resolve().parents[4] / "tests" / "fixtures" / "llm_cassettes"


def mode() -> str:
    from tenderpulse_ai.config import settings

    return (settings.llm_replay_mode or "off").lower()


def _path(messages: list[dict[str, Any]]) -> Path:
    from tenderpulse_ai.config import settings

    key = hashlib.sha256(json.dumps(messages, sort_keys=True).encode()).hexdigest()
    return Path(settings.llm_replay_dir or DEFAULT_DIR) / f"{key}.json"


def save(messages: list[dict[str, Any]], response: dict[str, Any]) -> None:
    path = _path(messages)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(response, ensure_ascii=False, indent=1))


def load(messages: list[dict[str, Any]]) -> dict[str, Any]:
    from tenderpulse_ai.infrastructure.llm.openai_compatible_client import LLMExtractionError

    path = _path(messages)
    if not path.exists():
        raise LLMExtractionError(
            f"LLM_REPLAY_MODE=replay but no recording {path.name} exists for this prompt; "
            "re-run with LLM_REPLAY_MODE=record where the provider is reachable."
        )
    return json.loads(path.read_text())
