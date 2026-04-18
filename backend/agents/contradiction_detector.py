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
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent"
)
REQUEST_TIMEOUT_SECONDS = 25
VALID_CONFIDENCE_LEVELS = {"low", "medium", "high"}

CONTRADICTION_DETECTOR_SCHEMA_DESCRIPTION = {
    "contradiction_found": "boolean",
    "conflicting_statements": ["string"],
    "confidence_level": "low|medium|high",
    "explanation": "string",
}


class ContradictionDetectorServiceError(RuntimeError):
    """Raised when contradiction detection fails safely."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def _normalize_claim(claim: str, field_name: str) -> str:
    cleaned = claim.strip()
    if not cleaned:
        raise ValueError(f"{field_name} must not be empty.")
    return cleaned


def _build_prompt(claim_a: str, claim_b: str) -> str:
    schema_json = json.dumps(CONTRADICTION_DETECTOR_SCHEMA_DESCRIPTION, indent=2)
    return (
        "You are a contradiction detection assistant. Compare the two research claims carefully.\n"
        "Respond with valid JSON only. Do not include markdown fences or commentary.\n"
        "Use this exact schema:\n"
        f"{schema_json}\n"
        "Requirements:\n"
        "- contradiction_found must be true only when the claims materially conflict.\n"
        "- conflicting_statements should capture the specific clashing statements.\n"
        "- confidence_level must be one of: low, medium, high.\n"
        "- explanation must be concise and grounded in the supplied claims.\n"
        "Research claim A:\n"
        f"{claim_a}\n\n"
        "Research claim B:\n"
        f"{claim_b}"
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
        raise ContradictionDetectorServiceError(
            "LLM response did not contain a valid JSON object.",
            status_code=502,
        )

    try:
        payload = json.loads(candidate[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ContradictionDetectorServiceError(
            "LLM response could not be parsed as JSON.",
            status_code=502,
        ) from exc

    if not isinstance(payload, dict):
        raise ContradictionDetectorServiceError("LLM response JSON must be an object.", status_code=502)

    return payload


def _normalize_string_list(value: Any, field_name: str) -> list[str]:
    if not isinstance(value, list):
        raise ContradictionDetectorServiceError(
            f"Contradiction detector field '{field_name}' must be a list.",
            status_code=502,
        )

    normalized_items: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise ContradictionDetectorServiceError(
                f"Contradiction detector field '{field_name}' must contain strings only.",
                status_code=502,
            )

        cleaned = item.strip()
        if cleaned and cleaned not in normalized_items:
            normalized_items.append(cleaned)

    return normalized_items


def _validate_payload(payload: dict[str, Any]) -> dict[str, Any]:
    contradiction_found = payload.get("contradiction_found")
    if not isinstance(contradiction_found, bool):
        raise ContradictionDetectorServiceError(
            "Contradiction detector response is missing a valid 'contradiction_found' boolean.",
            status_code=502,
        )

    confidence_level = payload.get("confidence_level")
    if not isinstance(confidence_level, str) or confidence_level.strip().lower() not in VALID_CONFIDENCE_LEVELS:
        raise ContradictionDetectorServiceError(
            "Contradiction detector response is missing a valid 'confidence_level'.",
            status_code=502,
        )

    explanation = payload.get("explanation")
    if not isinstance(explanation, str) or not explanation.strip():
        raise ContradictionDetectorServiceError(
            "Contradiction detector response is missing a valid 'explanation'.",
            status_code=502,
        )

    return {
        "contradiction_found": contradiction_found,
        "conflicting_statements": _normalize_string_list(
            payload.get("conflicting_statements"),
            "conflicting_statements",
        ),
        "confidence_level": confidence_level.strip().lower(),
        "explanation": explanation.strip(),
    }


def _extract_groq_content(payload: dict[str, Any]) -> str:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ContradictionDetectorServiceError(
            "Groq returned an unexpected response shape.",
            status_code=502,
        ) from exc

    if not isinstance(content, str) or not content.strip():
        raise ContradictionDetectorServiceError(
            "Groq returned an empty contradiction detector response.",
            status_code=502,
        )

    return content


def _extract_gemini_content(payload: dict[str, Any]) -> str:
    try:
        parts = payload["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ContradictionDetectorServiceError(
            "Gemini returned an unexpected response shape.",
            status_code=502,
        ) from exc

    texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    content = "\n".join(text for text in texts if isinstance(text, str) and text.strip()).strip()

    if not content:
        raise ContradictionDetectorServiceError(
            "Gemini returned an empty contradiction detector response.",
            status_code=502,
        )

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
            raise ContradictionDetectorServiceError("Provider authentication failed.", status_code=502) from exc
        if exc.code == 429:
            raise ContradictionDetectorServiceError(
                "Provider rate limit exceeded. Please retry shortly.",
                status_code=503,
            ) from exc
        raise ContradictionDetectorServiceError("Provider request failed.", status_code=502) from exc
    except (TimeoutError, socket.timeout) as exc:
        raise ContradictionDetectorServiceError("Provider request timed out.", status_code=504) from exc
    except error.URLError as exc:
        raise ContradictionDetectorServiceError("Provider request could not be completed.", status_code=502) from exc
    except json.JSONDecodeError as exc:
        raise ContradictionDetectorServiceError("Provider returned invalid JSON.", status_code=502) from exc


def _call_groq(claim_a: str, claim_b: str, api_key: str) -> dict[str, Any]:
    prompt = _build_prompt(claim_a, claim_b)
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
                    "content": "You return only valid JSON for contradiction detection tasks.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        },
    )
    return _validate_payload(_extract_json_object(_extract_groq_content(payload)))


def _call_gemini(claim_a: str, claim_b: str, api_key: str) -> dict[str, Any]:
    prompt = _build_prompt(claim_a, claim_b)
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


def run_contradiction_detector(claim_a: str, claim_b: str) -> dict[str, Any]:
    normalized_claim_a = _normalize_claim(claim_a, "claim_a")
    normalized_claim_b = _normalize_claim(claim_b, "claim_b")
    settings = get_settings()

    provider_errors: list[str] = []

    if settings.groq_api_key:
        try:
            result = _call_groq(normalized_claim_a, normalized_claim_b, settings.groq_api_key)
            return {
                "provider": "groq",
                **result,
            }
        except ContradictionDetectorServiceError as exc:
            LOGGER.exception("Groq contradiction detector request failed.")
            provider_errors.append(f"Groq: {exc}")

    if settings.has_gemini_api_key:
        try:
            result = call_gemini_with_fallback(
                agent_name="Contradiction Detector",
                settings=settings,
                logger=LOGGER,
                preferred_slot="secondary",
                call_with_api_key=lambda api_key: _call_gemini(normalized_claim_a, normalized_claim_b, api_key),
            )
            return {
                "provider": "gemini",
                **result,
            }
        except ContradictionDetectorServiceError as exc:
            LOGGER.exception("Gemini contradiction detector request failed.")
            provider_errors.append(f"Gemini: {exc}")

    if not settings.groq_api_key and not settings.has_gemini_api_key:
        raise ContradictionDetectorServiceError(
            "Contradiction Detector is unavailable. Set GROQ_API_KEY, GEMINI_API_KEY_PRIMARY, GEMINI_API_KEY_SECONDARY, or GEMINI_API_KEY.",
            status_code=503,
        )

    provider_message = " | ".join(provider_errors) if provider_errors else "No contradiction detector provider is available."
    raise ContradictionDetectorServiceError(
        f"Contradiction Detector request failed across all configured providers. {provider_message}",
        status_code=502,
    )
