from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any, Literal, TypeVar


GeminiSlot = Literal["primary", "secondary"]
GeminiResultT = TypeVar("GeminiResultT")


def _is_quota_error(exc: Exception) -> bool:
    status_code = getattr(exc, "status_code", None)
    message = str(exc).lower()
    return status_code == 503 or any(
        fragment in message
        for fragment in (
            "rate limit",
            "quota",
            "resource has been exhausted",
            "429",
        )
    )


def call_gemini_with_fallback(
    *,
    agent_name: str,
    settings: Any,
    logger: logging.Logger,
    preferred_slot: GeminiSlot,
    call_with_api_key: Callable[[str], GeminiResultT],
) -> GeminiResultT:
    fallback_slot: GeminiSlot = "secondary" if preferred_slot == "primary" else "primary"
    preferred_key = settings.gemini_key_for(preferred_slot)
    fallback_key = settings.gemini_key_for(fallback_slot)

    if preferred_key:
        logger.info("%s using Gemini %s key.", agent_name, preferred_slot)
        try:
            return call_with_api_key(preferred_key)
        except Exception as exc:
            if fallback_key and fallback_key != preferred_key and _is_quota_error(exc):
                logger.warning(
                    "%s Gemini %s key quota exhausted. Retrying with Gemini %s key.",
                    agent_name,
                    preferred_slot,
                    fallback_slot,
                )
                logger.info("%s using Gemini %s key.", agent_name, fallback_slot)
                return call_with_api_key(fallback_key)
            raise

    if fallback_key:
        logger.info(
            "%s using Gemini %s key because Gemini %s key is unavailable.",
            agent_name,
            fallback_slot,
            preferred_slot,
        )
        return call_with_api_key(fallback_key)

    raise RuntimeError("No Gemini API key is configured.")
