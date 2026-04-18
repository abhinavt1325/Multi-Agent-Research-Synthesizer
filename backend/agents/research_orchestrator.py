"""
Smart Researcher — Research Orchestrator v2
============================================
Evidence-first pipeline: selects strongest papers, extracts structured findings
from each (objective / method / finding / limitation), passes rich evidence into
all analysis stages, and synthesises one coherent professional research briefing.

Pipeline
--------
1. Planner          → research decomposition
2. Literature Hunter → papers (up to 8 candidates)
3. Structured Reader → per-paper {objective, method, finding, limitation}
4. Evidence Comparator → cross-paper consensus using rich summaries
5. Contradiction Detector → findings comparison
6. Research Gap     → gaps informed by paper limitations
7. Key Findings     → 3–5 synthesised cross-cutting statements
8. Ranked Gaps      → high / medium / emerging priority classification
9. Recommended Dir  → single actionable next research direction
10. Executive Summary → final narrative synthesis
"""
from __future__ import annotations

import json
import logging
import socket
import ssl
from typing import Any
from urllib import error, request

try:
    from backend.agents.gemini_support import call_gemini_with_fallback
    from backend.config.settings import get_settings
    from backend.agents.planner_agent import run_planner_agent, PlannerAgentServiceError
    from backend.agents.literature_hunter import run_literature_hunter, LiteratureHunterServiceError
    from backend.agents.evidence_comparator import run_evidence_comparator, EvidenceComparatorServiceError
    from backend.agents.contradiction_detector import run_contradiction_detector, ContradictionDetectorServiceError
    from backend.agents.research_gap import run_research_gap, ResearchGapServiceError
except ModuleNotFoundError:  # pragma: no cover
    from agents.gemini_support import call_gemini_with_fallback
    from config.settings import get_settings
    from agents.planner_agent import run_planner_agent, PlannerAgentServiceError
    from agents.literature_hunter import run_literature_hunter, LiteratureHunterServiceError
    from agents.evidence_comparator import run_evidence_comparator, EvidenceComparatorServiceError
    from agents.contradiction_detector import run_contradiction_detector, ContradictionDetectorServiceError
    from agents.research_gap import run_research_gap, ResearchGapServiceError


LOGGER = logging.getLogger(__name__)

GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
GEMINI_GENERATE_CONTENT_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent"
)
REQUEST_TIMEOUT_SECONDS = 45
MAX_PAPERS_TO_SELECT = 5

# SSL context that bypasses certificate verification (required on Python 3.14/Windows)
_SSL_CTX: ssl.SSLContext = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

# Domain auto-detection keyword map
DOMAIN_MAP: dict[str, list[str]] = {
    "Medical AI": ["medical", "clinical", "health", "diagnosis", "patient", "hospital", "radiology", "therapy", "disease"],
    "Computer Vision": ["image", "vision", "detection", "segmentation", "visual", "cnn", "convolutional", "scan", "pixel"],
    "Natural Language Processing": ["language", "text", "nlp", "sentiment", "translation", "bert", "llm", "transformer", "semantic"],
    "Drug Discovery": ["drug", "molecule", "protein", "binding", "pharmaceutical", "compound", "therapeutic", "ligand"],
    "Genomics": ["genome", "gene", "dna", "rna", "genomic", "sequencing", "mutation", "expression"],
    "Robotics": ["robot", "autonomous", "navigation", "control", "manipulation", "actuator", "servo"],
    "Reinforcement Learning": ["reinforcement", "reward", "policy", "q-learning", "mdp", "environment", "agent"],
    "Education Technology": ["education", "student", "learning outcome", "pedagogy", "curriculum", "classroom"],
    "Climate & Sustainability": ["climate", "carbon", "emission", "environment", "sustainability", "energy", "renewable"],
    "Cybersecurity": ["security", "attack", "vulnerability", "encryption", "intrusion", "malware", "threat"],
}


# ─── Exception ────────────────────────────────────────────────────────────────

class OrchestratorError(RuntimeError):
    """Raised when the orchestrator pipeline encounters an unrecoverable error."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


# ─── HTTP / LLM utilities ─────────────────────────────────────────────────────

def _perform_json_request(url: str, headers: dict[str, str], body: dict[str, Any]) -> dict[str, Any]:
    api_req = request.Request(
        url, headers=headers, data=json.dumps(body).encode("utf-8"), method="POST"
    )
    try:
        with request.urlopen(api_req, timeout=REQUEST_TIMEOUT_SECONDS, context=_SSL_CTX) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        if exc.code == 401:
            raise OrchestratorError("Provider authentication failed.", status_code=502) from exc
        if exc.code == 429:
            raise OrchestratorError("Provider rate limit exceeded. Please retry shortly.", status_code=503) from exc
        raise OrchestratorError(f"API HTTP error {exc.code}", status_code=502) from exc
    except (TimeoutError, socket.timeout) as exc:
        raise OrchestratorError("API request timed out.", status_code=504) from exc
    except (error.URLError, json.JSONDecodeError) as exc:
        raise OrchestratorError(f"API request failed: {exc}", status_code=502) from exc


def _extract_json_object(raw: str) -> dict[str, Any]:
    candidate = raw.strip()
    if candidate.startswith("```"):
        lines = candidate.splitlines()
        if len(lines) >= 3:
            candidate = "\n".join(lines[1:-1]).strip()
    s, e = candidate.find("{"), candidate.rfind("}")
    if s == -1 or e == -1 or e < s:
        raise OrchestratorError("LLM response contained no valid JSON.", status_code=502)
    try:
        return json.loads(candidate[s : e + 1])
    except json.JSONDecodeError as exc:
        raise OrchestratorError("LLM JSON parse failed.", status_code=502) from exc


def _groq_text(payload: dict) -> str:
    try:
        return payload["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise OrchestratorError("Groq response shape unexpected.", status_code=502) from exc


def _gemini_text(payload: dict) -> str:
    try:
        parts = payload["candidates"][0]["content"]["parts"]
        return "\n".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise OrchestratorError("Gemini response shape unexpected.", status_code=502) from exc


def _call_groq_json(prompt: str, system: str, api_key: str) -> dict[str, Any]:
    payload = _perform_json_request(
        url=GROQ_CHAT_COMPLETIONS_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        body={
            "model": GROQ_MODEL, "temperature": 0.2,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        },
    )
    return _extract_json_object(_groq_text(payload))


def _call_gemini_json(prompt: str, api_key: str) -> dict[str, Any]:
    payload = _perform_json_request(
        url=GEMINI_GENERATE_CONTENT_URL,
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        body={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.2}},
    )
    return _extract_json_object(_gemini_text(payload))


def _call_groq_text(prompt: str, system: str, api_key: str) -> str:
    payload = _perform_json_request(
        url=GROQ_CHAT_COMPLETIONS_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        body={
            "model": GROQ_MODEL, "temperature": 0.3,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        },
    )
    return _groq_text(payload)


def _call_gemini_text(prompt: str, api_key: str) -> str:
    payload = _perform_json_request(
        url=GEMINI_GENERATE_CONTENT_URL,
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        body={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.3}},
    )
    return _gemini_text(payload)


def _llm_json(
    prompt: str,
    system: str,
    settings: Any,
    *,
    agent_name: str,
    preferred_gemini_slot: str = "secondary",
) -> dict[str, Any] | None:
    """Try Groq then Gemini; return parsed JSON dict or None on full failure."""
    if settings.groq_api_key:
        try:
            return _call_groq_json(prompt, system, settings.groq_api_key)
        except OrchestratorError:
            LOGGER.warning("Groq JSON call failed for %s; trying Gemini.", agent_name)
    if settings.has_gemini_api_key:
        try:
            return call_gemini_with_fallback(
                agent_name=agent_name,
                settings=settings,
                logger=LOGGER,
                preferred_slot=preferred_gemini_slot,
                call_with_api_key=lambda api_key: _call_gemini_json(prompt, api_key),
            )
        except OrchestratorError:
            LOGGER.warning("Gemini JSON call also failed for %s.", agent_name)
    return None


def _llm_text(
    prompt: str,
    system: str,
    settings: Any,
    *,
    agent_name: str,
    preferred_gemini_slot: str = "secondary",
) -> tuple[str, str] | tuple[None, None]:
    """Try Groq then Gemini; return (text, provider) or (None, None)."""
    if settings.groq_api_key:
        try:
            return _call_groq_text(prompt, system, settings.groq_api_key), "groq"
        except OrchestratorError:
            LOGGER.warning("Groq text call failed for %s; trying Gemini.", agent_name)
    if settings.has_gemini_api_key:
        try:
            return (
                call_gemini_with_fallback(
                    agent_name=agent_name,
                    settings=settings,
                    logger=LOGGER,
                    preferred_slot=preferred_gemini_slot,
                    call_with_api_key=lambda api_key: _call_gemini_text(prompt, api_key),
                ),
                "gemini",
            )
        except OrchestratorError:
            LOGGER.warning("Gemini text call also failed for %s.", agent_name)
    return None, None


# ─── Domain & confidence utilities ────────────────────────────────────────────

def _determine_dominant_domain(topic: str, papers: list[dict]) -> str:
    corpus = (topic + " " + " ".join(
        ((p.get("title") or "") + " " + (p.get("abstract") or ""))[:400]
        for p in papers[:5]
    )).lower()
    best_domain, best_score = "Research", 0
    for domain, keywords in DOMAIN_MAP.items():
        score = sum(corpus.count(kw) for kw in keywords)
        if score > best_score:
            best_score, best_domain = score, domain
    if best_score == 0:
        words = topic.strip().split()[:3]
        best_domain = " ".join(w.capitalize() for w in words)
    return best_domain


def _compute_confidence_score(papers_analyzed: int, evidence: dict, contradictions: dict) -> int:
    score = 20
    score += min(papers_analyzed * 12, 48)           # up to 48 pts for papers
    common = len(evidence.get("common_evidence", []))
    trends = len(evidence.get("consensus_trends", []))
    score += min((common + trends) * 3, 20)           # up to 20 pts for evidence richness
    if contradictions.get("contradiction_found"):
        level = contradictions.get("confidence_level", "low")
        score -= {"high": 15, "medium": 8}.get(level, 3)
    return max(20, min(95, score))


def _derive_conflict_level(contradictions: dict) -> str:
    if not contradictions.get("contradiction_found", False):
        return "low"
    return "high" if contradictions.get("confidence_level") == "high" else "medium"


# ─── Paper selection ──────────────────────────────────────────────────────────

def _score_paper(paper: dict) -> float:
    score = 0.0
    abstract = (paper.get("abstract") or "").strip()
    score += 3.0 if len(abstract) > 100 else (1.5 if abstract else 0.0)
    year = paper.get("year")
    if isinstance(year, int):
        score += max(0.0, 2.0 + (year - 2020) * 0.4) if year >= 2020 else (1.0 if year >= 2015 else 0.0)
    score += min((paper.get("citation_count") or 0) / 100, 2.0)
    return score


def _select_strongest_papers(papers: list[dict], limit: int = MAX_PAPERS_TO_SELECT) -> list[dict]:
    scored = sorted(((p, _score_paper(p)) for p in papers), key=lambda x: x[1], reverse=True)
    return [p for p, _ in scored[:limit]]


# ─── Structured paper reading ─────────────────────────────────────────────────

_STRUCTURED_SCHEMA = {
    "objective": "the main research goal or question (one sentence)",
    "method": "primary methodology or approach used (one phrase)",
    "finding": "the most important result or conclusion (one sentence)",
    "limitation": "main constraint, gap, or acknowledged weakness (one sentence)",
}


def _build_structured_prompt(abstract: str, title: str) -> str:
    schema_json = json.dumps(_STRUCTURED_SCHEMA, indent=2)
    return (
        "You are an expert research analyst. Extract structured information from this paper.\n"
        "Respond with valid JSON only. No markdown fences or commentary.\n"
        f"Required schema:\n{schema_json}\n"
        "Rules: each field is ONE concise sentence. Write 'Not specified' if absent.\n"
        f"Title: {title}\n"
        f"Abstract: {abstract[:1800]}"
    )


def _validate_structured(raw: dict) -> dict[str, str]:
    return {
        field: str(raw.get(field, "Not specified")).strip() or "Not specified"
        for field in ("objective", "method", "finding", "limitation")
    }


def _read_paper_structured(paper: dict, settings: Any) -> dict[str, str]:
    """LLM-extract {objective, method, finding, limitation} from a single paper."""
    abstract = (paper.get("abstract") or "").strip()
    title = (paper.get("title") or "Untitled").strip()
    if not abstract:
        return {f: "Not specified" for f in ("objective", "method", "finding", "limitation")}
    prompt = _build_structured_prompt(abstract, title)
    result = _llm_json(
        prompt,
        "You return only valid JSON for structured paper analysis.",
        settings,
        agent_name="Paper Reader",
        preferred_gemini_slot="primary",
    )
    if result:
        return _validate_structured(result)
    # Graceful fallback: derive naively from abstract text
    return {
        "objective": abstract[:220] + ("…" if len(abstract) > 220 else ""),
        "method": "Not specified",
        "finding": (abstract[220:500] + "…" if len(abstract) > 500 else abstract[220:]) if len(abstract) > 220 else abstract,
        "limitation": "Not specified",
    }


# ─── Synthesis: key findings ──────────────────────────────────────────────────

def _synthesize_key_findings(paper_summaries: list[dict], topic: str, settings: Any) -> list[str]:
    if not paper_summaries:
        return []
    papers_text = "\n\n".join(
        f'Paper {i+1}: "{ps["title"]}"\n'
        f'  Objective: {ps["objective"]}\n'
        f'  Method: {ps["method"]}\n'
        f'  Finding: {ps["finding"]}\n'
        f'  Limitation: {ps["limitation"]}'
        for i, ps in enumerate(paper_summaries)
    )
    prompt = (
        f"Research topic: {topic}\n\n"
        "From these paper analyses, synthesize 3–5 KEY CROSS-CUTTING FINDINGS.\n"
        "These must span multiple papers — not just restate individual paper results.\n"
        "Order them by strength of evidence. Be specific, not generic.\n"
        'Respond with valid JSON only: {"key_findings": ["string", ...]}\n\n'
        f"Papers:\n{papers_text}"
    )
    result = _llm_json(
        prompt,
        "You return only valid JSON for cross-paper research synthesis.",
        settings,
        agent_name="Key Findings Synthesis",
        preferred_gemini_slot="secondary",
    )
    if result and isinstance(result.get("key_findings"), list):
        return [str(kf).strip() for kf in result["key_findings"] if str(kf).strip()][:5]
    # Fallback: use top findings from individual papers
    return [ps["finding"] for ps in paper_summaries[:3] if ps["finding"] not in ("Not specified", "")]


# ─── Synthesis: ranked research gaps ──────────────────────────────────────────

def _rank_research_gaps(gap_result: dict, paper_summaries: list[dict], settings: Any) -> dict[str, list[str]]:
    all_gaps = (
        gap_result.get("identified_gaps", [])
        + gap_result.get("underexplored_areas", [])
        + gap_result.get("future_directions", [])
        + gap_result.get("novelty_opportunities", [])
    )
    limitations = [
        ps["limitation"] for ps in paper_summaries
        if ps.get("limitation") and ps["limitation"] != "Not specified"
    ]
    if not all_gaps and not limitations:
        return {"high_priority": [], "medium_priority": [], "emerging": []}

    gaps_block = "\n".join(f"- {g}" for g in all_gaps[:15])
    limits_block = "\n".join(f"- {l}" for l in limitations[:6])
    prompt = (
        "Categorise these research gaps and limitations into three priority levels.\n"
        "- high_priority: critical gaps blocking field progress\n"
        "- medium_priority: important gaps but not immediately blocking\n"
        "- emerging: new opportunities just beginning to appear\n"
        'Respond with valid JSON only: {"high_priority": [], "medium_priority": [], "emerging": []}\n\n'
        f"Research gaps identified:\n{gaps_block}\n\n"
        f"Limitations from papers:\n{limits_block}"
    )
    result = _llm_json(
        prompt,
        "You return only valid JSON for gap prioritization.",
        settings,
        agent_name="Gap Ranking",
        preferred_gemini_slot="secondary",
    )
    if result:
        return {
            lvl: [str(g).strip() for g in result.get(lvl, []) if str(g).strip()]
            for lvl in ("high_priority", "medium_priority", "emerging")
        }
    # Proportional fallback
    third = max(1, len(all_gaps) // 3)
    return {
        "high_priority": all_gaps[:third],
        "medium_priority": all_gaps[third : third * 2],
        "emerging": all_gaps[third * 2 :],
    }


# ─── Synthesis: recommended direction ─────────────────────────────────────────

def _generate_recommended_direction(
    topic: str,
    key_findings: list[str],
    gaps_ranked: dict,
    settings: Any,
) -> str:
    findings_block = "\n".join(f"- {kf}" for kf in key_findings[:3]) or "No findings available."
    high_gaps_block = "\n".join(f"- {g}" for g in gaps_ranked.get("high_priority", [])[:3]) or "No high-priority gaps identified."
    prompt = (
        f"Research topic: {topic}\n\n"
        f"Key findings:\n{findings_block}\n\n"
        f"High-priority gaps:\n{high_gaps_block}\n\n"
        "Recommend ONE specific, actionable next research direction grounded in this evidence.\n"
        "Be direct and concrete. Write 2–3 sentences only. No headers or bullets."
    )
    text, _ = _llm_text(
        prompt,
        "You are a senior research advisor. Give specific, actionable guidance grounded in evidence.",
        settings,
        agent_name="Recommended Direction",
        preferred_gemini_slot="secondary",
    )
    return text or (
        "Extend the strongest identified methods to understudied subpopulations and validate "
        "findings across more diverse, multi-site datasets to improve generalizability."
    )


# ─── Synthesis: executive summary ─────────────────────────────────────────────

def _build_exec_summary_prompt(
    topic: str,
    paper_summaries: list[dict],
    key_findings: list[str],
    evidence: dict,
    contradictions: dict,
    gaps_ranked: dict,
) -> str:
    lines = [
        "You are a senior research analyst. Write a 3–5 paragraph executive summary for this research briefing.",
        "Synthesise the key findings, methodological landscape, contradictions, and priority research gaps.",
        "Write authoritative, evidence-grounded prose. No headers or bullet points.",
        "",
        f"Research topic: {topic}",
        "",
    ]
    if key_findings:
        lines += ["Key synthesized findings:"] + [f"  • {kf}" for kf in key_findings[:4]] + [""]
    if paper_summaries:
        lines += ["Papers analyzed:"] + [f'  • "{ps["title"]}": {ps["finding"]}' for ps in paper_summaries[:4]] + [""]
    combined_evidence = evidence.get("common_evidence", []) + evidence.get("consensus_trends", [])
    if combined_evidence:
        lines += ["Common evidence patterns:"] + [f"  • {e}" for e in combined_evidence[:4]] + [""]
    if contradictions.get("contradiction_found"):
        lines += [f"Contradiction note: {contradictions.get('explanation', '')[:300]}", ""]
    high_gaps = gaps_ranked.get("high_priority", [])[:3]
    if high_gaps:
        lines += ["High-priority research gaps:"] + [f"  • {g}" for g in high_gaps] + [""]
    lines.append("Write the executive summary now:")
    return "\n".join(lines)


def _generate_executive_summary(prompt: str, settings: Any) -> tuple[str, str]:
    text, provider = _llm_text(
        prompt,
        "You are a senior research analyst. Write authoritative, evidence-grounded prose.",
        settings,
        agent_name="Final report synthesis",
        preferred_gemini_slot="secondary",
    )
    if text and provider:
        return text, provider
    return (
        "Executive summary could not be generated — LLM providers unavailable. "
        "See individual report sections below.",
        "none",
    )


# ─── Pipeline stages ──────────────────────────────────────────────────────────

def _stage_planner(topic: str) -> dict[str, Any]:
    try:
        result = run_planner_agent(topic)
        LOGGER.info("Planner stage completed (provider=%s).", result.get("provider"))
        return result
    except (PlannerAgentServiceError, ValueError) as exc:
        LOGGER.warning("Planner stage failed: %s", exc)
        return {
            "topic": topic, "provider": "none",
            "research_decomposition": {
                "subtopics": [], "search_keywords": [topic],
                "possible_methods": [], "likely_datasets": [],
            },
        }


def _stage_literature(topic: str) -> list[dict]:
    try:
        result = run_literature_hunter(topic, limit=8)
        papers = result.get("papers", [])
        LOGGER.info("Literature stage: %d papers retrieved.", len(papers))
        return papers
    except (LiteratureHunterServiceError, ValueError) as exc:
        LOGGER.warning("Literature stage failed: %s", exc)
        return []


def _stage_structured_reader(papers: list[dict], settings: Any) -> list[dict]:
    selected = _select_strongest_papers(papers)
    summaries: list[dict] = []
    for paper in selected:
        structured = _read_paper_structured(paper, settings)
        summaries.append({
            "title": (paper.get("title") or "Untitled").strip(),
            "year": paper.get("year"),
            "authors": (paper.get("authors") or [])[:4],
            "source": paper.get("source", ""),
            "url": paper.get("url"),
            **structured,
        })
    LOGGER.info("Structured reader: %d/%d papers processed.", len(summaries), len(selected))
    return summaries


def _stage_evidence_comparator(paper_summaries: list[dict]) -> dict:
    if not paper_summaries:
        return {
            "common_evidence": ["No papers were available for evidence comparison."],
            "differing_methods": [], "differing_datasets": [],
            "evidence_clusters": [], "consensus_trends": [],
        }
    if len(paper_summaries) < 2:
        ps = paper_summaries[0]
        return {
            "common_evidence": [ps["finding"]],
            "differing_methods": [ps["method"]] if ps["method"] != "Not specified" else [],
            "differing_datasets": [], "evidence_clusters": [],
            "consensus_trends": [
                "Only one paper was analyzed — cross-study comparison requires at least two."
            ],
        }
    # Format rich structured summaries for the comparator
    formatted_summaries = [
        f'Paper {i+1}: "{ps["title"]}"\n'
        f'Objective: {ps["objective"]}\n'
        f'Method: {ps["method"]}\n'
        f'Key Finding: {ps["finding"]}\n'
        f'Limitation: {ps["limitation"]}'
        for i, ps in enumerate(paper_summaries)
    ]
    try:
        result = run_evidence_comparator(formatted_summaries)
        LOGGER.info("Evidence comparator completed.")
        return result
    except (EvidenceComparatorServiceError, ValueError) as exc:
        LOGGER.warning("Evidence comparator failed: %s", exc)
        findings = "; ".join(ps["finding"][:120] for ps in paper_summaries[:3])
        return {
            "common_evidence": [f"Cross-paper synthesis: {findings[:400]}"],
            "differing_methods": [ps["method"] for ps in paper_summaries if ps["method"] != "Not specified"],
            "differing_datasets": [], "evidence_clusters": [], "consensus_trends": [],
        }


def _stage_contradiction_detector(paper_summaries: list[dict]) -> dict:
    if len(paper_summaries) < 2:
        return {
            "contradiction_found": False, "conflicting_statements": [],
            "confidence_level": "low",
            "explanation": "Fewer than two papers were analyzed — contradiction detection skipped.",
        }
    # Use structured findings as the claims
    claim_a = f"{paper_summaries[0]['finding']} [Method: {paper_summaries[0]['method']}]"
    claim_b = f"{paper_summaries[1]['finding']} [Method: {paper_summaries[1]['method']}]"
    try:
        result = run_contradiction_detector(claim_a, claim_b)
        LOGGER.info("Contradiction detector completed.")
        return result
    except (ContradictionDetectorServiceError, ValueError) as exc:
        LOGGER.warning("Contradiction detector failed: %s", exc)
        return {
            "contradiction_found": False, "conflicting_statements": [],
            "confidence_level": "low",
            "explanation": f"Contradiction analysis could not be completed: {exc}",
        }


def _stage_research_gap(topic: str, paper_summaries: list[dict]) -> dict:
    if paper_summaries:
        findings_block = "\n".join(
            f'• "{ps["title"]}": Finding — {ps["finding"]}. Limitation — {ps["limitation"]}.'
            for ps in paper_summaries
        )
    else:
        findings_block = f"Research on {topic} — no detailed paper findings available."
    try:
        result = run_research_gap(topic, findings_block)
        LOGGER.info("Research gap stage completed.")
        return result
    except (ResearchGapServiceError, ValueError) as exc:
        LOGGER.warning("Research gap failed: %s", exc)
        return {
            "identified_gaps": [], "underexplored_areas": [],
            "future_directions": [], "novelty_opportunities": [],
        }


# ─── Main pipeline entry point ────────────────────────────────────────────────

def run_research_orchestrator(topic: str) -> dict[str, Any]:
    """
    Execute the full Smart Researcher v2 pipeline.

    Returns a comprehensive research briefing dict. Individual stage failures
    are handled gracefully — the pipeline never aborts on a single agent error.
    """
    topic = topic.strip()
    if not topic:
        raise OrchestratorError("Research topic must not be empty.", status_code=422)

    settings = get_settings()
    providers_used: list[str] = []

    LOGGER.info("Smart Researcher v2 starting for topic: %r", topic)

    # Stage 1 — Plan
    planner_result = _stage_planner(topic)
    if planner_result.get("provider") not in ("none", None, ""):
        providers_used.append(planner_result["provider"])

    # Stage 2 — Literature
    papers = _stage_literature(topic)

    # Stage 3 — Structured reading of selected papers
    paper_summaries = _stage_structured_reader(papers, settings)

    # Stage 4 — Evidence comparison (uses rich structured summaries)
    evidence = _stage_evidence_comparator(paper_summaries)

    # Stage 5 — Contradiction detection (uses structured findings)
    contradictions = _stage_contradiction_detector(paper_summaries)

    # Stage 6 — Research gaps (includes limitations from structured reading)
    gap_result = _stage_research_gap(topic, paper_summaries)

    # Stage 7 — Key findings synthesis
    key_findings = _synthesize_key_findings(paper_summaries, topic, settings)

    # Stage 8 — Ranked gap classification
    gaps_ranked = _rank_research_gaps(gap_result, paper_summaries, settings)

    # Stage 9 — Recommended research direction
    recommended_direction = _generate_recommended_direction(topic, key_findings, gaps_ranked, settings)

    # Stage 10 — Executive summary
    exec_prompt = _build_exec_summary_prompt(
        topic, paper_summaries, key_findings, evidence, contradictions, gaps_ranked
    )
    executive_summary, exec_provider = _generate_executive_summary(exec_prompt, settings)
    if exec_provider not in ("none", ""):
        providers_used.append(exec_provider)

    # ── Derived metadata ──
    dominant_domain = _determine_dominant_domain(topic, papers)
    confidence_score = _compute_confidence_score(len(paper_summaries), evidence, contradictions)
    conflict_level = _derive_conflict_level(contradictions)

    # ── Methods landscape (planner + paper readers + comparator) ──
    methods_landscape: list[str] = list(
        planner_result.get("research_decomposition", {}).get("possible_methods", [])
    )
    for ps in paper_summaries:
        if ps.get("method") not in ("Not specified", "", None) and ps["method"] not in methods_landscape:
            methods_landscape.append(ps["method"])
    for m in evidence.get("differing_methods", []):
        if m and m not in methods_landscape:
            methods_landscape.append(m)

    LOGGER.info(
        "Smart Researcher v2 complete. papers=%d analyzed=%d confidence=%d",
        len(papers), len(paper_summaries), confidence_score,
    )

    return {
        "topic": topic,
        "provider": providers_used[0] if providers_used else "none",
        "confidence_score": confidence_score,
        "dominant_domain": dominant_domain,
        "executive_summary": executive_summary,
        "key_findings": key_findings,
        "paper_summaries": paper_summaries,
        # Compatibility alias used by frontend literature section
        "literature_overview": [
            {
                "title": ps["title"],
                "abstract": "",   # abstract now embedded in structured fields
                "year": ps.get("year"),
                "authors": ps.get("authors", []),
                "url": ps.get("url"),
                "source": ps.get("source", ""),
            }
            for ps in paper_summaries
        ],
        "methods_landscape": methods_landscape,
        "evidence_comparison": {
            "common_evidence": evidence.get("common_evidence", []),
            "consensus_trends": evidence.get("consensus_trends", []),
            "differing_datasets": evidence.get("differing_datasets", []),
            "evidence_clusters": evidence.get("evidence_clusters", []),
        },
        "contradictions_found": {
            "contradiction_found": contradictions.get("contradiction_found", False),
            "explanation": contradictions.get("explanation", ""),
            "conflicting_statements": contradictions.get("conflicting_statements", []),
            "confidence_level": contradictions.get("confidence_level", "low"),
            "conflict_level": conflict_level,
        },
        "research_gaps": {
            "high_priority": gaps_ranked.get("high_priority", []),
            "medium_priority": gaps_ranked.get("medium_priority", []),
            "emerging": gaps_ranked.get("emerging", []),
            # Compatibility aliases
            "identified_gaps": gap_result.get("identified_gaps", []),
            "underexplored_areas": gap_result.get("underexplored_areas", []),
        },
        "recommended_next_direction": recommended_direction,
        "future_research_directions": (
            gap_result.get("future_directions", []) + gap_result.get("novelty_opportunities", [])
        ),
        "pipeline_metadata": {
            "papers_found": len(papers),
            "papers_analyzed": len(paper_summaries),
            "providers_used": list(dict.fromkeys(p for p in providers_used if p)),
        },
    }
