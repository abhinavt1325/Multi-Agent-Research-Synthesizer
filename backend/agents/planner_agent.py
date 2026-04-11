from __future__ import annotations

import json
import logging
import socket
from typing import Any
from urllib import error, request

try:
    from backend.config.settings import get_settings
except ModuleNotFoundError:  # pragma: no cover - supports execution from backend/
    from config.settings import get_settings


LOGGER = logging.getLogger(__name__)

GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
GEMINI_GENERATE_CONTENT_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent"
)
REQUEST_TIMEOUT_SECONDS = 25

PLANNER_SCHEMA_DESCRIPTION = {
    "topic": "string",
    "research_decomposition": {
        "subtopics": ["string"],
        "search_keywords": ["string"],
        "possible_methods": ["string"],
        "likely_datasets": ["string"],
    },
}


class PlannerAgentServiceError(RuntimeError):
    """Raised when planner execution fails safely."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def _normalize_topic(topic: str) -> str:
    cleaned = topic.strip()
    if not cleaned:
        raise ValueError("research_topic must not be empty.")
    return cleaned


def _build_planner_prompt(research_topic: str) -> str:
    schema_json = json.dumps(PLANNER_SCHEMA_DESCRIPTION, indent=2)
    return (
        "You are a research planning assistant. Decompose the research topic into practical planning inputs.\n"
        "Respond with valid JSON only. Do not include markdown fences or commentary.\n"
        "Use this exact schema:\n"
        f"{schema_json}\n"
        "Requirements:\n"
        "- Keep each list concise, specific, and useful for academic or technical research.\n"
        "- Prefer concrete search keywords over generic phrases.\n"
        "- Include likely datasets only when they are plausible for the topic.\n"
        f"Research topic: {research_topic}"
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
        raise PlannerAgentServiceError("LLM response did not contain a valid JSON object.", status_code=502)

    try:
        payload = json.loads(candidate[start : end + 1])
    except json.JSONDecodeError as exc:
        raise PlannerAgentServiceError("LLM response could not be parsed as JSON.", status_code=502) from exc

    if not isinstance(payload, dict):
        raise PlannerAgentServiceError("LLM response JSON must be an object.", status_code=502)

    return payload


def _normalize_string_list(value: Any, field_name: str) -> list[str]:
    if not isinstance(value, list):
        raise PlannerAgentServiceError(f"Planner field '{field_name}' must be a list.", status_code=502)

    normalized_items: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise PlannerAgentServiceError(
                f"Planner field '{field_name}' must contain strings only.",
                status_code=502,
            )

        cleaned = item.strip()
        if cleaned and cleaned not in normalized_items:
            normalized_items.append(cleaned)

    return normalized_items


def _validate_planner_payload(payload: dict[str, Any], research_topic: str) -> dict[str, Any]:
    decomposition = payload.get("research_decomposition")
    if not isinstance(decomposition, dict):
        raise PlannerAgentServiceError("Planner response is missing 'research_decomposition'.", status_code=502)

    return {
        "topic": str(payload.get("topic") or research_topic).strip() or research_topic,
        "research_decomposition": {
            "subtopics": _normalize_string_list(decomposition.get("subtopics"), "subtopics"),
            "search_keywords": _normalize_string_list(decomposition.get("search_keywords"), "search_keywords"),
            "possible_methods": _normalize_string_list(decomposition.get("possible_methods"), "possible_methods"),
            "likely_datasets": _normalize_string_list(decomposition.get("likely_datasets"), "likely_datasets"),
        },
    }


def _extract_groq_content(payload: dict[str, Any]) -> str:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise PlannerAgentServiceError("Groq returned an unexpected response shape.", status_code=502) from exc

    if not isinstance(content, str) or not content.strip():
        raise PlannerAgentServiceError("Groq returned an empty planner response.", status_code=502)

    return content


def _extract_gemini_content(payload: dict[str, Any]) -> str:
    try:
        parts = payload["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError, TypeError) as exc:
        raise PlannerAgentServiceError("Gemini returned an unexpected response shape.", status_code=502) from exc

    texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    content = "\n".join(text for text in texts if isinstance(text, str) and text.strip()).strip()

    if not content:
        raise PlannerAgentServiceError("Gemini returned an empty planner response.", status_code=502)

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
            raise PlannerAgentServiceError("Provider authentication failed.", status_code=502) from exc
        if exc.code == 429:
            raise PlannerAgentServiceError("Provider rate limit exceeded. Please retry shortly.", status_code=503) from exc
        raise PlannerAgentServiceError("Provider request failed.", status_code=502) from exc
    except (TimeoutError, socket.timeout) as exc:
        raise PlannerAgentServiceError("Provider request timed out.", status_code=504) from exc
    except error.URLError as exc:
        raise PlannerAgentServiceError("Provider request could not be completed.", status_code=502) from exc
    except json.JSONDecodeError as exc:
        raise PlannerAgentServiceError("Provider returned invalid JSON.", status_code=502) from exc


def _call_groq_planner(research_topic: str, api_key: str) -> dict[str, Any]:
    prompt = _build_planner_prompt(research_topic)
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
                    "content": "You return only valid JSON for research planning tasks.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        },
    )
    return _validate_planner_payload(_extract_json_object(_extract_groq_content(payload)), research_topic)


def _call_gemini_planner(research_topic: str, api_key: str) -> dict[str, Any]:
    prompt = _build_planner_prompt(research_topic)
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
    return _validate_planner_payload(_extract_json_object(_extract_gemini_content(payload)), research_topic)


def run_planner_agent(research_topic: str) -> dict[str, Any]:
    normalized_topic = _normalize_topic(research_topic)
    settings = get_settings()

    provider_errors: list[str] = []

    if settings.groq_api_key:
        try:
            result = _call_groq_planner(normalized_topic, settings.groq_api_key)
            return {
                "provider": "groq",
                **result,
            }
        except PlannerAgentServiceError as exc:
            LOGGER.exception("Groq planner request failed.")
            provider_errors.append(f"Groq: {exc}")

    if settings.gemini_api_key:
        try:
            result = _call_gemini_planner(normalized_topic, settings.gemini_api_key)
            return {
                "provider": "gemini",
                **result,
            }
        except PlannerAgentServiceError as exc:
            LOGGER.exception("Gemini planner request failed.")
            provider_errors.append(f"Gemini: {exc}")

    if not settings.groq_api_key and not settings.gemini_api_key:
        raise PlannerAgentServiceError(
            "Planner is unavailable. Set GROQ_API_KEY or GEMINI_API_KEY.",
            status_code=503,
        )

    provider_message = " | ".join(provider_errors) if provider_errors else "No planner provider is available."
    raise PlannerAgentServiceError(
        f"Planner request failed across all configured providers. {provider_message}",
        status_code=502,
    )
