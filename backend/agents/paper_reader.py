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

PAPER_READER_SCHEMA_DESCRIPTION = {
    "summary": "string",
    "methods_used": ["string"],
    "datasets_mentioned": ["string"],
    "key_findings": ["string"],
}


class PaperReaderServiceError(RuntimeError):
    """Raised when paper reader execution fails safely."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def _normalize_paper_text(paper_text: str) -> str:
    cleaned = paper_text.strip()
    if not cleaned:
        raise ValueError("paper_text must not be empty.")
    return cleaned


def _build_paper_reader_prompt(paper_text: str) -> str:
    schema_json = json.dumps(PAPER_READER_SCHEMA_DESCRIPTION, indent=2)
    return (
        "You are a paper reading assistant. Analyze the supplied paper abstract or extracted paper text.\n"
        "Respond with valid JSON only. Do not include markdown fences or commentary.\n"
        "Use this exact schema:\n"
        f"{schema_json}\n"
        "Requirements:\n"
        "- Keep the summary concise and evidence-based.\n"
        "- Extract only methods, datasets, and findings grounded in the supplied text.\n"
        "- If a category is not present in the text, return an empty list for that category.\n"
        "Paper text:\n"
        f"{paper_text}"
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
        raise PaperReaderServiceError("LLM response did not contain a valid JSON object.", status_code=502)

    try:
        payload = json.loads(candidate[start : end + 1])
    except json.JSONDecodeError as exc:
        raise PaperReaderServiceError("LLM response could not be parsed as JSON.", status_code=502) from exc

    if not isinstance(payload, dict):
        raise PaperReaderServiceError("LLM response JSON must be an object.", status_code=502)

    return payload


def _normalize_string_list(value: Any, field_name: str) -> list[str]:
    if not isinstance(value, list):
        raise PaperReaderServiceError(f"Paper reader field '{field_name}' must be a list.", status_code=502)

    normalized_items: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise PaperReaderServiceError(
                f"Paper reader field '{field_name}' must contain strings only.",
                status_code=502,
            )

        cleaned = item.strip()
        if cleaned and cleaned not in normalized_items:
            normalized_items.append(cleaned)

    return normalized_items


def _validate_paper_reader_payload(payload: dict[str, Any]) -> dict[str, Any]:
    summary = payload.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        raise PaperReaderServiceError("Paper reader response is missing a valid 'summary'.", status_code=502)

    return {
        "summary": summary.strip(),
        "methods_used": _normalize_string_list(payload.get("methods_used"), "methods_used"),
        "datasets_mentioned": _normalize_string_list(payload.get("datasets_mentioned"), "datasets_mentioned"),
        "key_findings": _normalize_string_list(payload.get("key_findings"), "key_findings"),
    }


def _extract_groq_content(payload: dict[str, Any]) -> str:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise PaperReaderServiceError("Groq returned an unexpected response shape.", status_code=502) from exc

    if not isinstance(content, str) or not content.strip():
        raise PaperReaderServiceError("Groq returned an empty paper reader response.", status_code=502)

    return content


def _extract_gemini_content(payload: dict[str, Any]) -> str:
    try:
        parts = payload["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError, TypeError) as exc:
        raise PaperReaderServiceError("Gemini returned an unexpected response shape.", status_code=502) from exc

    texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    content = "\n".join(text for text in texts if isinstance(text, str) and text.strip()).strip()

    if not content:
        raise PaperReaderServiceError("Gemini returned an empty paper reader response.", status_code=502)

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
            raise PaperReaderServiceError("Provider authentication failed.", status_code=502) from exc
        if exc.code == 429:
            raise PaperReaderServiceError("Provider rate limit exceeded. Please retry shortly.", status_code=503) from exc
        raise PaperReaderServiceError("Provider request failed.", status_code=502) from exc
    except (TimeoutError, socket.timeout) as exc:
        raise PaperReaderServiceError("Provider request timed out.", status_code=504) from exc
    except error.URLError as exc:
        raise PaperReaderServiceError("Provider request could not be completed.", status_code=502) from exc
    except json.JSONDecodeError as exc:
        raise PaperReaderServiceError("Provider returned invalid JSON.", status_code=502) from exc


def _call_groq_paper_reader(paper_text: str, api_key: str) -> dict[str, Any]:
    prompt = _build_paper_reader_prompt(paper_text)
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
                    "content": "You return only valid JSON for paper analysis tasks.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        },
    )
    return _validate_paper_reader_payload(_extract_json_object(_extract_groq_content(payload)))


def _call_gemini_paper_reader(paper_text: str, api_key: str) -> dict[str, Any]:
    prompt = _build_paper_reader_prompt(paper_text)
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
    return _validate_paper_reader_payload(_extract_json_object(_extract_gemini_content(payload)))


def run_paper_reader(paper_text: str) -> dict[str, Any]:
    normalized_text = _normalize_paper_text(paper_text)
    settings = get_settings()

    provider_errors: list[str] = []

    if settings.groq_api_key:
        try:
            result = _call_groq_paper_reader(normalized_text, settings.groq_api_key)
            return {
                "provider": "groq",
                **result,
            }
        except PaperReaderServiceError as exc:
            LOGGER.exception("Groq paper reader request failed.")
            provider_errors.append(f"Groq: {exc}")

    if settings.gemini_api_key:
        try:
            result = _call_gemini_paper_reader(normalized_text, settings.gemini_api_key)
            return {
                "provider": "gemini",
                **result,
            }
        except PaperReaderServiceError as exc:
            LOGGER.exception("Gemini paper reader request failed.")
            provider_errors.append(f"Gemini: {exc}")

    if not settings.groq_api_key and not settings.gemini_api_key:
        raise PaperReaderServiceError(
            "Paper Reader is unavailable. Set GROQ_API_KEY or GEMINI_API_KEY.",
            status_code=503,
        )

    provider_message = " | ".join(provider_errors) if provider_errors else "No paper reader provider is available."
    raise PaperReaderServiceError(
        f"Paper Reader request failed across all configured providers. {provider_message}",
        status_code=502,
    )
