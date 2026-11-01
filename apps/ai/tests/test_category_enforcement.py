"""Off-taxonomy categories: enforce the enum where decoding allows it, re-ask instead of dropping."""

import json

import httpx
import pytest

from tenderpulse_ai.agent.validation import EXTRACTION_CATEGORIES
from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
    _MODEL_COOLDOWNS,
    _PROVIDER_BLOCKED_UNTIL,
    _RATE_LIMITED_UNTIL,
    CANDIDATES_SCHEMA,
    PROVIDER_SPECS,
    LlmEndpoint,
    OpenAICompatibleLlmClient,
)


@pytest.fixture(autouse=True)
def clean_cooldowns():
    for state in (_MODEL_COOLDOWNS, _PROVIDER_BLOCKED_UNTIL, _RATE_LIMITED_UNTIL):
        state.clear()
    yield
    for state in (_MODEL_COOLDOWNS, _PROVIDER_BLOCKED_UNTIL, _RATE_LIMITED_UNTIL):
        state.clear()


def _item(title: str, category: str) -> dict:
    return {
        "block_id": "B1",
        "category": category,
        "title": title,
        "description": title,
        "quote": f"The Bidder shall meet the {title} requirement.",
    }


def _reply(*items: dict) -> httpx.Response:
    content = json.dumps({"candidates": list(items)})
    return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})


def _client(handler, provider: str = "groq") -> OpenAICompatibleLlmClient:
    ep = LlmEndpoint(
        provider=provider,
        base_url=PROVIDER_SPECS[provider]["base_url"],
        api_key="k",
        model="m",
    )
    return OpenAICompatibleLlmClient(
        endpoints=[ep], client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
    )


def test_schema_enforces_the_prompt_categories():
    item = CANDIDATES_SCHEMA["properties"]["candidates"]["items"]
    assert item["properties"]["category"]["enum"] == sorted(EXTRACTION_CATEGORIES)
    assert set(item["required"]) == {"block_id", "category", "title", "description", "quote"}


@pytest.mark.parametrize(
    ("provider", "expected"), [("cerebras", "json_schema"), ("groq", "json_object")]
)
async def test_strict_schema_only_goes_to_providers_that_enforce_it(provider, expected):
    formats: list[str] = []

    def handler(request: httpx.Request):
        formats.append(json.loads(request.content)["response_format"]["type"])
        return _reply(_item("Turnover", "FINANCIAL"))

    await _client(handler, provider).extract_compliance("sys", "user", max_retries=0)
    assert formats == [expected]


async def test_off_taxonomy_items_are_re_asked_not_dropped():
    prompts: list[str] = []

    def handler(request: httpx.Request):
        prompts.append(json.loads(request.content)["messages"][1]["content"])
        if len(prompts) == 1:
            return _reply(_item("Power of attorney", "LEGAL"), _item("Turnover", "ELIGIBILITY"))
        return _reply(_item("Turnover", "FINANCIAL"))

    items = await _client(handler).extract_compliance("sys", "user", max_retries=0)

    assert [(i.title, i.category) for i in items] == [
        ("Power of attorney", "LEGAL"),
        ("Turnover", "FINANCIAL"),
    ]
    assert len(prompts) == 2
    assert "ELIGIBILITY" in prompts[1] and "Power of attorney" not in prompts[1]


async def test_items_still_off_taxonomy_after_the_re_ask_are_dropped():
    def handler(request: httpx.Request):
        return _reply(_item("Power of attorney", "LEGAL"), _item("Turnover", "ELIGIBILITY"))

    items = await _client(handler).extract_compliance("sys", "user", max_retries=0)
    # The re-ask echoed the valid item too; only the off-list one is gone.
    assert [i.category for i in items] == ["LEGAL", "LEGAL"]


async def test_a_failed_re_ask_keeps_the_valid_items():
    calls = 0

    def handler(request: httpx.Request):
        nonlocal calls
        calls += 1
        if calls == 1:
            return _reply(_item("Power of attorney", "LEGAL"), _item("Turnover", "ELIGIBILITY"))
        return httpx.Response(200, json={"choices": [{"message": {"content": "not json"}}]})

    items = await _client(handler).extract_compliance("sys", "user", max_retries=0)
    assert [i.title for i in items] == ["Power of attorney"]
