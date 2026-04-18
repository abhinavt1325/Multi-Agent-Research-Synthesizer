from __future__ import annotations

import json
import logging
import socket
from typing import Any
from urllib import error, request

try:
    from backend.agents.gemini_support import call_gemini_with_fallback
    from backend.config.settings import get_settings
except ModuleNotFoundError:  # pragma: no cover - supports execution from backend/
    from agents.gemini_support import call_gemini_with_fallback
    from config.settings import get_settings


LOGGER = logging.getLogger(__name__)

GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
GEMINI_GENERATE_CONTENT_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
)
REQUEST_TIMEOUT_SECONDS = 25

RESEARCH_GAP_SCHEMA_DESCRIPTION = {
    "identified_gaps": ["string"],
    "underexplored_areas": ["string"],
    "future_directions": ["string"],
    "novelty_opportunities": ["string"],
}


class ResearchGapServiceError(RuntimeError):
    """Raised when research gap generation fails safely."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def _normalize_text(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_name} must not be empty.")
    return cleaned


def _build_prompt(research_topic: str, paper_findings: str) -> str:
    schema_json = json.dumps(RESEARCH_GAP_SCHEMA_DESCRIPTION, indent=2)
    return (
        "You are a research gap identification assistant. Analyze the research topic and the supplied paper findings.\n"
        "Respond with valid JSON only. Do not include markdown fences or commentary.\n"
        "Use this exact schema:\n"
        f"{schema_json}\n"
        "Requirements:\n"
        "- Return concise, evidence-grounded items only.\n"
        "- Focus on gaps implied by the findings, not generic suggestions.\n"
        "- If a category is not supported by the text, return an empty list.\n"
        "Research topic:\n"
        f"{research_topic}\n\n"
        "Paper findings:\n"
        f"{paper_findings}"
    )


def _extract_json_object(raw_text: str) -> dict[str, Any]:
    candidate = raw_text.strip()

    if candidate.startswith("```"):
        lines = candidate.splitlines()
        if len(lines) >= 3:
            candidate = "\n".join(lines[1:-1]).strip()

    start = candidate.find("{")
    end = candidate.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ResearchGapServiceError("LLM response did not contain a valid JSON object.", status_code=502)

    try:
        payload = json.loads(candidate[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ResearchGapServiceError("LLM response could not be parsed as JSON.", status_code=502) from exc

    if not isinstance(payload, dict):
        raise ResearchGapServiceError("LLM response JSON must be an object.", status_code=502)

    return payload


def _normalize_string_list(value: Any, field_name: str) -> list[str]:
    if not isinstance(value, list):
        raise ResearchGapServiceError(
            f"Research gap field '{field_name}' must be a list.",
            status_code=502,
        )

    normalized_items: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise ResearchGapServiceError(
                f"Research gap field '{field_name}' must contain strings only.",
                status_code=502,
            )

        cleaned = item.strip()
        if cleaned and cleaned not in normalized_items:
            normalized_items.append(cleaned)

    return normalized_items


def _validate_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "identified_gaps": _normalize_string_list(payload.get("identified_gaps"), "identified_gaps"),
        "underexplored_areas": _normalize_string_list(payload.get("underexplored_areas"), "underexplored_areas"),
        "future_directions": _normalize_string_list(payload.get("future_directions"), "future_directions"),
        "novelty_opportunities": _normalize_string_list(payload.get("novelty_opportunities"), "novelty_opportunities"),
    }


def _extract_groq_content(payload: dict[str, Any]) -> str:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ResearchGapServiceError("Groq returned an unexpected response shape.", status_code=502) from exc

    if not isinstance(content, str) or not content.strip():
        raise ResearchGapServiceError("Groq returned an empty research gap response.", status_code=502)

    return content


def _extract_gemini_content(payload: dict[str, Any]) -> str:
    try:
        parts = payload["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ResearchGapServiceError("Gemini returned an unexpected response shape.", status_code=502) from exc

    texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    content = "\n".join(text for text in texts if isinstance(text, str) and text.strip()).strip()

    if not content:
        raise ResearchGapServiceError("Gemini returned an empty research gap response.", status_code=502)

    return content


def _perform_json_request(url: str, headers: dict[str, str], body: dict[str, Any]) -> dict[str, Any]:
    api_request = request.Request(
        url,
        headers=headers,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
    )

    try:
        with request.urlopen(api_request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        if exc.code == 401:
            raise ResearchGapServiceError("Provider authentication failed.", status_code=502) from exc
        if exc.code == 429:
            raise ResearchGapServiceError("Provider rate limit exceeded. Please retry shortly.", status_code=503) from exc
        raise ResearchGapServiceError("Provider request failed.", status_code=502) from exc
    except (TimeoutError, socket.timeout) as exc:
        raise ResearchGapServiceError("Provider request timed out.", status_code=504) from exc
    except error.URLError as exc:
        raise ResearchGapServiceError("Provider request could not be completed.", status_code=502) from exc
    except json.JSONDecodeError as exc:
        raise ResearchGapServiceError("Provider returned invalid JSON.", status_code=502) from exc


def _call_groq(research_topic: str, paper_findings: str, api_key: str) -> dict[str, Any]:
    prompt = _build_prompt(research_topic, paper_findings)
    payload = _perform_json_request(
        url=GROQ_CHAT_COMPLETIONS_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        body={
            "model": GROQ_MODEL,
            "temperature": 0.2,
            "messages": [
                {
                    "role": "system",
                    "content": "You return only valid JSON for research gap identification tasks.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        },
    )
    return _validate_payload(_extract_json_object(_extract_groq_content(payload)))


def _call_gemini(research_topic: str, paper_findings: str, api_key: str) -> dict[str, Any]:
    prompt = _build_prompt(research_topic, paper_findings)
    payload = _perform_json_request(
        url=GEMINI_GENERATE_CONTENT_URL,
        headers={
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
        },
        body={
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt,
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
            },
        },
    )
    return _validate_payload(_extract_json_object(_extract_gemini_content(payload)))


def run_research_gap(research_topic: str, paper_findings: str) -> dict[str, Any]:
    normalized_topic = _normalize_text(research_topic, "research_topic")
    normalized_findings = _normalize_text(paper_findings, "paper_findings")
    settings = get_settings()

    provider_errors: list[str] = []

    if settings.groq_api_key:
        try:
            result = _call_groq(normalized_topic, normalized_findings, settings.groq_api_key)
            return {
                "provider": "groq",
                **result,
            }
        except ResearchGapServiceError as exc:
            LOGGER.exception("Groq research gap request failed.")
            provider_errors.append(f"Groq: {exc}")

    if settings.has_gemini_api_key:
        try:
            result = call_gemini_with_fallback(
                agent_name="Research Gap",
                settings=settings,
                logger=LOGGER,
                preferred_slot="secondary",
                call_with_api_key=lambda api_key: _call_gemini(normalized_topic, normalized_findings, api_key),
            )
            return {
                "provider": "gemini",
                **result,
            }
        except ResearchGapServiceError as exc:
            LOGGER.exception("Gemini research gap request failed.")
            provider_errors.append(f"Gemini: {exc}")

    if not settings.groq_api_key and not settings.has_gemini_api_key:
        raise ResearchGapServiceError(
            "Research Gap is unavailable. Set GROQ_API_KEY, GEMINI_API_KEY_PRIMARY, GEMINI_API_KEY_SECONDARY, or GEMINI_API_KEY.",
            status_code=503,
        )

    provider_message = " | ".join(provider_errors) if provider_errors else "No research gap provider is available."
    raise ResearchGapServiceError(
        f"Research Gap request failed across all configured providers. {provider_message}",
        status_code=502,
    )
