"""Fixture tender for the Phase 1 clause contract (synthetic text modelled on real traps).

Pages and the model's answers are scripted, so the pipeline, the real response parser
(``OpenAICompatibleClient._build_candidate``) and the wire payload are exercised end to end
without a network. Traps covered:
  - EMD stated as Rs. 7,500 (NIT, p.1) and Rs. 12,500 (Appendix, p.3)       -> conflict
  - Performance Security 5% (p.2) and 3% (SCC 7, p.4), both titled the same  -> 2 clauses, conflict
  - affidavit on Rs. 10 notarised stamp paper next to clauses with no attestation
  - UDIN turnover certificate in the format at Appendix XI (outside party: CA)
  - relative deadline (within 30 days of LOA) and absolute deadline (28.11.2026 11:00)
  - a clause with no clause number (p.5)
  - a page the model fails on (p.7, image-only) -> coverage + NEAR_FAILED_PAGE on p.6
  - a hallucinated amount (not in the quote) that must be dropped
"""

from __future__ import annotations

from typing import Any

DOCUMENT_ID = "doc_fixture_nit"
FILE_NAME = "Fixture_NIT_2026.pdf"
BID_ID = "bid_fixture"
FAILED_PAGE = 7

PAGES: list[str] = [
    # p.1 Notice Inviting Tender
    "NOTICE INVITING TENDER\n"
    "Clause 2 Earnest Money Deposit\n"
    "2.1 The bidder shall deposit Earnest Money of Rs. 7,500 through online payment, "
    "failing which the bid shall be rejected.\n"
    "Clause 3 Submission of originals\n"
    "3.1 The original Bid Security and Power of Attorney shall be submitted so as to reach the "
    "Authority on or before 11:00 hours on 28.11.2026, failing which the Bid shall be rejected.\n",
    # p.2 Conditions of contract
    "Clause 4 Performance Security\n"
    "4.1 The successful bidder shall furnish a Performance Security of 5% of the contract value "
    "within 30 days of issue of the Letter of Acceptance.\n",
    # p.3 Appendix I
    "Appendix I Earnest Money\n"
    "A1.1 The Earnest Money shall be Rs. 12,500, being 2.5% of the estimated value.\n"
    "A1.2 An affidavit on non-judicial stamp paper of Rs. 10, duly notarised, shall be furnished "
    "stating that the bidder is not blacklisted.\n"
    "A1.3 The turnover certificate shall be issued by the statutory auditor in the format at "
    "Appendix XI with UDIN.\n",
    # p.4 Special Conditions of Contract
    "Special Conditions of Contract\n"
    "SCC 7 Performance Security\n"
    "SCC 7.1 The Contractor shall furnish a Performance Security of 3% of the contract value.\n",
    # p.5 a clause without a clause number
    "Bid validity\nThe bid shall remain valid for 120 days from the bid due date.\n",
    # p.6 next to the page the model fails on
    "Clause 9 Defect liability\n"
    "9.1 The Contractor shall rectify all defects for a defect liability period of 24 months.\n",
    # p.7 image-only page (no usable model answer)
    "Scanned drawing sheet 7 of 7\n"
    "The Contractor shall follow the attached drawing for all works on site.\n",
]

# What the (scripted) model answers for each quote. Keys are the model's raw JSON fields.
ANSWERS: dict[str, dict[str, Any]] = {
    "The bidder shall deposit Earnest Money of Rs. 7,500 through online payment, failing which "
    "the bid shall be rejected.": {
        "category": "FINANCIAL",
        "title": "Earnest Money Deposit",
        "description": "Deposit EMD of Rs 7,500 online; without it the bid is rejected.",
        "obligation": "FINANCIAL_COMMITMENT",
        "action": "UNDERTAKE",
        "stage": "WITH_BID_ONLINE",
        "mandatory": "MANDATORY",
        "disqualifying": True,
        "amount": {"inr": 7500},
    },
    "The original Bid Security and Power of Attorney shall be submitted so as to reach the "
    "Authority on or before 11:00 hours on 28.11.2026, failing which the Bid shall be rejected.": {
        "category": "LEGAL",
        "title": "Physical originals deadline",
        "description": "Originals of bid security and power of attorney must reach by 28 Nov 2026 11:00.",
        "obligation": "DEADLINE",
        "action": "ATTACH_DOCUMENT",
        "stage": "WITH_BID_PHYSICAL",
        "mandatory": "MANDATORY",
        "disqualifying": True,
        "deadline": {"date": "28.11.2026 11:00"},
    },
    "The successful bidder shall furnish a Performance Security of 5% of the contract value "
    "within 30 days of issue of the Letter of Acceptance.": {
        "category": "FINANCIAL",
        "title": "Performance Security",
        "description": "Furnish performance security of 5% of contract value within 30 days of LOA.",
        "obligation": "FINANCIAL_COMMITMENT",
        "stage": "POST_AWARD",
        "parties": ["BANK"],
        "mandatory": "MANDATORY",
        "deadline": {"anchor": "LOA", "offset_days": 30},
        "amount": {"percent": 5, "basis": "contract value"},
    },
    "The Earnest Money shall be Rs. 12,500, being 2.5% of the estimated value.": {
        "category": "FINANCIAL",
        "title": "Earnest Money amount",
        "description": "EMD is Rs 12,500 (2.5% of estimated value).",
        "obligation": "FINANCIAL_COMMITMENT",
        "mandatory": "MANDATORY",
        "amount": {"inr": 12500, "percent": 2.5, "basis": "estimated value"},
    },
    "An affidavit on non-judicial stamp paper of Rs. 10, duly notarised, shall be furnished "
    "stating that the bidder is not blacklisted.": {
        "category": "LEGAL",
        "title": "Non-blacklisting affidavit",
        "description": "Affidavit on Rs 10 stamp paper, notarised, that the bidder is not blacklisted.",
        "obligation": "DOCUMENT",
        "action": "ATTACH_DOCUMENT",
        "stage": "WITH_BID_PHYSICAL",
        "parties": ["NOTARY"],
        "mandatory": "MANDATORY",
        "execution_rules": {
            "stamp_paper_required": True,
            "stamp_paper_denomination_inr": 10,
            "notarization_required": True,
        },
    },
    "The turnover certificate shall be issued by the statutory auditor in the format at "
    "Appendix XI with UDIN.": {
        "category": "FINANCIAL",
        "title": "Turnover certificate with UDIN",
        "description": "Statutory auditor certifies turnover in Appendix XI format with UDIN.",
        "obligation": "DOCUMENT",
        "action": "ATTACH_DOCUMENT",
        "parties": ["CA_AUDITOR"],
        "mandatory": "MANDATORY",
        "form_ref": "Appendix XI",
        "execution_rules": {"udin_required": True},
    },
    "The Contractor shall furnish a Performance Security of 3% of the contract value.": {
        "category": "FINANCIAL",
        "title": "Performance Security",
        "description": "Furnish performance security of 3% of contract value.",
        "obligation": "FINANCIAL_COMMITMENT",
        "mandatory": "MANDATORY",
        # hallucinated: 99,999 is not in the quote -> must be dropped, percent kept
        "amount": {"inr": 99999, "percent": 3, "basis": "contract value"},
    },
    "The bid shall remain valid for 120 days from the bid due date.": {
        "category": "LEGAL",
        "title": "Bid validity",
        "description": "Bid must stay valid for 120 days from the bid due date.",
        "obligation": "COVENANT",
        "mandatory": "MANDATORY",
        "deadline": {"anchor": "BID_DUE", "offset_days": 120},
    },
    "The Contractor shall rectify all defects for a defect liability period of 24 months.": {
        "category": "EXECUTION",
        "title": "Defect liability period",
        "description": "Contractor rectifies defects for 24 months.",
        "obligation": "COVENANT",
        "stage": "EXECUTION",
        "mandatory": "MANDATORY",
    },
}

EXPECTED_ITEM_COUNT = len(ANSWERS)
