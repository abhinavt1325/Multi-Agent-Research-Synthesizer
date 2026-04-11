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
REQUEST_TIMEOUT_SECONDS = 30

EVIDENCE_COMPARATOR_SCHEMA_DESCRIPTION = {
    "common_evidence": ["string"],
    "differing_methods": ["string"],
    "differing_datasets": ["string"],
    "evidence_clusters": ["string"],
    "consensus_trends": ["string"],
}


class EvidenceComparatorServiceError(RuntimeError):
    """Raised when evidence comparison fails safely."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def _normalize_summary(summary: str, index: int) -> str:
    cleaned = summary.strip()
    if not cleaned:
        raise ValueError(f"Summary for Paper {index + 1} must not be empty.")
    return cleaned


def _build_evidence_comparator_prompt(summaries: list[str]) -> str:
    schema_json = json.dumps(EVIDENCE_COMPARATOR_SCHEMA_DESCRIPTION, indent=2)
    
    papers_text = ""
    for i, summary in enumerate(summaries):
        papers_text += f"Paper {i + 1} summary:\n{summary}\n\n"

    return (
        "You are a premium scientific evidence comparison and synthesis assistant.\n"
        "Your task is to analyze multiple paper summaries and synthesize them into a structured comparison.\n"
        "Respond with valid JSON only. Do not include markdown fences or secondary commentary.\n"
        "Use this exact schema:\n"
        f"{schema_json}\n"
        "Instructions:\n"
        "1. 'common_evidence': Identify core findings or claims supported by the majority of the documents.\n"
        "2. 'differing_methods': Highlight technical or methodological variations across the papers.\n"
        "3. 'differing_datasets': Identify the variety of datasets or data sources used.\n"
        "4. 'evidence_clusters': Group similar research threads and evidence patterns into clusters.\n"
        "5. 'consensus_trends': Identify overarching consensus or emerging trends observed across the files.\n"
        "- Extract only information grounded in the supplied summaries.\n"
        "- Use concise, professional bullet-style phrases.\n"
        "- If a category is not supported by the documents, return an empty list.\n\n"
        f"{papers_text}"
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
        raise EvidenceComparatorServiceError("LLM response did not contain a valid JSON object.", status_code=502)

    try:
        payload = json.loads(candidate[start : end + 1])
    except json.JSONDecodeError as exc:
        raise EvidenceComparatorServiceError("LLM response could not be parsed as JSON.", status_code=502) from exc

    if not isinstance(payload, dict):
        raise EvidenceComparatorServiceError("LLM response JSON must be an object.", status_code=502)

    return payload


def _normalize_string_list(value: Any, field_name: str) -> list[str]:
    if not isinstance(value, list):
        # Fallback for LLM sometimes returning a single string instead of a list
        if isinstance(value, str) and value.strip():
            return [value.strip()]
        return []

    normalized_items: list[str] = []
    for item in value:
        if isinstance(item, str):
            cleaned = item.strip()
            if cleaned and cleaned not in normalized_items:
                normalized_items.append(cleaned)

    return normalized_items


def _validate_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "common_evidence": _normalize_string_list(payload.get("common_evidence"), "common_evidence"),
        "differing_methods": _normalize_string_list(payload.get("differing_methods"), "differing_methods"),
        "differing_datasets": _normalize_string_list(payload.get("differing_datasets"), "differing_datasets"),
        "evidence_clusters": _normalize_string_list(payload.get("evidence_clusters"), "evidence_clusters"),
        "consensus_trends": _normalize_string_list(payload.get("consensus_trends"), "consensus_trends"),
    }


def _extract_groq_content(payload: dict[str, Any]) -> str:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise EvidenceComparatorServiceError("Groq returned an unexpected response shape.", status_code=502) from exc

    if not isinstance(content, str) or not content.strip():
        raise EvidenceComparatorServiceError("Groq returned an empty response.", status_code=502)

    return content


def _extract_gemini_content(payload: dict[str, Any]) -> str:
    try:
        parts = payload["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError, TypeError) as exc:
        raise EvidenceComparatorServiceError("Gemini returned an unexpected response shape.", status_code=502) from exc

    texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    content = "\n".join(text for text in texts if isinstance(text, str) and text.strip()).strip()

    if not content:
        raise EvidenceComparatorServiceError("Gemini returned an empty response.", status_code=502)

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
            raise EvidenceComparatorServiceError("Provider authentication failed.", status_code=502) from exc
        if exc.code == 429:
            raise EvidenceComparatorServiceError(
                "Provider rate limit exceeded. Please retry shortly.",
                status_code=503,
            ) from exc
        raise EvidenceComparatorServiceError("Provider request failed.", status_code=502) from exc
    except (TimeoutError, socket.timeout) as exc:
        raise EvidenceComparatorServiceError("Provider request timed out.", status_code=504) from exc
    except error.URLError as exc:
        raise EvidenceComparatorServiceError("Provider request could not be completed.", status_code=502) from exc
    except json.JSONDecodeError as exc:
        raise EvidenceComparatorServiceError("Provider returned invalid JSON.", status_code=502) from exc


def _call_groq(summaries: list[str], api_key: str) -> dict[str, Any]:
    prompt = _build_evidence_comparator_prompt(summaries)
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
                    "content": "You return only valid JSON for scientific synthesis tasks.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        },
    )
    return _validate_payload(_extract_json_object(_extract_groq_content(payload)))


def _call_gemini(summaries: list[str], api_key: str) -> dict[str, Any]:
    prompt = _build_evidence_comparator_prompt(summaries)
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


def run_evidence_comparator(summaries: list[str]) -> dict[str, Any]:
    if not summaries or len(summaries) < 2:
        raise ValueError("At least two summaries are required for comparison.")
    
    normalized_summaries = [_normalize_summary(s, i) for i, s in enumerate(summaries)]
    settings = get_settings()

    provider_errors: list[str] = []

    if settings.groq_api_key:
        try:
            result = _call_groq(normalized_summaries, settings.groq_api_key)
            return {
                "provider": "groq",
                **result,
            }
        except EvidenceComparatorServiceError as exc:
            LOGGER.exception("Groq evidence comparator request failed.")
            provider_errors.append(f"Groq: {exc}")

    if settings.gemini_api_key:
        try:
            result = _call_gemini(normalized_summaries, settings.gemini_api_key)
            return {
                "provider": "gemini",
                **result,
            }
        except EvidenceComparatorServiceError as exc:
            LOGGER.exception("Gemini evidence comparator request failed.")
            provider_errors.append(f"Gemini: {exc}")

    if not settings.groq_api_key and not settings.gemini_api_key:
        raise EvidenceComparatorServiceError(
            "Evidence Comparator is unavailable. Set GROQ_API_KEY or GEMINI_API_KEY.",
            status_code=503,
        )

    provider_message = " | ".join(provider_errors) if provider_errors else "No provider is available."
    raise EvidenceComparatorServiceError(
        f"Evidence Comparator request failed across all providers. {provider_message}",
        status_code=502,
    )
