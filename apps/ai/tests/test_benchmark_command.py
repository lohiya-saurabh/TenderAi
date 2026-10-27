import json

import pytest
from fakes import use_fake_llm

from tenderpulse_ai.evaluation import benchmark

DOCS = "data/procurement-evidence/01_Tender_Documents"


@pytest.mark.asyncio
async def test_benchmark_snapshot_and_comparison(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(benchmark, "BENCH_DIR", tmp_path / "bench")
    monkeypatch.setattr(benchmark, "PAGE_CACHE_DIR", tmp_path / "pages")
    use_fake_llm(monkeypatch)

    assert await benchmark.main(["--docs", "02", "--dir", DOCS, "--compare", ""]) == 0
    assert await benchmark.main(["--docs", "02", "--dir", DOCS, "--compare", "last"]) == 0

    snaps = sorted((tmp_path / "bench").glob("*.json"))
    row = json.loads(snaps[-1].read_text())["documents"]["02_NHAI_Greenfield_Exp_1450Cr_NIT"]
    assert row["status"] in ("REVIEW_READY", "HUMAN_REVIEW_REQUIRED")
    assert row["items"] > 0 and row["failed_pages"] == []
    assert list((tmp_path / "pages").glob("*.json"))  # parsed pages cached for reruns
    assert "Rejections" in capsys.readouterr().out


@pytest.mark.asyncio
async def test_recorded_live_answers_replay_offline_with_grounded_quotes(monkeypatch):
    """Runs only once responses were recorded on a machine that reaches the provider:
    LLM_REPLAY_MODE=record uv run python -m tenderpulse_ai.evaluation.benchmark --docs 02"""
    from tenderpulse_ai.config import settings
    from tenderpulse_ai.infrastructure.llm.replay import DEFAULT_DIR

    if not any(DEFAULT_DIR.glob("*.json")):
        pytest.skip("no recorded LLM responses in tests/fixtures/llm_cassettes")
    monkeypatch.setattr(settings, "llm_replay_mode", "replay")
    pdf = next(p for p in benchmark.DEFAULT_DOCS_DIR.glob("02_*.pdf"))
    row = await benchmark.run_document(pdf)

    assert row["status"] != "FAILED", row.get("error")
    assert row["items"] > 0
    assert row["model_failures"] == 0
    assert row["quotes_over_700"] == 0  # quotes are sentences chosen by the model, not blocks
