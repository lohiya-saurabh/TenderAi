import pytest

from tenderpulse_ai.config import settings

# Test tiers: `pytest -m unit` (seconds), `-m realdoc` (real tender PDFs), `-m live` (network).
_REALDOC_MARK = "procurement-evidence"


def pytest_collection_modifyitems(config, items):
    realdoc_files: dict[str, bool] = {}
    for item in items:
        path = str(item.fspath)
        if item.get_closest_marker("live"):
            continue
        if path not in realdoc_files:
            try:
                realdoc_files[path] = _REALDOC_MARK in open(path, encoding="utf-8").read()
            except OSError:
                realdoc_files[path] = False
        item.add_marker(pytest.mark.realdoc if realdoc_files[path] else pytest.mark.unit)


@pytest.fixture(autouse=True)
def hermetic_test_isolation(request, monkeypatch):
    """Offline tests never reach a live gateway, whatever keys .env provides: an unconfigured
    StructuredLLMClient fails with LLMExtractionError, and tests inject tests/fakes.FakeLLM."""
    from tenderpulse_ai.infrastructure.llm.openai_compatible_client import _PROVIDER_BLOCKED_UNTIL

    _PROVIDER_BLOCKED_UNTIL.clear()  # provider circuit breaker is process-global
    if request.node.get_closest_marker("live"):
        return
    for key in (
        "llm_api_key",
        "openrouter_api_key",
        "gemini_api_key",
        "groq_api_key",
        "cerebras_api_key",
        "sambanova_api_key",
    ):
        monkeypatch.setattr(settings, key, None)
    monkeypatch.setattr(settings, "llm_replay_mode", "off")
