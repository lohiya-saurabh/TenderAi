"""Bidder-task attributes of a requirement (what to do, when, how much, who is involved).

The model may state these per item; every value is kept only when it is a known enum value
and, for numbers, when the number literally appears in the item's verbatim quote. A value the
quote does not support is dropped (``None`` = "not stated"), never guessed or defaulted.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

from pydantic import BaseModel, Field

OBLIGATION_TYPES = {
    "ELIGIBILITY",
    "DOCUMENT",
    "FORMALITY",
    "DEADLINE",
    "FINANCIAL_COMMITMENT",
    "PENALTY",
    "COVENANT",
    "INFO",
}
ACTIONS = {"ATTACH_DOCUMENT", "PRICE_IN_BOQ", "UNDERTAKE", "INFO_ONLY"}
STAGES = {
    "PRE_BID",
    "WITH_BID_ONLINE",
    "WITH_BID_PHYSICAL",
    "ON_CLARIFICATION",
    "POST_AWARD",
    "EXECUTION",
}
PARTIES = {"BIDDER", "CA_AUDITOR", "PAST_CLIENT", "NOTARY", "BANK", "JV_PARTNER"}
MANDATORY = {"MANDATORY", "DESIRABLE"}
DEADLINE_ANCHORS = {"BID_DUE", "LOA", "AWARD", "AGREEMENT", "BID_END"}


class Deadline(BaseModel):
    kind: str  # ABSOLUTE | RELATIVE
    date: str | None = None  # as written in the tender, e.g. "30.11.2026 11:00"
    anchor: str | None = None
    offset_days: int | None = None


class Amount(BaseModel):
    inr: float | None = None
    percent: float | None = None
    basis: str | None = None


class RequirementAttributes(BaseModel):
    obligation_type: str | None = None
    action: str | None = None
    stage: str | None = None
    parties: list[str] = Field(default_factory=list)
    mandatory: str | None = None
    disqualifying: bool | None = None
    deadline: Deadline | None = None
    amount: Amount | None = None
    form_ref: str | None = None

    def to_api(self) -> dict[str, Any]:
        return {
            "obligationType": self.obligation_type,
            "action": self.action,
            "stage": self.stage,
            "parties": list(self.parties),
            "mandatory": self.mandatory,
            "disqualifying": self.disqualifying,
            "deadline": (
                {
                    "kind": self.deadline.kind,
                    "date": self.deadline.date,
                    "anchor": self.deadline.anchor,
                    "offsetDays": self.deadline.offset_days,
                }
                if self.deadline
                else None
            ),
            "amount": (
                {
                    "inr": self.amount.inr,
                    "percent": self.amount.percent,
                    "basis": self.amount.basis,
                }
                if self.amount
                else None
            ),
            "formRef": self.form_ref,
        }


def _enum(value: Any, allowed: set[str]) -> str | None:
    v = str(value or "").strip().upper().replace(" ", "_").replace("-", "_")
    return v if v in allowed else None


def _number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return None


def _digits(text: str) -> str:
    """Digits-only form of a text, for locale-independent number grounding."""
    return re.sub(r"\D", "", text)


def _number_in_quote(number: float, quote: str) -> bool:
    """True when the number is written in the quote (1,50,000 / 150000 / 1.5 / 5%).

    Amounts written in words or as "1.5 crore" are not converted: the attribute is dropped
    rather than computed, so the user reads the quote instead of a derived figure.
    """
    as_int = int(number) if float(number).is_integer() else None
    candidates = {f"{number:g}"}
    if as_int is not None:
        candidates.add(str(as_int))
    numbers_in_quote = {
        _digits(m) if "." not in m else m.replace(",", "")
        for m in re.findall(r"\d[\d,]*(?:\.\d+)?", quote)
    }
    return any(c.replace(",", "") in numbers_in_quote for c in candidates)


def parse_attributes(raw: dict[str, Any], quote: str) -> RequirementAttributes:
    """Builds grounded attributes from one raw model item (unknown or unsupported -> None)."""
    attrs = RequirementAttributes(
        obligation_type=_enum(
            raw.get("obligation") or raw.get("obligation_type"), OBLIGATION_TYPES
        ),
        action=_enum(raw.get("action"), ACTIONS),
        stage=_enum(raw.get("stage"), STAGES),
        mandatory=_enum(raw.get("mandatory"), MANDATORY),
    )
    parties = raw.get("parties") or []
    if isinstance(parties, str):
        parties = [parties]
    attrs.parties = sorted({p for p in (_enum(x, PARTIES) for x in parties) if p})

    if raw.get("disqualifying") is True:
        attrs.disqualifying = True

    form_ref = str(raw.get("form_ref") or "").strip()
    if form_ref and form_ref.lower() in quote.lower():
        attrs.form_ref = form_ref

    dl = raw.get("deadline")
    if isinstance(dl, dict):
        date = str(dl.get("date") or "").strip()
        anchor = _enum(dl.get("anchor"), DEADLINE_ANCHORS)
        offset = _number(dl.get("offset_days"))
        quote_numbers = {n.lstrip("0") or "0" for n in re.findall(r"\d+", quote)}
        date_numbers = [n.lstrip("0") or "0" for n in re.findall(r"\d+", date)]
        if date_numbers and all(n in quote_numbers for n in date_numbers):
            attrs.deadline = Deadline(kind="ABSOLUTE", date=date)
        elif anchor and offset is not None and _number_in_quote(offset, quote):
            attrs.deadline = Deadline(kind="RELATIVE", anchor=anchor, offset_days=int(offset))

    am = raw.get("amount")
    if isinstance(am, dict):
        inr = _number(am.get("inr"))
        pct = _number(am.get("percent"))
        basis = str(am.get("basis") or "").strip() or None
        inr = inr if inr is not None and inr > 0 and _number_in_quote(inr, quote) else None
        pct = pct if pct is not None and 0 < pct <= 100 and _number_in_quote(pct, quote) else None
        if inr is not None or pct is not None:
            attrs.amount = Amount(inr=inr, percent=pct, basis=basis if pct is not None else None)
    return attrs


def location_key(document_id: str, page_number: int, quote: str) -> str:
    """Stable clause identity from where it is in the tender (never from its AI title)."""
    norm = " ".join(quote.lower().split())
    digest = hashlib.sha256(f"{document_id}|{page_number}|{norm}".encode()).hexdigest()[:24]
    return f"cl_{digest}"


__all__ = ["RequirementAttributes", "parse_attributes", "location_key"]
