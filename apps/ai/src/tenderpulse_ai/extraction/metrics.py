from __future__ import annotations

import re
from typing import Any


def extract_temporal_durations(text: str) -> list[dict[str, Any]]:
    """Extracts arbitrary temporal durations from text (e.g., 30 days, 120 days, 910 days, 3 years).

    Document-driven, independent of any sample tender.
    """
    results: list[dict[str, Any]] = []
    # Pattern 1: number + unit with optional written words: e.g. "120 (one hundred and twenty) days"
    pattern_duration = re.compile(
        r"\b(\d+)\s*(?:\([^\)]+\)\s*)?(days?|weeks?|months?|years?|hours?)\b",
        re.IGNORECASE,
    )
    for m in pattern_duration.finditer(text):
        val = int(m.group(1))
        unit = m.group(2).lower()
        if not unit.endswith("s"):
            unit = f"{unit}s"
        results.append(
            {
                "value": val,
                "unit": unit,
                "source": m.group(0).strip(),
                "meaning": "duration",
            }
        )

    # Pattern 2: ordinal day from appointed/effective date (e.g. "910th (nine hundred and tenth) day")
    pattern_ordinal = re.compile(
        r"\b(\d+)(?:st|nd|rd|th)\s*(?:\([^\)]+\)\s*)?(day|month|year)\b",
        re.IGNORECASE,
    )
    for m in pattern_ordinal.finditer(text):
        val = int(m.group(1))
        unit = m.group(2).lower()
        if not unit.endswith("s"):
            unit = f"{unit}s"
        if not any(r["value"] == val for r in results):
            results.append(
                {
                    "value": val,
                    "unit": unit,
                    "source": m.group(0).strip(),
                    "meaning": "milestone_day",
                }
            )

    return results


def extract_monetary_amounts(text: str) -> list[dict[str, Any]]:
    """Extracts arbitrary monetary amounts from text (e.g., Rs. 40.09 crore, ₹25 lakh, 25,00,000, Rs. 2 crore).

    Document-driven, independent of any sample tender.
    Normalizes value_in_inr across all patterns for safe deduplication and comparison.
    """
    results: list[dict[str, Any]] = []

    # Pattern 1: Denominated amounts: Rs. / INR / ₹ with crore / lakh / thousand / million / billion
    pattern_denominated = re.compile(
        r"(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d+)?)\s*(crores?|cr\.?|lakhs?|lac|millions?|billions?|thousands?)",
        re.IGNORECASE,
    )
    for m in pattern_denominated.finditer(text):
        raw_num = m.group(1).replace(",", "")
        unit = m.group(2).lower()
        val = float(raw_num) if "." in raw_num else int(raw_num)
        norm_unit = "Crore" if "cr" in unit else ("Lakh" if "la" in unit else unit.capitalize())

        unit_mult = 1
        if "cr" in unit:
            unit_mult = 10_000_000
        elif "la" in unit:
            unit_mult = 100_000
        elif "thous" in unit:
            unit_mult = 1_000
        elif "mill" in unit:
            unit_mult = 1_000_000
        elif "bill" in unit:
            unit_mult = 1_000_000_000
        val_inr = float(val * unit_mult)

        results.append(
            {
                "value": val,
                "value_in_inr": val_inr,
                "unit": norm_unit.lower(),
                "formatted": f"Rs. {val} {norm_unit}",
                "currency": "INR",
                "source": m.group(0).strip(),
            }
        )

    # Pattern 2: Standalone number + lakh/crore without currency prefix (e.g. "25 lakh", "50 lakh", "2 crore")
    pattern_standalone_unit = re.compile(
        r"\b([\d,]+(?:\.\d+)?)\s*(crores?|cr\.?|lakhs?|lac)\b",
        re.IGNORECASE,
    )
    for m in pattern_standalone_unit.finditer(text):
        raw_num = m.group(1).replace(",", "")
        unit = m.group(2).lower()
        val = float(raw_num) if "." in raw_num else int(raw_num)
        norm_unit = "Crore" if "cr" in unit else "Lakh"
        val_inr = float(val * (10_000_000 if "cr" in unit else 100_000))

        if not any(abs(r.get("value_in_inr", 0) - val_inr) < 1.0 for r in results):
            results.append(
                {
                    "value": val,
                    "value_in_inr": val_inr,
                    "unit": norm_unit.lower(),
                    "formatted": f"Rs. {val} {norm_unit}",
                    "currency": "INR",
                    "source": m.group(0).strip(),
                }
            )

    # Pattern 3: Indian comma-separated figures: e.g. "25,00,000", "10,00,00,000"
    pattern_raw_currency = re.compile(
        r"(?:(?:Rs\.?|INR|₹)\s*)?([1-9]\d{0,1}(?:,\d{2})*,\d{3}(?:\.\d+)?)",
        re.IGNORECASE,
    )
    for m in pattern_raw_currency.finditer(text):
        raw_str = m.group(1)
        num_clean = raw_str.replace(",", "")
        val = float(num_clean) if "." in num_clean else int(num_clean)
        val_inr = float(val)

        if val >= 10000000:
            formatted = f"Rs. {val / 10000000:.2f} Crore".rstrip("0").rstrip(".")
        elif val >= 100000:
            formatted = f"Rs. {val / 100000:.2f} Lakh".rstrip("0").rstrip(".")
        else:
            formatted = f"Rs. {val:,}"

        if not any(abs(r.get("value_in_inr", 0) - val_inr) < 1.0 for r in results):
            results.append(
                {
                    "value": val,
                    "value_in_inr": val_inr,
                    "unit": "INR",
                    "formatted": formatted,
                    "currency": "INR",
                    "source": m.group(0).strip(),
                }
            )

    return results


def extract_percentages(text: str) -> list[dict[str, Any]]:
    """Extracts arbitrary percentages from text (e.g. 0.1%, 10%, 40%, 74%, 26%).

    Document-driven, independent of any sample tender.
    """
    results: list[dict[str, Any]] = []
    pattern = re.compile(
        r"(\d+(?:\.\d+)?)\s*(?:%\s*(?:\([^\)]+\))?|(?:per\s*cent|percent))",
        re.IGNORECASE,
    )
    for m in pattern.finditer(text):
        val = float(m.group(1))
        results.append(
            {
                "value": val,
                "unit": "percent",
                "formatted": f"{val}%",
                "source": m.group(0).strip(),
            }
        )
    return results
