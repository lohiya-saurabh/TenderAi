import re

from tenderpulse_ai.domain.models import (
    AssembledClauseContext,
    CandidateComplianceItem,
    ConfidenceTier,
    DocumentStructureTree,
    NodeValidationCheck,
)


def _as_float(token: str) -> float | None:
    try:
        return float(token.replace(",", ""))
    except ValueError:
        return None


def _ordered_numbers(text: str) -> list[str]:
    return re.findall(r"\b\d[\d,]*(?:\.\d+)?\b", text or "")


def _numbers(text: str) -> set[float | None]:
    return {_as_float(n) for n in _ordered_numbers(text)}


class DeterministicValidator:
    """Node 6 & Node 7 - Validation and Confidence Scoring Engine.

    Checks:
    - Citation support (evidence verbatim match in candidate text)
    - Referenced clause existence in document tree
    - Preservation of numerical numbers/currencies
    - SHALL/MUST interpretation accuracy
    - Exceptions retention (except/unless)

    Calculates Confidence Score (0.0 to 1.0) and routes to:
    - AUTO_ACCEPT (>= 95%)
    - REVIEWER_VERIFICATION (80% - 94%)
    - MANDATORY_HUMAN_REVIEW (< 80%)
    """

    def validate_item(
        self,
        item: CandidateComplianceItem,
        context: AssembledClauseContext,
        tree: DocumentStructureTree,
    ) -> tuple[NodeValidationCheck, ConfidenceTier]:
        discrepancies: list[str] = []
        score_penalty: float = 0.0

        quote = item.provenance.verbatim_quote.strip()
        clause_text = context.current_clause.strip()

        # 1. Citation Support Check
        citation_supported = quote in clause_text or any(
            word in clause_text for word in quote.split() if len(word) > 4
        )
        if not citation_supported:
            discrepancies.append(f"Verbatim quote '{quote}' not fully supported by clause text.")
            score_penalty += 0.25

        # 2. Referenced Clause Existence Check
        referenced_clause_exists = True
        tree_clause_numbers = {n.number for n in tree.nodes}
        for ref in context.referenced_clauses:
            ref_num = re.sub(
                r"^(Clause|Sub-Clause|Section|Article|Part|Schedule|Annexure|Appendix)\s*[-–—]?\s*",
                "",
                ref,
                flags=re.IGNORECASE,
            )
            ref_in_text = (
                ref.lower() in clause_text.lower() or ref_num.lower() in clause_text.lower()
            )
            if (
                not ref_in_text
                and ref_num not in tree_clause_numbers
                and ref not in tree_clause_numbers
            ):
                referenced_clause_exists = False
                discrepancies.append(
                    f"Referenced clause '{ref}' does not exist in document structure."
                )
                score_penalty += 0.15

        # 3. Number Preservation Check: every figure in the quote AND in the generated
        # description must exist in the source clause (catches hallucinated amounts).
        numbers_preserved = True
        clause_numbers = _numbers(clause_text)
        quote_numbers = _ordered_numbers(item.provenance.verbatim_quote)
        supported = clause_numbers | _numbers(quote)  # a description may cite its own quote
        claimed = [(n, clause_numbers) for n in quote_numbers] + [
            (n, supported) for n in _ordered_numbers(item.description) if n not in quote_numbers
        ]
        for num, pool in claimed:
            if _as_float(num) not in pool:
                numbers_preserved = False
                where = "verbatim quote" if pool is clause_numbers else "description"
                discrepancies.append(f"Number/amount '{num}' in {where} not found in clause text.")
                score_penalty += 0.20

        # 4. SHALL/MUST Interpretation Check
        shall_must_correct = True
        desc_lower = item.description.lower()
        if ("shall not" in clause_text.lower() or "must not" in clause_text.lower()) and not any(
            neg in desc_lower
            for neg in (
                "prohibited",
                "not allowed",
                "shall not",
                "must not",
                "not permitted",
                "barred",
            )
        ):
            shall_must_correct = False
            discrepancies.append(
                "Clause contains prohibition ('shall not'/'must not') but item description sounds affirmative."
            )
            score_penalty += 0.30

        # 5. Exception Preservation Check
        exceptions_retained = True
        if any(
            kw in clause_text.lower() for kw in ["except", "unless", "provided that", "subject to"]
        ) and not any(
            kw in desc_lower for kw in ("except", "unless", "provided that", "subject to")
        ):
            exceptions_retained = False
            discrepancies.append(
                "Clause contains conditional exception ('except'/'unless') that may be missing from description."
            )
            score_penalty += 0.10

        final_score = max(0.0, min(1.0, 1.0 - score_penalty))

        # Assign Confidence Tier
        if final_score >= 0.95:
            tier = ConfidenceTier.AUTO_ACCEPT
        elif final_score >= 0.80:
            tier = ConfidenceTier.REVIEWER_VERIFICATION
        else:
            tier = ConfidenceTier.MANDATORY_HUMAN_REVIEW

        check = NodeValidationCheck(
            citation_supported=citation_supported,
            referenced_clause_exists=referenced_clause_exists,
            numbers_preserved=numbers_preserved,
            shall_must_correct=shall_must_correct,
            exceptions_retained=exceptions_retained,
            confidence_score=final_score,
            discrepancies=discrepancies,
        )

        return check, tier
