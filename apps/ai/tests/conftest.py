import pytest

from tenderpulse_ai.config import settings


@pytest.fixture(autouse=True)
def hermetic_test_isolation(request, monkeypatch):
    """Ensure offline unit/integration tests do not invoke live OpenRouter API

    unless explicitly marked or part of openrouter test files.
    """
    if "test_openrouter" in request.node.nodeid or request.node.get_closest_marker("live_llm"):
        return
    monkeypatch.setattr(settings, "llm_api_key", None)
