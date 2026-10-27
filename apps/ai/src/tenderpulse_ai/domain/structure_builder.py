import re

from tenderpulse_ai.domain.models import (
    DoclingParsedDocument,
    DocumentStructureTree,
    SectionNode,
)

LINE_START_MAIN_CLAUSE_RE = re.compile(
    r"^\s*(?:"
    r"(?P<kw>(?i:Sub-Clause|Clause|Article|Section|Schedule|Chapter|Rule|Paragraph|Para|Item|PQ))"
    r"\s*[-–—.:]?\s*(?P<knum>\d{1,3}(?:\.\d{1,3})*[A-Z]?|[IVXLC]{1,7})\b"
    r"(?:\s*(?P<ksub>\([A-Za-z\d]{1,4}\)))?"
    r"|(?!\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b)(?!\d+\.\d{3}\b)"
    r"(?P<num>\d{1,3}(?:\.\d{1,3}){0,3})[.)]\s+(?:(?P<inline_sub>\([A-Za-z\d]{1,4}\))\s*)?(?=[A-Z(“\"'])"
    r")"
)

LINE_START_SUB_CLAUSE_RE = re.compile(
    r"^\s*(?:"
    r"(?P<section_letter>[A-Z])\.\s+(?=[A-Z])"  # "A. Eligibility ...", "C. Technical ..."
    r"|(?i:Note)\s*:?\s*(?P<note>\(\d{1,2}\))"  # "Note: (1) ..."
    r"|(?P<paren>\([A-Za-z\d]{1,4}\))\s*(?=[A-Z(“\"'])"  # "(B) In addition", "(v) The ...", "(3) In case"
    r"|(?P<tok>[ivxlc]{1,6}|[a-z])[.)]\s+(?=[A-Z])"  # "xv. Providing", "a. The selected"
    r")"
)

_ROMAN_TOKEN_RE = re.compile(r"^[ivxlc]{1,6}$")
# Unnumbered all-caps division heading: starts a new part whose numbering is independent.
_DIVISION_HEADING_RE = re.compile(r"^[A-Z][A-Z&'’,\- ]{5,60}$")


class ClauseTracker:
    """Document-agnostic positional clause tracker.

    Fed blocks in reading order, it keeps a parent stack (division > main clause >
    section letter > sub-item) using ONLY line-start structural markers, so mid-sentence
    mentions ("as per Annexure-III", "circular no. 18.75/2021") can never become a
    clause's identity. Bare numbers that run backwards ("1." inside Clause 13's
    eligibility table) are treated as sub-items of the active clause, not a reset.
    """

    def __init__(self) -> None:
        self.division: str | None = None
        self.main: str | None = None
        self.main_label: str = "Clause"
        self.letter: str | None = None
        self.sub: str | None = None
        self.sub_style: str | None = None
        self.parent_sub: str | None = None
        self.parent_style: str | None = None
        self.last_text = ""
        self.started_main = False

    def reset_division(self, label: str | None) -> None:
        self.division = label
        self.main = self.letter = self.sub = self.sub_style = None
        self.parent_sub = self.parent_style = None

    def _accept_numbered_main(self, num: str) -> bool:
        if self.main is None:
            return True
        try:
            cur_top = int(self.main.split(".")[0])
            new_top = int(num.split(".")[0])
        except ValueError:
            return True
        if "." in num:  # "54.1" is a full clause identifier, never a table-row index
            return num != self.main
        return cur_top <= new_top <= cur_top + 10 and num != self.main

    _SEQUENCE_STARTS = {"a", "i", "1", "A", "I"}

    def _style_of(self, token: str, wrapper: str) -> str:
        """'(ii)' -> 'paren-roman', '(a)' -> 'paren-alpha', 'xv.' -> 'dot-roman', '1.' -> 'dot-num'."""
        if token.isdigit():
            kind = "num"
        elif token.isupper() and len(token) == 1 and token not in "IVX":
            kind = "upper"
        else:
            prev_alpha = (
                self.sub is not None
                and self.sub_style is not None
                and self.sub_style.endswith("alpha")
                and len(token) == 1
                and len(self.sub) == 1
                and ord(token.lower()) == ord(self.sub.lower()) + 1
            )
            kind = "roman" if _ROMAN_TOKEN_RE.match(token.lower()) and not prev_alpha else "alpha"
        return f"{wrapper}-{kind}"

    def _set_sub(self, token: str, wrapper: str) -> None:
        """Siblings replace the active sub-item; a list opened by an introducing item
        ("The following ...", "...:") nests under it: Clause 13.C(ii)(a)."""
        style = self._style_of(token, wrapper)
        introduces = bool(re.search(r"(?::\s*$|\bfollowing\b)", self.last_text, re.I))
        if (
            self.sub is not None
            and self.parent_sub is None
            and style != self.sub_style
            and token in self._SEQUENCE_STARTS
            and introduces
        ):
            self.parent_sub, self.parent_style = self.sub, self.sub_style
        elif style == self.parent_style or style != self.sub_style:
            self.parent_sub = self.parent_style = None
        self.sub, self.sub_style = token, style

    def feed(self, text: str) -> str | None:
        """Consumes one block's text and returns the clause path that block belongs to."""
        self.started_main = False
        line = (text or "").lstrip()
        if _DIVISION_HEADING_RE.match(line):  # "SCOPE OF WORK", "GENERAL CONDITIONS OF CONTRACT"
            self.reset_division(None)
        main_m = LINE_START_MAIN_CLAUSE_RE.match(line)
        if main_m and main_m.group("kw"):
            kw = main_m.group("kw").title()
            knum = main_m.group("knum")
            if kw in ("Section", "Chapter") and "." not in knum:
                self.reset_division(f"{kw} {knum}")  # "Section IV", "Chapter 3" restart numbering
            else:
                self.main_label = {"Sub-Clause": "Clause", "Para": "Paragraph"}.get(kw, kw)
                self.main = knum
                self.letter = self.sub = self.sub_style = None
                self.parent_sub = self.parent_style = None
                self.started_main = True
                if main_m.group("ksub"):
                    self._set_sub(main_m.group("ksub")[1:-1], "paren")
        elif main_m and main_m.group("num"):
            # Dates (22.01.2026) and chainages (87.000) are excluded by the regex lookaheads.
            num = main_m.group("num")
            if self._accept_numbered_main(num):
                self.main_label, self.main = "Clause", num
                self.letter = self.sub = self.sub_style = None
                self.parent_sub = self.parent_style = None
                self.started_main = True
                if main_m.group("inline_sub"):
                    self._set_sub(main_m.group("inline_sub")[1:-1], "paren")
            else:
                self._set_sub(num, "dot")
        else:
            sub_m = LINE_START_SUB_CLAUSE_RE.match(line)
            if sub_m and self.main is not None:
                if sub_m.group("section_letter"):
                    self.letter, self.sub, self.sub_style = (
                        sub_m.group("section_letter"),
                        None,
                        None,
                    )
                    self.parent_sub = self.parent_style = None
                elif sub_m.group("note"):
                    self._set_sub(sub_m.group("note")[1:-1], "paren")
                elif sub_m.group("paren"):
                    self._set_sub(sub_m.group("paren")[1:-1], "paren")
                elif sub_m.group("tok"):
                    self._set_sub(sub_m.group("tok"), "dot")
        self.last_text = line[-160:]
        return self.path()

    def path(self) -> str | None:
        if self.main is None:
            return self.division
        ref = f"{self.main_label} {self.main}"
        if self.letter:
            ref += f".{self.letter}"
        if self.parent_sub:
            ref += f"({self.parent_sub})"
        if self.sub:
            ref += f"({self.sub})"
        return ref


class DocumentStructureBuilder:
    """Node 2 - Build document structure (non-LLM AST Generator).

    Identifies section hierarchy deterministically:
    PART I
     ├── Section 1
     │    ├── 1.1
     │    ├── 1.2
     │    └── 1.3
     └── Section 2
    """

    # Regex patterns for arbitrary document hierarchy & section titles
    PART_PATTERN = re.compile(
        r"^(PART\s*[-–—]?\s*[IVXLC\d]+\b|SCHEDULE\s*[-–—]?\s*[A-Za-z\dIVX]+|ANNEXURE\s*[-–—]?\s*[A-Za-z\d]+|APPENDIX\s*[-–—]?\s*[A-Za-z\d]+)",
        re.IGNORECASE,
    )
    SECTION_PATTERN = re.compile(r"^(SECTION\s+[\dA-Za-z]+|ARTICLE\s+[\dA-Za-z]+)", re.IGNORECASE)
    GUARDED_CLAUSE_PATTERN = re.compile(
        r"^(?:"
        r"(?:(?:GC|CC|GCC|SCC|ITB|BDS)\s*)?(?:Clause|Sub-Clause|Article|Section|Schedule|Annexure|Appendix|Table|PQ|Item)\s*[-–—:]?\s*(?:No\.?[ \t]*)?([A-Za-z\d]+(?:\.[A-Za-z\d]+)*)"
        r"|"
        r"([1-6]?\d(?:\.\d+){0,3})[.)]\s+([A-Z][A-Za-z0-9\s—–-]{2,})"
        r")",
        re.IGNORECASE,
    )
    CLAUSE_PATTERN = GUARDED_CLAUSE_PATTERN

    @staticmethod
    def _is_invalid_clause_candidate(text: str) -> bool:
        cleaned = text.strip()

        # 1. Calendar dates at start: 22.01.2026, 19.02.2026
        if re.match(r"^\d{1,2}\.\d{1,2}\.\d{2,4}\b", cleaned):
            return True

        # 2. Bare decimals at start: 0.5, 0.25
        if re.match(r"^0\.\d+\b", cleaned):
            return True

        # 3. Physical measurements / monetary values at start: 50 km, 100 meters
        if re.match(
            r"^\d+(?:\.\d+)?\s*(?:km|kms|mtr|meters|hrs|hours|am|pm|crore|crores|cr|lakh|lakhs|%|percent)\b",
            cleaned,
            re.IGNORECASE,
        ):
            return True

        # 4. Standalone or leading road chainages:
        # e.g., "Km. 87.000", "Ch. 12.000", "Chainage 348.000"
        if re.match(r"^(?:Km\.?|Ch\.?|Chainage)\s*\d+", cleaned, re.IGNORECASE):
            return True

        # 5. Chainage ranges at start:
        # e.g., "348.000 to 398.000", "Km. 87.000 to Km. 120.000", "12.000 - 15.000"
        if re.match(
            r"^(?:Km\.?\s*)?\d+(?:\.\d{3})?\s*(?:to|-)\s*(?:Km\.?\s*)?\d+(?:\.\d{3})?\b",
            cleaned,
            re.IGNORECASE,
        ):
            return True

        # 6. Standalone 2-digit / 3-digit decimal chainages (3-decimal place meter markers):
        # e.g., "12.000. Road Section", "48.000. Highway Construction", "348.000."
        if re.match(r"^\d{1,4}\.\d{3}\b", cleaned):
            return True

        # 7. Table items / bank detail lines:
        # e.g., "1. Name of Beneficiary", "2. Account No.", "3. Type of Account", "4. Name of Bank", "5. Branch IFSC"
        if re.match(
            r"^\d+[.)]\s+(?:Name of\s+(?:Beneficiary|Bank)|Account\s+No|Type of\s+Account|Name of Bank|Branch\s+IFSC|IFSC\s+CODE)\b",
            cleaned,
            re.IGNORECASE,
        ):
            return True

        return False

    def build_structure(self, doc: DoclingParsedDocument) -> DocumentStructureTree:
        tree = DocumentStructureTree(document_id=doc.document_id, nodes=[])

        current_part: SectionNode | None = None
        current_section: SectionNode | None = None
        current_clause: SectionNode | None = None

        node_counter = 1
        tracker = ClauseTracker()

        for block in doc.blocks:
            text = block.text.strip()

            part_match = self.PART_PATTERN.search(text)
            section_match = self.SECTION_PATTERN.search(text)
            if part_match:
                tracker.reset_division(part_match.group(1).upper())
            block_path = tracker.feed(text)
            if block_path:
                tree.block_paths[block.block_id] = block_path

            clause_match = None
            if not self._is_invalid_clause_candidate(text):
                clause_match = self.GUARDED_CLAUSE_PATTERN.search(text)
                # A bare number that runs backwards ("1." inside Clause 13's table) is a
                # sub-item of the active clause, not a new clause node.
                if clause_match and not clause_match.group(1) and not tracker.started_main:
                    clause_match = None

            if part_match:
                node_id = f"sec_node_{node_counter}"
                node_counter += 1
                current_part = SectionNode(
                    node_id=node_id,
                    number=part_match.group(1).upper(),
                    title=text,
                    level=1,
                    parent_id=None,
                    block_ids=[block.block_id],
                )
                tree.nodes.append(current_part)
                current_section = None
                current_clause = None

            elif section_match:
                node_id = f"sec_node_{node_counter}"
                node_counter += 1
                parent_id = current_part.node_id if current_part else None
                current_section = SectionNode(
                    node_id=node_id,
                    number=section_match.group(1).upper(),
                    title=text,
                    level=2,
                    parent_id=parent_id,
                    block_ids=[block.block_id],
                )
                tree.nodes.append(current_section)
                current_clause = None

            elif clause_match or tracker.started_main:
                clause_number = (
                    ((clause_match.group(1) or clause_match.group(2)) if clause_match else None)
                    or tracker.main
                    or "Clause"
                )
                node_id = f"sec_node_{node_counter}"
                node_counter += 1
                parent_id = (
                    current_section.node_id
                    if current_section
                    else (current_part.node_id if current_part else None)
                )
                current_clause = SectionNode(
                    node_id=node_id,
                    number=clause_number,
                    title=text,
                    level=3,
                    parent_id=parent_id,
                    block_ids=[block.block_id],
                )
                tree.nodes.append(current_clause)

            else:
                # Assign block to active section/clause
                target_node = current_clause or current_section or current_part
                if target_node:
                    target_node.block_ids.append(block.block_id)

        # Fallback root node if no structural headings were found
        if not tree.nodes:
            fallback = SectionNode(
                node_id="sec_node_root",
                number="DOCUMENT_ROOT",
                title="General Document Content",
                level=1,
                parent_id=None,
                block_ids=[b.block_id for b in doc.blocks],
            )
            tree.nodes.append(fallback)

        return tree
