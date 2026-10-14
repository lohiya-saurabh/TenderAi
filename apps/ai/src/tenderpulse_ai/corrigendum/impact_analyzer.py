import datetime
from tenderpulse_ai.corrigendum.models import (
    ChangeType,
    ClauseChange,
    CorrigendumImpactReport,
    DriftSeverity,
)


class DriftImpactAnalyzer:
    """
    Evaluates semantic requirement changes from Corrigenda against the company's bid posture.
    Determines whether the amendment is favorable, adverse, or neutral, and flags mandatory re-evaluation.
    """

    def analyze_impact(
        self,
        tender_id: str,
        corrigendum_id: str,
        changes: list[ClauseChange],
        corrigendum_number: int = 1,
        issue_date: str | None = None,
    ) -> CorrigendumImpactReport:
        today_iso = issue_date or datetime.date.today().isoformat()
        action_items: list[str] = []
        categories: set[str] = set()

        favorable_signals = 0
        adverse_signals = 0
        requires_reeval = False

        for change in changes:
            categories.add(change.category)
            text_lower = change.amended_text.lower()

            if change.severity in {DriftSeverity.CRITICAL, DriftSeverity.HIGH}:
                requires_reeval = True

            # Analyze Deadline Changes
            if change.change_type == ChangeType.DEADLINE_CHANGE:
                if "extended" in text_lower or "postponed" in text_lower:
                    favorable_signals += 1
                    action_items.append(
                        f"Verify that validity of Bid Security / EMD bank guarantee covers revised timeline ({change.clause_reference})."
                    )
                else:
                    adverse_signals += 1
                    action_items.append(f"Submission deadline updated: {change.clause_reference}. Accelerate Packet 1 preparation.")

            # Analyze Financial Criteria Changes
            elif change.category == "FINANCIAL":
                if "reduced" in text_lower or "relaxed" in text_lower:
                    favorable_signals += 1
                    action_items.append("Financial criteria relaxed: Re-evaluate qualification margin against company turnover records.")
                elif "increased" in text_lower or "raised" in text_lower:
                    adverse_signals += 1
                    action_items.append("CRITICAL: Financial criteria increased. Verify whether company still satisfies minimum threshold.")
                else:
                    action_items.append("Financial clause amended: Confirm compliance with statutory auditor.")

            # Analyze Securities / EMD Changes
            elif change.category == "SECURITIES":
                if "exempted" in text_lower or "waived" in text_lower:
                    favorable_signals += 1
                    action_items.append("EMD waiver detected: Attach valid Udyam / NSIC certificate in lieu of EMD deposit.")
                else:
                    action_items.append("EMD/PBG terms amended: Review revised format and bank guarantee tenure.")

            # Statutory Execution
            elif change.category == "STATUTORY_EXECUTION":
                action_items.append(f"Execution rule amended ({change.clause_reference}): Procure updated stamp paper/notarization as specified.")

        # Determine Overall Impact
        if adverse_signals > favorable_signals:
            overall_impact = "ADVERSE"
        elif favorable_signals > adverse_signals:
            overall_impact = "FAVORABLE"
        else:
            overall_impact = "NEUTRAL"

        return CorrigendumImpactReport(
            tender_id=tender_id,
            corrigendum_id=corrigendum_id,
            corrigendum_number=corrigendum_number,
            issue_date=today_iso,
            changes=changes,
            overall_impact=overall_impact,
            requires_decision_reevaluation=requires_reeval,
            affected_categories=sorted(list(categories)),
            action_items=action_items,
        )
