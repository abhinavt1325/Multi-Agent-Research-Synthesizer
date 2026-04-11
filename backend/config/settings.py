from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env", override=False)
load_dotenv(BASE_DIR / "backend" / ".env", override=False)


@dataclass(frozen=True)
class Settings:
    groq_api_key: str | None
    gemini_api_key: str | None
    neo4j_uri: str | None
    neo4j_username: str | None
    neo4j_password: str | None
    semantic_scholar_api_key: str | None
    frontend_origins: list[str]


def _get_env(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None

    cleaned = value.strip()
    return cleaned or None


def _get_frontend_origins() -> list[str]:
    configured = os.getenv("FRONTEND_ORIGINS", "")
    origins = [origin.strip() for origin in configured.split(",") if origin.strip()]

    if origins:
        return origins

    return [
        "http://localhost:3000",
        "http://localhost:5173",
    ]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        groq_api_key=_get_env("GROQ_API_KEY"),
        gemini_api_key=_get_env("GEMINI_API_KEY"),
        neo4j_uri=_get_env("NEO4J_URI"),
        neo4j_username=_get_env("NEO4J_USERNAME"),
        neo4j_password=_get_env("NEO4J_PASSWORD"),
        semantic_scholar_api_key=_get_env("SEMANTIC_SCHOLAR_API_KEY"),
        frontend_origins=_get_frontend_origins(),
    )
