"""Rate limits on free tiers: honour Retry-After and wait for a provider instead of failing."""

import json
import time

import httpx
import pytest

from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
    _MODEL_COOLDOWNS,
    _PROVIDER_BLOCKED_UNTIL,
    LlmEndpoint,
    LLMExtractionError,
    OpenAICompatibleLlmClient,
    rate_limit_cooldown_seconds,
    seconds_until_an_endpoint_frees,
)

_CANDIDATES = {
    "candidates": [
        {
            "category": "FINANCIAL",
            "title": "EMD",
            "description": "EMD",
            "execution_rules": {
                "stamp_paper_required": False,
                "notarization_required": False,
                "udin_required": False,
            },
            "provenance": {
                "page_number": 1,
                "clause_reference": "1",
                "verbatim_quote": "EMD quote",
                "confidence_score": 0.9,
            },
        }
    ]
}


@pytest.fixture(autouse=True)
def clean_cooldowns():
    _MODEL_COOLDOWNS.clear()
    _PROVIDER_BLOCKED_UNTIL.clear()
    yield
    _MODEL_COOLDOWNS.clear()
    _PROVIDER_BLOCKED_UNTIL.clear()


@pytest.mark.parametrize(
    ("headers", "expected"),
    [
        ({"retry-after": "7"}, 7.0),
        ({"retry-after": "0.2"}, 1.0),
        ({"retry-after": "900"}, 60.0),
        ({}, 60.0),
        ({"retry-after": "soon"}, 60.0),
    ],
)
def test_retry_after_is_honoured_within_bounds(headers, expected):
    assert rate_limit_cooldown_seconds(httpx.Response(429, headers=headers)) == expected


def test_permanently_unavailable_endpoints_are_never_waited_for():
    ep = LlmEndpoint(
        provider="groq", base_url="https://api.groq.com/openai/v1", api_key="k", model="gone"
    )
    _MODEL_COOLDOWNS["gone"] = float("inf")
    assert seconds_until_an_endpoint_frees([ep]) is None


async def test_waits_for_the_rate_limit_then_succeeds():
    calls: list[float] = []

    def handler(request: httpx.Request):
        calls.append(time.monotonic())
        if len(calls) == 1:
            return httpx.Response(429, headers={"retry-after": "1"}, json={"error": "slow down"})
        content = json.dumps(_CANDIDATES)
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    client = OpenAICompatibleLlmClient(
        api_key="test-key",
        model="only/model",
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        rate_limit_max_wait_seconds=10,
    )

    items = await client.extract_compliance("sys", "user", max_retries=0)

    assert len(items) == 1
    assert len(calls) == 2
    assert calls[1] - calls[0] >= 1.0  # waited out Retry-After instead of failing


async def test_gives_up_once_the_wait_budget_is_spent():
    def handler(request: httpx.Request):
        return httpx.Response(429, headers={"retry-after": "5"}, json={"error": "slow down"})

    client = OpenAICompatibleLlmClient(
        api_key="test-key",
        model="only/model",
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        rate_limit_max_wait_seconds=2,
    )

    started = time.monotonic()
    with pytest.raises(LLMExtractionError, match="budget"):
        await client.extract_compliance("sys", "user", max_retries=0)
    assert time.monotonic() - started < 2
