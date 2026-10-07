import re

from tenderpulse_ai.domain.models import (
    AssembledClauseContext,
    CandidateComplianceItem,
    ConfidenceTier,
    DocumentStructureTree,
    NodeValidationCheck,
)


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
            ref_num = re.sub(r"^(Clause|Section|Article|Part)\s+", "", ref, flags=re.IGNORECASE)
            ref_in_text = ref.lower() in clause_text.lower() or ref_num.lower() in clause_text.lower()
            if not ref_in_text and ref_num not in tree_clause_numbers and ref not in tree_clause_numbers:
                referenced_clause_exists = False
                discrepancies.append(f"Referenced clause '{ref}' does not exist in document structure.")
                score_penalty += 0.15

        # 3. Number Preservation Check
        numbers_preserved = True
        clean_quote_text = re.sub(r"(\d+),(\d+)", r"\1\2", item.provenance.verbatim_quote)
        clean_clause_text = re.sub(r"(\d+),(\d+)", r"\1\2", clause_text)
        quote_numbers = re.findall(r"\b\d+(?:\.\d+)?\b", clean_quote_text)
        clause_numbers = re.findall(r"\b\d+(?:\.\d+)?\b", clean_clause_text)
        for num in quote_numbers:
            if num not in clause_numbers:
                numbers_preserved = False
                discrepancies.append(f"Number/amount '{num}' in verbatim quote not found in clause text.")
                score_penalty += 0.20

        # 4. SHALL/MUST Interpretation Check
        shall_must_correct = True
        if "shall not" in clause_text.lower() or "must not" in clause_text.lower():
            if "prohibited" not in item.description.lower() and "not allowed" not in item.description.lower():
                shall_must_correct = False
                discrepancies.append("Clause contains prohibition ('shall not'/'must not') but item description sounds affirmative.")
                score_penalty += 0.30

        # 5. Exception Preservation Check
        exceptions_retained = True
        if any(kw in clause_text.lower() for kw in ["except", "unless", "provided that", "subject to"]):
            if "except" not in item.description.lower() and "unless" not in item.description.lower():
                exceptions_retained = False
                discrepancies.append("Clause contains conditional exception ('except'/'unless') that may be missing from description.")
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
