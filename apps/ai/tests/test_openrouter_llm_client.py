import json
import time

import httpx
import pytest

from tenderpulse_ai.domain.models import (
    AssembledClauseContext,
    CandidateComplianceItem,
    DocumentStructureTree,
    ExecutionRulesProps,
    ProvenanceProps,
)
from tenderpulse_ai.domain.validator import DeterministicValidator
from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
    OpenAICompatibleLlmClient,
)
from tenderpulse_ai.models.llm_client import LLMExtractionError, StructuredLLMClient


@pytest.mark.asyncio
async def test_openai_compatible_client_parses_valid_json_response():
    sample_response_payload = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": json.dumps(
                        {
                            "candidates": [
                                {
                                    "category": "FINANCIAL",
                                    "title": "Earnest Money Deposit (EMD)",
                                    "description": "INR 10,00,000 required on non-judicial stamp paper.",
                                    "execution_rules": {
                                        "stamp_paper_required": True,
                                        "stamp_paper_denomination_inr": 100,
                                        "notarization_required": False,
                                        "udin_required": False,
                                        "signing_authority_rank": "Authorized Signatory",
                                    },
                                    "provenance": {
                                        "page_number": 1,
                                        "clause_reference": "Section 1.1",
                                        "verbatim_quote": "The bidder must submit Bid Security / Earnest Money Deposit (EMD) of INR 10,00,000 on a non-judicial stamp paper.",
                                        "confidence_score": 0.98,
                                    },
                                },
                                {
                                    "category": "LEGAL",
                                    "title": "Power of Attorney",
                                    "description": "PoA in favor of lead member.",
                                    "execution_rules": {
                                        "stamp_paper_required": True,
                                        "stamp_paper_denomination_inr": 500,
                                        "notarization_required": True,
                                        "udin_required": False,
                                    },
                                    "provenance": {
                                        "page_number": 1,
                                        "clause_reference": "Section 1.2",
                                        "verbatim_quote": "Power of Attorney executed on non-judicial stamp paper in favor of lead member of consortium.",
                                        "confidence_score": 0.95,
                                    },
                                },
                            ]
                        }
                    ),
                }
            }
        ]
    }

    def handler(request: httpx.Request):
        assert request.headers.get("authorization") == "Bearer test-openrouter-key"
        assert request.headers.get("http-referer") == "https://tenderpulse.ai"
        body = json.loads(request.content)
        assert body["model"] == "google/gemini-2.0-flash-001"
        assert len(body["messages"]) == 2
        return httpx.Response(200, json=sample_response_payload)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = OpenAICompatibleLlmClient(
            api_key="test-openrouter-key",
            base_url="https://openrouter.ai/api/v1",
            model="google/gemini-2.0-flash-001",
            client=mock_http,
        )

        candidates = await client.extract_compliance(
            system_prompt="Test system prompt",
            user_prompt="Test user prompt",
        )

        assert len(candidates) == 2
        emd = candidates[0]
        assert emd.category == "FINANCIAL"
        assert emd.title == "Earnest Money Deposit (EMD)"
        assert emd.execution_rules.stamp_paper_required is True
        assert emd.execution_rules.stamp_paper_denomination_inr == 100
        assert emd.provenance.page_number == 1
        assert "INR 10,00,000" in emd.provenance.verbatim_quote

        poa = candidates[1]
        assert poa.category == "LEGAL"
        assert poa.execution_rules.notarization_required is True
        assert poa.execution_rules.stamp_paper_denomination_inr == 500


@pytest.mark.asyncio
async def test_openai_compatible_client_strips_markdown_fences():
    fenced_content = """```json
    {
      "items": [
        {
          "category": "TECHNICAL",
          "title": "Similar Work Experience",
          "description": "Completion of similar EPC work in last 7 years.",
          "execution_rules": {
            "stamp_paper_required": false,
            "notarization_required": false,
            "udin_required": true
          },
          "provenance": {
            "page_number": 2,
            "clause_reference": "Clause 2.1",
            "verbatim_quote": "The Bidder must demonstrate prior completion of similar work in EPC infrastructure works within last 7 years.",
            "confidence_score": 0.92
          }
        }
      ]
    }
    ```"""

    def handler(request: httpx.Request):
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": fenced_content}}]},
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = OpenAICompatibleLlmClient(
            api_key="test-key",
            client=mock_http,
        )
        items = await client.extract_compliance("sys", "user")
        assert len(items) == 1
        assert items[0].title == "Similar Work Experience"
        assert items[0].execution_rules.udin_required is True


@pytest.mark.asyncio
async def test_openai_compatible_client_retries_transient_error():
    attempts = 0

    def handler(request: httpx.Request):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(503, text="Service Unavailable")
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "candidates": [
                                        {
                                            "category": "STATUTORY",
                                            "title": "Integrity Pact",
                                            "description": "Signed Integrity Pact required.",
                                            "execution_rules": {
                                                "stamp_paper_required": False,
                                                "notarization_required": False,
                                                "udin_required": False,
                                            },
                                            "provenance": {
                                                "page_number": 3,
                                                "clause_reference": "Section 3",
                                                "verbatim_quote": "Integrity Pact duly signed",
                                                "confidence_score": 0.95,
                                            },
                                        }
                                    ]
                                }
                            )
                        }
                    }
                ]
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = OpenAICompatibleLlmClient(api_key="test-key", client=mock_http)
        items = await client.extract_compliance("sys", "user", max_retries=1)
        assert attempts == 2
        assert len(items) == 1
        assert items[0].title == "Integrity Pact"


@pytest.mark.asyncio
async def test_structured_llm_client_raises_on_live_error_without_fallback():
    def failing_handler(request: httpx.Request):
        return httpx.Response(500, text="Internal Gateway Error")

    transport = httpx.MockTransport(failing_handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        live = OpenAICompatibleLlmClient(api_key="test-key", client=mock_http)
        structured_client = StructuredLLMClient(live_client=live)
        with pytest.raises(LLMExtractionError, match="500"):
            await structured_client.extract_compliance("sys", "user", max_retries=0)


@pytest.mark.asyncio
async def test_deterministic_validator_rejects_hallucinated_llm_quote():
    raw_page_text = (
        "The Bidder must submit an Earnest Money Deposit of INR 10,00,000 on a stamp paper."
    )

    # Model hallucinates a quote not present in the document
    hallucinated_candidate = CandidateComplianceItem(
        category="FINANCIAL",
        title="Hallucinated Performance Guarantee",
        description="PBG of INR 50,00,000 required.",
        execution_rules=ExecutionRulesProps(
            stamp_paper_required=True, stamp_paper_denomination_inr=100
        ),
        provenance=ProvenanceProps(
            source_document_id="doc-test",
            source_file_name="test.pdf",
            page_number=1,
            clause_reference="Clause 9.9",
            verbatim_quote="The Bidder shall furnish an unconditional Bank Guarantee of INR 50,00,000 within 15 days.",  # NOT IN PAGE TEXT
            confidence_score=0.99,
        ),
    )

    validator = DeterministicValidator()
    doc_structure = DocumentStructureTree(document_id="doc-test", nodes=[])
    context = AssembledClauseContext(
        candidate_id="cand_1",
        section_path="Document > Section 1",
        clause_reference="Clause 1.1",
        current_clause=raw_page_text,
        page_number=1,
    )

    check, _tier = validator.validate_item(
        item=hallucinated_candidate,
        context=context,
        tree=doc_structure,
    )

    assert check.numbers_preserved is False
    assert len(check.discrepancies) >= 2
    assert any("not found in clause text" in d.lower() for d in check.discrepancies)

    # In Node 6 exact substring grounding check
    clean_quote = " ".join(hallucinated_candidate.provenance.verbatim_quote.lower().split())
    quote_in_page = clean_quote in raw_page_text.lower()
    assert quote_in_page is False


@pytest.mark.asyncio
async def test_openai_compatible_client_generate_chat_completion_success():
    sample_response = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "Your company Ashoka Buildcon has verified GST records on file.",
                }
            }
        ]
    }

    def handler(request: httpx.Request):
        assert request.headers.get("authorization") == "Bearer test-chat-key"
        assert request.headers.get("http-referer") == "https://tenderpulse.ai"
        body = json.loads(request.content)
        assert body["model"] == "google/gemini-2.0-flash-001"
        assert len(body["messages"]) == 1
        assert body["messages"][0]["content"] == "Hello Copilot"
        return httpx.Response(200, json=sample_response)

    transport = httpx.MockTransport(handler)
    mock_client = httpx.AsyncClient(transport=transport)
    client = OpenAICompatibleLlmClient(
        api_key="test-chat-key",
        base_url="https://openrouter.ai/api/v1",
        model="google/gemini-2.0-flash-001",
        client=mock_client,
    )

    result = await client.generate_chat_completion(
        messages=[{"role": "user", "content": "Hello Copilot"}]
    )
    assert result == "Your company Ashoka Buildcon has verified GST records on file."


@pytest.mark.asyncio
async def test_openai_compatible_client_generate_chat_completion_with_system_prompt_and_retry():
    attempts = 0

    def handler(request: httpx.Request):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(503, json={"error": "Service temporarily unavailable"})
        body = json.loads(request.content)
        assert body["messages"][0]["role"] == "system"
        assert body["messages"][0]["content"] == "You are a procurement expert."
        assert body["messages"][1]["role"] == "user"
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "Here is the statutory analysis.",
                        }
                    }
                ]
            },
        )

    transport = httpx.MockTransport(handler)
    mock_client = httpx.AsyncClient(transport=transport)
    client = OpenAICompatibleLlmClient(
        api_key="test-chat-key",
        base_url="https://openrouter.ai/api/v1",
        model="google/gemini-2.0-flash-001",
        client=mock_client,
    )

    result = await client.generate_chat_completion(
        messages=[{"role": "user", "content": "Analyze statutory credentials"}],
        system_prompt="You are a procurement expert.",
        max_retries=1,
    )
    assert attempts == 2
    assert result == "Here is the statutory analysis."


@pytest.mark.asyncio
async def test_openai_compatible_client_generate_chat_completion_handles_failure_gracefully():
    def handler(request: httpx.Request):
        return httpx.Response(401, json={"error": "Invalid API key"})

    transport = httpx.MockTransport(handler)
    mock_client = httpx.AsyncClient(transport=transport)
    client = OpenAICompatibleLlmClient(
        api_key="bad-key",
        base_url="https://openrouter.ai/api/v1",
        model="google/gemini-2.0-flash-001",
        client=mock_client,
    )

    result = await client.generate_chat_completion(
        messages=[{"role": "user", "content": "Test fail"}]
    )
    assert result == ""


@pytest.mark.asyncio
async def test_openai_compatible_client_rotates_on_404_and_sets_inf_cooldown():
    from tenderpulse_ai.infrastructure.llm.openai_compatible_client import _MODEL_COOLDOWNS

    calls = []

    def handler(request: httpx.Request):
        body = json.loads(request.content)
        model = body["model"]
        calls.append(model)
        if model == "first/deprecated-model":
            return httpx.Response(404, json={"error": "Model not found"})
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
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
                            )
                        }
                    }
                ]
            },
        )

    transport = httpx.MockTransport(handler)
    mock_client = httpx.AsyncClient(transport=transport)
    client = OpenAICompatibleLlmClient(
        api_key="test-key",
        model="first/deprecated-model",
        client=mock_client,
    )

    items = await client.extract_compliance("sys", "user", max_retries=0)
    assert len(items) == 1
    assert _MODEL_COOLDOWNS["first/deprecated-model"] == float("inf")
    assert len(calls) >= 2


@pytest.mark.asyncio
async def test_openai_compatible_client_rotates_on_429_and_sets_60s_cooldown():
    import time

    from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
        _MODEL_COOLDOWNS,
        _PROVIDER_BLOCKED_UNTIL,
        is_provider_blocked,
    )

    calls = []

    def handler(request: httpx.Request):
        body = json.loads(request.content)
        model = body["model"]
        calls.append(model)
        if model == "primary/rate-limited":
            return httpx.Response(429, json={"error": "Rate limited"})
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
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
                            )
                        }
                    }
                ]
            },
        )

    transport = httpx.MockTransport(handler)
    mock_client = httpx.AsyncClient(transport=transport)
    client = OpenAICompatibleLlmClient(
        api_key="test-key",
        model="primary/rate-limited",
        client=mock_client,
    )

    # A 429 locks out the whole provider (free-tier limits are per key): the same-provider
    # fallback models are skipped instead of producing a sequential 429 storm, and with no
    # provider left the call fails explicitly.
    with pytest.raises(LLMExtractionError):
        await client.extract_compliance("sys", "user", max_retries=0)
    assert calls == ["primary/rate-limited"]
    assert is_provider_blocked("https://openrouter.ai/api/v1")
    cooldown = _MODEL_COOLDOWNS["primary/rate-limited"]
    assert cooldown > time.time()
    assert cooldown <= time.time() + 65.0
    _PROVIDER_BLOCKED_UNTIL.clear()


@pytest.mark.asyncio
async def test_structured_llm_client_surfaces_401_as_extraction_error():
    def auth_fail_handler(request: httpx.Request):
        return httpx.Response(401, json={"error": "Unauthorized"})

    transport = httpx.MockTransport(auth_fail_handler)
    mock_client = httpx.AsyncClient(transport=transport)
    live_client = OpenAICompatibleLlmClient(api_key="bad-key", client=mock_client)
    structured_client = StructuredLLMClient(live_client=live_client)
    with pytest.raises(LLMExtractionError, match="401"):
        await structured_client.extract_compliance("sys", "user", max_retries=0)


def test_structured_llm_client_instantiates_live_client_from_settings(monkeypatch):
    from tenderpulse_ai.config import settings

    monkeypatch.setattr(settings, "llm_api_key", "test-sk-key")
    assert StructuredLLMClient().live_client.endpoints


@pytest.mark.asyncio
async def test_unconfigured_client_fails_fast_without_any_request():
    calls = []
    transport = httpx.MockTransport(lambda r: calls.append(r) or httpx.Response(200))
    async with httpx.AsyncClient(transport=transport) as mock_http:
        live = OpenAICompatibleLlmClient(api_key=None, client=mock_http)
        with pytest.raises(LLMExtractionError, match="No LLM endpoint"):
            await StructuredLLMClient(live_client=live).extract_compliance("sys", "user")
    assert calls == []


@pytest.mark.asyncio
async def test_provider_lockout_still_rotates_to_a_different_provider():
    from tenderpulse_ai.infrastructure.llm.openai_compatible_client import LlmEndpoint

    calls = []

    def handler(request: httpx.Request):
        calls.append(str(request.url))
        if "provider-a" in str(request.url):
            return httpx.Response(429, json={"error": "Rate limited"})
        body = {"candidates": []}
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(body)}}]})

    endpoints = [
        LlmEndpoint(provider="a", base_url="https://provider-a.test/v1", api_key="k", model="m1"),
        LlmEndpoint(provider="a", base_url="https://provider-a.test/v1", api_key="k", model="m2"),
        LlmEndpoint(provider="b", base_url="https://provider-b.test/v1", api_key="k", model="m3"),
    ]
    client = OpenAICompatibleLlmClient(
        endpoints=endpoints, client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
    )
    await client.extract_compliance("sys", "user", max_retries=0)
    # m2 shares provider A's rate limit: skipped; provider B is tried.
    assert [c.split("/v1")[0] for c in calls] == [
        "https://provider-a.test",
        "https://provider-b.test",
    ]
    # A second call skips provider A entirely (0 network calls to it).
    calls.clear()
    await client.extract_compliance("sys", "user", max_retries=0)
    assert all("provider-a" not in c for c in calls)


@pytest.mark.asyncio
async def test_extraction_disables_reasoning_and_cools_down_length_truncated_models():
    from tenderpulse_ai.infrastructure.llm.openai_compatible_client import (
        _MODEL_COOLDOWNS,
        LlmEndpoint,
    )

    sent = []

    def handler(request: httpx.Request):
        body = json.loads(request.content)
        sent.append(body)
        if body["model"] == "reasoner":
            # Reasoning consumed the whole budget: empty content, finish_reason="length"
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"content": ""}, "finish_reason": "length"}],
                    "usage": {
                        "completion_tokens": 4096,
                        "completion_tokens_details": {"reasoning_tokens": 4096},
                    },
                },
            )
        content = {
            "candidates": [
                {
                    "category": "FINANCIAL",
                    "title": "EMD",
                    "description": "EMD",
                    "execution_rules": {},
                    "provenance": {"page_number": 1, "verbatim_quote": "EMD quote"},
                }
            ]
        }
        return httpx.Response(
            200, json={"choices": [{"message": {"content": json.dumps(content)}}]}
        )

    base = "https://openrouter.ai/api/v1"
    client = OpenAICompatibleLlmClient(
        endpoints=[
            LlmEndpoint(provider="openrouter", base_url=base, api_key="k", model="reasoner"),
            LlmEndpoint(provider="openrouter", base_url=base, api_key="k", model="instruct"),
        ],
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        max_tokens=4096,
    )
    items = await client.extract_compliance("sys", "user", max_retries=0)
    assert len(items) == 1
    assert all(b["reasoning"] == {"effort": "none", "exclude": True} for b in sent)
    assert all(b["max_tokens"] == 4096 for b in sent)
    assert _MODEL_COOLDOWNS["reasoner"] > time.time() + 500  # skipped by later windows
    _MODEL_COOLDOWNS.clear()


def test_create_from_settings_uses_llm_max_tokens(monkeypatch):
    from tenderpulse_ai.config import settings

    monkeypatch.setattr(settings, "llm_max_tokens", 3000)
    monkeypatch.setattr(settings, "openrouter_api_key", "sk-test")
    assert OpenAICompatibleLlmClient.create_from_settings(settings).max_tokens == 3000
