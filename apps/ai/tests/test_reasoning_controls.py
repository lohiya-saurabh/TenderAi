"""Per-provider reasoning controls: extraction must not burn max_tokens on hidden reasoning."""

import pytest

from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
    PROVIDER_SPECS,
    LlmEndpoint,
    apply_reasoning_controls,
    reasoning_effort_for,
)


def _ep(provider: str, model: str) -> LlmEndpoint:
    return LlmEndpoint(
        provider=provider,
        base_url=PROVIDER_SPECS[provider]["base_url"],
        api_key="test-key",
        model=model,
        extra_headers={},
    )


@pytest.mark.parametrize(
    ("provider", "model", "expected"),
    [
        ("groq", "openai/gpt-oss-120b", "low"),
        ("cerebras", "gpt-oss-120b", "low"),
        ("sambanova", "gpt-oss-120b", "low"),
        ("groq", "qwen/qwen3.8-27b", "none"),
        ("cerebras", "qwen-3.8-27b", "none"),
        ("gemini", "gemini-3.5-flash", "none"),
        ("sambanova", "DeepSeek-V3.2", None),
    ],
)
def test_lowest_supported_effort_per_model(provider, model, expected):
    assert reasoning_effort_for(_ep(provider, model)) == expected


def test_openrouter_keeps_its_own_reasoning_object():
    payload: dict = {}
    apply_reasoning_controls(payload, _ep("openrouter", "nvidia/nemotron-3.5-lightning:free"))
    assert payload == {"reasoning": {"effort": "none", "exclude": True}}


def test_rotation_never_carries_a_previous_endpoints_setting():
    payload: dict = {}
    apply_reasoning_controls(payload, _ep("openrouter", "openrouter/free"))
    apply_reasoning_controls(payload, _ep("groq", "openai/gpt-oss-120b"))
    assert payload == {"reasoning_effort": "low"}

    apply_reasoning_controls(payload, _ep("sambanova", "DeepSeek-V3.2"))
    assert "reasoning_effort" not in payload and "reasoning" not in payload
