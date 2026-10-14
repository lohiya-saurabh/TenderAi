import re
from typing import Any

from tenderpulse_ai.corrigendum.models import ChangeType, ClauseChange, DriftSeverity


class CorrigendumDiffEngine:
    """
    Deterministic AST & Clause Diffing Engine.
    Compares original tender requirements against corrigendum clauses to isolate exact amendments.
    """

    DATE_PATTERNS = re.compile(
        r"(?:submission\s+date|last\s+date|closing\s+date|extended\s+up\s+to|validity)",
        re.IGNORECASE,
    )

    CRITICAL_KEYWORDS = {"turnover", "debarment", "blacklisting", "experience", "oem", "consortium"}
    HIGH_KEYWORDS = {"emd", "guarantee", "stamp", "notary", "udin", "submission date", "last date"}

    def diff_clauses(
        self,
        original_clauses: dict[str, str],
        corrigendum_text: str,
    ) -> list[ClauseChange]:
        """
        Parses corrigendum text into amendment entries and compares against original_clauses map.
        original_clauses: { "Clause 4.1": "The bidder must have turnover of INR 50 Cr..." }
        """
        changes: list[ClauseChange] = []

        # Split corrigendum text into logical clause blocks
        lines = [line.strip() for line in corrigendum_text.splitlines() if line.strip()]

        current_ref = "General Corrigendum"
        current_lines: list[str] = []
        parsed_blocks: list[tuple[str, str]] = []

        for line in lines:
            clause_match = re.match(
                r"^(?:item\s+no\.?\s*\d+|clause\s+\d+(?:\.\d+)*|section\s+\d+|amendment\s+to\s+clause\s+\d+(?:\.\d+)*)",
                line,
                re.IGNORECASE,
            )
            if clause_match:
                if current_lines:
                    parsed_blocks.append((current_ref, " ".join(current_lines)))
                    current_lines = []
                current_ref = clause_match.group(0).title()
            current_lines.append(line)

        if current_lines:
            parsed_blocks.append((current_ref, " ".join(current_lines)))

        # Process each block against original clauses
        change_idx = 1
        for ref, text in parsed_blocks:
            # Skip title or preamble lines without substantive amendment content
            if re.match(r"^corrigendum(?:\s+no\.?\s*\d+)?$", text.strip(), re.IGNORECASE):
                continue

            # Check if text mentions a specific original clause (e.g., "Amendment to Clause 3.1")
            embedded_clause = re.search(
                r"(?:clause|section|item)\s+\d+(?:\.\d+)*", text, re.IGNORECASE
            )
            effective_ref = embedded_clause.group(0).title() if embedded_clause else ref

            orig_text = None
            norm_ref = self._normalize_ref(effective_ref)

            # Find best matching original clause
            for orig_key, orig_val in original_clauses.items():
                if self._normalize_ref(orig_key) == norm_ref or norm_ref in self._normalize_ref(
                    orig_key
                ):
                    orig_text = orig_val
                    break

            # Classify Change Type
            if self.DATE_PATTERNS.search(text):
                change_type = ChangeType.DEADLINE_CHANGE
            elif "deleted" in text.lower() or "withdrawn" in text.lower():
                change_type = ChangeType.DELETION
            elif orig_text is not None:
                change_type = ChangeType.MODIFICATION
            else:
                change_type = ChangeType.ADDITION

            # Determine Severity
            severity = DriftSeverity.MEDIUM
            text_lower = text.lower()
            if any(k in text_lower for k in self.CRITICAL_KEYWORDS):
                severity = DriftSeverity.CRITICAL
            elif (
                any(k in text_lower for k in self.HIGH_KEYWORDS)
                or change_type == ChangeType.DEADLINE_CHANGE
            ):
                severity = DriftSeverity.HIGH

            # Extract delta if numbers present
            delta: dict[str, Any] = {}
            num_matches = re.findall(
                r"(?:inr|rs\.?)\s*([\d,]+(?:\.\d+)?)\s*(?:cr|crores|lakhs)?", text, re.IGNORECASE
            )
            if num_matches:
                delta["extracted_amounts"] = num_matches

            changes.append(
                ClauseChange(
                    change_id=f"chg_{change_idx}",
                    clause_reference=ref,
                    change_type=change_type,
                    category=self._categorize(text),
                    original_text=orig_text,
                    amended_text=text,
                    extracted_delta=delta,
                    severity=severity,
                    verbatim_quote=text[:250],
                )
            )
            change_idx += 1

        return changes

    def _normalize_ref(self, ref: str) -> str:
        return re.sub(r"[^a-z0-9]", "", ref.lower())

    def _categorize(self, text: str) -> str:
        t = text.lower()
        if "turnover" in t or "financial" in t:
            return "FINANCIAL"
        if "emd" in t or "guarantee" in t or "pbg" in t:
            return "SECURITIES"
        if "date" in t or "deadline" in t or "timeline" in t:
            return "TIMELINE"
        if "stamp" in t or "notary" in t or "udin" in t:
            return "STATUTORY_EXECUTION"
        if "experience" in t or "work order" in t:
            return "TECHNICAL"
        return "GENERAL"
