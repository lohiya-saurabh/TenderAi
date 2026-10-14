import pytest
from tenderpulse_ai.corrigendum.diff_engine import CorrigendumDiffEngine
from tenderpulse_ai.corrigendum.impact_analyzer import DriftImpactAnalyzer
from tenderpulse_ai.corrigendum.models import ChangeType, DriftSeverity


def test_corrigendum_diff_detects_deadline_and_turnover_changes():
    engine = CorrigendumDiffEngine()

    original_clauses = {
        "Clause 3.1": "The last date of submission is 2026-10-15 up to 15:00 hours.",
        "Clause 4.2": "Minimum average annual turnover for last 3 years shall be INR 50 Crores.",
        "Clause 8.1": "Earnest Money Deposit shall be INR 10,00,000.",
    }

    corrigendum_text = """
CORRIGENDUM NO. 1

Item No. 1: Amendment to Clause 3.1
The last date of submission is extended up to 2026-10-25 at 17:00 hrs.

Item No. 2: Amendment to Clause 4.2
The minimum average annual turnover is reduced from INR 50 Crores to INR 40 Crores.

Item No. 3: Clause 14.5
All bidders must submit an Undertaking on INR 100 non-judicial stamp paper regarding non-blacklisting.
"""

    changes = engine.diff_clauses(original_clauses, corrigendum_text)

    assert len(changes) == 3

    # 1. Deadline change check
    chg_deadline = changes[0]
    assert chg_deadline.change_type == ChangeType.DEADLINE_CHANGE
    assert chg_deadline.severity == DriftSeverity.HIGH
    assert "extended" in chg_deadline.amended_text.lower()

    # 2. Turnover modification check
    chg_turnover = changes[1]
    assert chg_turnover.change_type == ChangeType.MODIFICATION
    assert chg_turnover.severity == DriftSeverity.CRITICAL
    assert chg_turnover.category == "FINANCIAL"
    assert "40" in chg_turnover.extracted_delta.get("extracted_amounts", [])

    # 3. Addition check
    chg_addition = changes[2]
    assert chg_addition.change_type == ChangeType.ADDITION
    assert chg_addition.severity == DriftSeverity.CRITICAL  # Mentions non-blacklisting


def test_drift_impact_analyzer_generates_favorable_report():
    engine = CorrigendumDiffEngine()
    analyzer = DriftImpactAnalyzer()

    original_clauses = {
        "Clause 4.2": "Minimum average annual turnover: INR 50 Crores.",
        "Clause 3.1": "Submission date: 2026-10-15.",
    }

    corrigendum_text = """
Clause 3.1: Submission date is extended up to 2026-10-25.
Clause 4.2: Turnover requirement is reduced to INR 35 Crores.
"""

    changes = engine.diff_clauses(original_clauses, corrigendum_text)
    report = analyzer.analyze_impact(
        tender_id="tnd_nhai_01",
        corrigendum_id="corr_01",
        changes=changes,
        corrigendum_number=1,
    )

    assert report.tender_id == "tnd_nhai_01"
    assert report.corrigendum_id == "corr_01"
    assert report.overall_impact == "FAVORABLE"
    assert report.requires_decision_reevaluation is True
    assert len(report.action_items) >= 2
    assert "TIMELINE" in report.affected_categories
    assert "FINANCIAL" in report.affected_categories
