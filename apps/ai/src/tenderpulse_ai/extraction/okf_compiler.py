from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field

from tenderpulse_ai.extraction.metrics import (
    extract_monetary_amounts,
    extract_percentages,
    extract_temporal_durations,
)


class OKFConceptNode(BaseModel):
    id: str
    canonical_ref_id: str
    category: str
    title: str
    is_mandatory: bool = True
    status: str = "VERIFIED"
    metrics: dict[str, Any] = Field(default_factory=dict)
    cross_references: dict[str, list[str]] = Field(default_factory=dict)
    provenance: dict[str, Any] = Field(default_factory=dict)
    execution_rules: dict[str, Any] = Field(default_factory=dict)
    contradictions: list[dict[str, Any]] = Field(default_factory=list)
    description: str
    verbatim_quote: str

    def to_markdown(self) -> str:
        """Renders the concept node as structured Markdown with YAML frontmatter."""
        frontmatter_lines = [
            "---",
            f"id: {self.id}",
            f'title: "{self.title}"',
            f"category: {self.category}",
            f"canonical_ref_id: {self.canonical_ref_id}",
            f"is_mandatory: {str(self.is_mandatory).lower()}",
            f"status: {self.status}",
        ]

        if self.metrics:
            frontmatter_lines.append("metrics:")
            for k, v in self.metrics.items():
                frontmatter_lines.append(f"  {k}: {v}")

        if self.cross_references:
            frontmatter_lines.append("cross_references:")
            for k, refs in self.cross_references.items():
                frontmatter_lines.append(f"  {k}: {refs}")

        if self.execution_rules:
            frontmatter_lines.append("execution_rules:")
            for k, v in self.execution_rules.items():
                frontmatter_lines.append(f"  {k}: {v}")

        frontmatter_lines.append("---")
        frontmatter = "\n".join(frontmatter_lines)

        body = (
            f"\n\n# {self.title}\n\n"
            f"## Plain English Summary\n{self.description}\n\n"
            f"## Verbatim Document Citation\n> {self.verbatim_quote}\n\n"
            f"**Clause Reference:** `{self.provenance.get('clauseReference', 'N/A')}` | "
            f"**Page:** {self.provenance.get('pageNumber', 'N/A')} | "
            f"**Confidence:** {self.provenance.get('confidenceScore', 1.0)}\n"
        )
        return frontmatter + body


class OKFBundle(BaseModel):
    tender_id: str
    index_markdown: str
    nodes: dict[str, OKFConceptNode]


def compile_tender_to_okf(
    items: list[dict[str, Any]],
    contradictions: list[dict[str, Any]],
    tender_metadata: dict[str, Any],
) -> OKFBundle:
    """Compiles verified compliance items into a linked Tender Open Knowledge Format (OKF) bundle."""
    tender_id = tender_metadata.get("document_id") or tender_metadata.get("bid_id", "tender_doc")
    file_name = tender_metadata.get("file_name", "tender.pdf")
    nodes: dict[str, OKFConceptNode] = {}

    table_rows: list[str] = []

    for item in items:
        title = item.get("title", "Requirement")
        category = item.get("category", "GENERAL")
        slug = re.sub(r"[^\w]+", "_", title.lower()).strip("_")
        node_id = f"okf_{category.lower()}_{slug}"
        clause_ref = (
            item.get("provenance", {}).get("clauseReference")
            or item.get("provenance", {}).get("sectionOrClause")
            or "Clause"
        )
        canonical_ref = f"{category.lower()}:{slug}"

        desc = item.get("description", "")
        quote = item.get("provenance", {}).get("verbatimQuote", "")

        # Extract structured metrics
        combined_text = f"{desc}\n{quote}"
        monetary = extract_monetary_amounts(combined_text)
        percentages = extract_percentages(combined_text)
        durations = extract_temporal_durations(combined_text)

        node_metrics: dict[str, Any] = {}
        if monetary:
            node_metrics["monetary_inr"] = monetary[0].get("value_in_inr")
            node_metrics["monetary_formatted"] = monetary[0].get("formatted")
        if percentages:
            node_metrics["percentage"] = percentages[0].get("value")
            node_metrics["percentage_formatted"] = percentages[0].get("formatted")
        if durations:
            node_metrics["duration_value"] = durations[0].get("value")
            node_metrics["duration_unit"] = durations[0].get("unit")

        # Map cross references
        outbound: list[str] = []
        if "contract data" in quote.lower() or "contract data" in desc.lower():
            outbound.append("contract_data")
        if "appendix" in quote.lower() or "appendix" in desc.lower():
            outbound.append("appendix_itb")
        if "nit" in quote.lower() or "nit" in desc.lower():
            outbound.append("nit_notice")

        concept_node = OKFConceptNode(
            id=node_id,
            canonical_ref_id=canonical_ref,
            category=category,
            title=title,
            is_mandatory=True,
            status="VERIFIED",
            metrics=node_metrics,
            cross_references={"outbound_refs": outbound, "inbound_refs": []},
            provenance=item.get("provenance", {}),
            execution_rules=item.get("executionRules", {}),
            contradictions=[c for c in contradictions if category.lower() in str(c).lower()],
            description=desc,
            verbatim_quote=quote,
        )
        nodes[node_id] = concept_node

        metric_display = (
            node_metrics.get("monetary_formatted")
            or node_metrics.get("percentage_formatted")
            or (
                f"{node_metrics.get('duration_value')} {node_metrics.get('duration_unit')}"
                if "duration_value" in node_metrics
                else "Document-defined"
            )
        )
        table_rows.append(
            f"| **{title}** | {category} | {metric_display} | `{clause_ref}` | [{node_id}](./concepts/{node_id}.md) |"
        )

    # Build index.md
    index_lines = [
        f"# Tender Knowledge Graph Index: {file_name}",
        "",
        "## Master Tender Metadata",
        f"- **Document ID:** `{tender_id}`",
        f"- **Source File:** `{file_name}`",
        f"- **Total Verified Concepts:** {len(nodes)}",
        "",
        "## Fast Metric & Obligation Summary",
        "| Requirement Parameter | Category | Extracted Value | Governing Clause | Concept Link |",
        "|---|---|---|---|---|",
    ]
    index_lines.extend(table_rows)

    if contradictions:
        index_lines.extend(
            [
                "",
                "## ⚠️ Intra-Document Contradictions & Ambiguities",
            ]
        )
        for c in contradictions:
            index_lines.append(f"- **{c.get('topic', 'Contradiction')}**: {c.get('detail', '')}")
            if c.get("order_of_precedence_ruling"):
                index_lines.append(
                    f"  - *Order of Precedence Ruling:* {c['order_of_precedence_ruling']}"
                )

    index_markdown = "\n".join(index_lines)

    return OKFBundle(
        tender_id=tender_id,
        index_markdown=index_markdown,
        nodes=nodes,
    )


__all__ = [
    "OKFConceptNode",
    "OKFBundle",
    "compile_tender_to_okf",
]
