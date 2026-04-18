from __future__ import annotations

import json
import logging
from typing import Any

try:
    from backend.agents.research_orchestrator import _llm_text
    from backend.config.settings import get_settings
except ModuleNotFoundError:  # pragma: no cover - supports execution from backend/
    from agents.research_orchestrator import _llm_text
    from config.settings import get_settings

LOGGER = logging.getLogger(__name__)


def _normalize_items(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    return [str(value).strip() for value in values if str(value).strip()]


def _paper_reference_lines(report_json: dict[str, Any]) -> list[str]:
    paper_summaries = report_json.get("paper_summaries")
    if not isinstance(paper_summaries, list):
        return []

    references: list[str] = []
    for paper in paper_summaries:
        if not isinstance(paper, dict):
            continue
        title = str(paper.get("title") or "").strip()
        if not title:
            continue
        authors = paper.get("authors") if isinstance(paper.get("authors"), list) else []
        author_text = ", ".join(str(author).strip() for author in authors[:4] if str(author).strip()) or "Unknown authors"
        year = paper.get("year")
        year_text = str(year).strip() if year is not None else "n.d."
        source = str(paper.get("source") or "").strip()
        source_suffix = f" {source}." if source else "."
        references.append(f"{author_text} ({year_text}). {title}.{source_suffix}")
    return references


def _build_fallback_academic_report(topic: str, report_json: dict[str, Any]) -> str:
    executive_summary = str(report_json.get("executive_summary") or "").strip() or (
        "A structured executive summary was not available in the generated report."
    )
    key_findings = _normalize_items(report_json.get("key_findings"))
    methods_landscape = _normalize_items(report_json.get("methods_landscape"))

    evidence = report_json.get("evidence_comparison") if isinstance(report_json.get("evidence_comparison"), dict) else {}
    common_evidence = _normalize_items(evidence.get("common_evidence"))
    consensus_trends = _normalize_items(evidence.get("consensus_trends"))

    contradictions = report_json.get("contradictions_found") if isinstance(report_json.get("contradictions_found"), dict) else {}
    contradiction_explanation = str(contradictions.get("explanation") or "").strip()
    contradiction_found = bool(contradictions.get("contradiction_found"))

    gaps = report_json.get("research_gaps") if isinstance(report_json.get("research_gaps"), dict) else {}
    high_priority_gaps = _normalize_items(gaps.get("high_priority"))
    medium_priority_gaps = _normalize_items(gaps.get("medium_priority"))
    emerging_gaps = _normalize_items(gaps.get("emerging"))
    future_directions = _normalize_items(report_json.get("future_research_directions"))
    references = _paper_reference_lines(report_json)

    sections: list[str] = []
    sections.append("EXECUTIVE SUMMARY")
    sections.append(executive_summary)
    sections.append("")

    sections.append("INTRODUCTION")
    sections.append(
        f"This report synthesizes the Smart Researcher findings for {topic}. "
        "It consolidates the retrieved literature, extracted findings, cross-paper evidence, and identified research priorities."
    )
    sections.append("")

    sections.append("CURRENT RESEARCH LANDSCAPE")
    landscape_points = key_findings or common_evidence or ["The current research landscape could not be expanded beyond the generated report summary."]
    sections.extend(f"- {point}" for point in landscape_points[:6])
    sections.append("")

    sections.append("METHODOLOGICAL TRENDS")
    method_points = methods_landscape or ["Methodological trends were not explicitly identified in the generated report."]
    sections.extend(f"- {point}" for point in method_points[:8])
    sections.append("")

    sections.append("CRITICAL CHALLENGES")
    challenge_points = []
    if contradiction_found and contradiction_explanation:
        challenge_points.append(contradiction_explanation)
    challenge_points.extend(high_priority_gaps[:3])
    challenge_points.extend(medium_priority_gaps[:2])
    if not challenge_points:
        challenge_points = ["Critical challenges were not clearly separated in the generated report."]
    sections.extend(f"- {point}" for point in challenge_points[:6])
    sections.append("")

    sections.append("EMERGING RESEARCH GAPS")
    gap_points = high_priority_gaps + medium_priority_gaps + emerging_gaps
    if not gap_points:
        gap_points = ["Emerging research gaps were not explicitly identified in the generated report."]
    sections.extend(f"- {point}" for point in gap_points[:8])
    sections.append("")

    sections.append("FUTURE RESEARCH DIRECTIONS")
    direction_points = future_directions or _normalize_items(gaps.get("identified_gaps")) or [
        "Future research directions were not explicitly identified in the generated report."
    ]
    sections.extend(f"- {point}" for point in direction_points[:8])
    sections.append("")

    sections.append("SELECTED REFERENCES")
    if references:
        sections.extend(f"- {reference}" for reference in references[:10])
    else:
        sections.append("- No reference-ready paper metadata was available in the generated report.")

    return "\n".join(sections).strip()


def generate_academic_report_text(topic: str, report_json: dict[str, Any]) -> str:
    """Takes the raw Smart Researcher API response and converts it into a formal academic report via LLM."""
    settings = get_settings()

    prompt = (
        f"You are a professional research analyst. Convert the following AI agent outputs into a formal, "
        f"professional academic research report for the topic: '{topic}'.\n\n"
        "REQUIRED SECTIONS:\n"
        "1. Executive Summary\n"
        "2. Introduction\n"
        "3. Current Research Landscape\n"
        "4. Methodological Trends\n"
        "5. Critical Challenges\n"
        "6. Emerging Research Gaps\n"
        "7. Future Research Directions\n"
        "8. Selected References\n\n"
        "RULES:\n"
        "- Write in an authoritative, formal academic tone.\n"
        "- Do NOT use markdown headings (no #). Just write the section title in all CAPS on its own line.\n"
        "- Separate paragraphs with a blank line.\n"
        "- Do not include raw JSON or mention 'AI agents'. Synthesize the data into a coherent narrative.\n"
        "- Base ALL claims on the provided unstructured data below.\n"
        "- Do not invent citations. Use only the papers provided.\n\n"
        f"RAW DATA:\n{json.dumps(report_json, indent=2)[:30000]}\n"
    )

    try:
        text, _provider = _llm_text(
            prompt,
            "You are an expert academic writer. Produce only the formal text requested, no introductory chatter.",
            settings,
            agent_name="Academic Export",
            preferred_gemini_slot="secondary",
        )
    except Exception:
        LOGGER.exception("Academic export LLM generation failed. Falling back to deterministic formatter.")
        text = None

    if text:
        return text

    LOGGER.warning("Academic export is using deterministic fallback text for topic %r.", topic)
    return _build_fallback_academic_report(topic, report_json)
