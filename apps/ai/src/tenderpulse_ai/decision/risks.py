import datetime

from tenderpulse_ai.agent.schemas import RequirementCandidate
from tenderpulse_ai.decision.schemas import RiskItem, RiskSeverity


class CommercialRiskAnalyzer:
    """Evaluates commercial, timeline, and execution risks for a tender."""

    @classmethod
    def analyze(
        cls,
        requirements: list[RequirementCandidate],
        submission_deadline: datetime.date,
        estimated_value_inr_crores: float,
        current_date: datetime.date | None = None,
    ) -> list[RiskItem]:
        risks: list[RiskItem] = []
        today = current_date or datetime.datetime.now(datetime.UTC).date()

        # 1. Timeline Pressure Risk
        days_remaining = (submission_deadline - today).days
        if days_remaining <= 3:
            risks.append(
                RiskItem(
                    title="Critical Deadline Pressure",
                    severity=RiskSeverity.CRITICAL,
                    category="TIMELINE",
                    detail=(
                        f"Only {days_remaining} day(s) remaining before bid submission deadline ({submission_deadline}). "
                        "High risk of document preparation or portal submission failure."
                    ),
                    mitigation_advice="Prioritize immediate procurement of stamp paper, CA certificates, and bank guarantees.",
                )
            )
        elif days_remaining <= 7:
            risks.append(
                RiskItem(
                    title="Tight Submission Timeline",
                    severity=RiskSeverity.HIGH,
                    category="TIMELINE",
                    detail=f"Only {days_remaining} days remaining until deadline ({submission_deadline}).",
                    mitigation_advice="Fast-track annexure drafting and managerial sign-offs.",
                )
            )

        # 2. Capital Lock-in Risk (EMD / Bid Security)
        emd_req = next(
            (
                r
                for r in requirements
                if any(k in r.title.lower() for k in ("emd", "earnest money", "bid security"))
            ),
            None,
        )
        if emd_req and estimated_value_inr_crores > 0:
            # Typical Indian procurement EMD is 1-2% of estimated value
            estimated_emd_crores = estimated_value_inr_crores * 0.02
            risks.append(
                RiskItem(
                    title="Working Capital Lock-in (EMD)",
                    severity=RiskSeverity.MEDIUM,
                    category="COMMERCIAL",
                    detail=(
                        f"Tender estimated value ₹{estimated_value_inr_crores:.2f} Cr implies estimated "
                        f"EMD requirement ~₹{estimated_emd_crores * 100:.1f} Lakhs locked during tender evaluation."
                    ),
                    mitigation_advice="Verify MSME exemption eligibility or arrange bank guarantee facility in advance.",
                )
            )

        # 3. Liquidated Damages & Penalty Clauses
        for r in requirements:
            text_lower = f"{r.title} {r.description}".lower()
            if any(
                k in text_lower for k in ("liquidated damages", "penalty", "delay compensation")
            ):
                risks.append(
                    RiskItem(
                        title="Onerous Liquidated Damages Terms",
                        severity=RiskSeverity.HIGH,
                        category="LIQUIDATED_DAMAGES",
                        detail=f"Tender contains stringent delay penalties: '{r.title}'.",
                        mitigation_advice="Buffer project schedule and assess subcontractor SLAs before commitment.",
                    )
                )

        return risks
