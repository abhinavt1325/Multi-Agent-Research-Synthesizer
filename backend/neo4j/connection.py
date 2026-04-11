from __future__ import annotations

import logging
from contextlib import contextmanager
from functools import lru_cache
from typing import Any, Generator
from urllib.parse import urlparse

try:
    from neo4j import Driver, GraphDatabase, TrustSystemCAs
    from neo4j.exceptions import AuthError, ConfigurationError, Neo4jError, ServiceUnavailable
except ModuleNotFoundError:  # pragma: no cover - import-safe when dependency is absent
    Driver = Any  # type: ignore[assignment]
    GraphDatabase = None
    TrustSystemCAs = None

    class Neo4jError(Exception):
        """Fallback Neo4j base exception when the dependency is unavailable."""

    class ServiceUnavailable(Neo4jError):
        """Fallback service-unavailable exception."""

    class AuthError(Neo4jError):
        """Fallback authentication exception."""

    class ConfigurationError(Neo4jError):
        """Fallback configuration exception."""

try:
    from backend.config.settings import get_settings
except ModuleNotFoundError:  # pragma: no cover - supports execution from backend/
    from config.settings import get_settings


LOGGER = logging.getLogger(__name__)
AURA_HOST_SUFFIXES = (".databases.neo4j.io", ".neo4j.io")


def _require_connection_settings() -> tuple[str, str, str]:
    settings = get_settings()
    missing = [
        name
        for name, value in (
            ("NEO4J_URI", settings.neo4j_uri),
            ("NEO4J_USERNAME", settings.neo4j_username),
            ("NEO4J_PASSWORD", settings.neo4j_password),
        )
        if not value
    ]

    if missing:
        missing_values = ", ".join(missing)
        raise RuntimeError(f"Missing required Neo4j configuration: {missing_values}.")

    return settings.neo4j_uri, settings.neo4j_username, settings.neo4j_password


def _is_aura_hostname(hostname: str | None) -> bool:
    if not hostname:
        return False

    normalized_hostname = hostname.lower()
    return any(normalized_hostname.endswith(suffix) for suffix in AURA_HOST_SUFFIXES)


def _build_driver_config(uri: str) -> tuple[str, dict[str, Any]]:
    parsed_uri = urlparse(uri)
    scheme = parsed_uri.scheme.lower()
    hostname = parsed_uri.hostname

    if not scheme:
        raise RuntimeError("NEO4J_URI must include a valid URI scheme such as neo4j+s://.")

    if _is_aura_hostname(hostname) and scheme not in {"neo4j+s", "bolt+s", "neo4j", "bolt"}:
        raise RuntimeError(
            "Neo4j Aura requires a CA-validated secure URI. Use neo4j+s:// (or bolt+s://) for Aura connections.",
        )

    # To fix Windows CA errors with neo4j+s, we downgrade the scheme to standard neo4j/bolt 
    # to manually inject the global certifi root certificates.
    if scheme == "neo4j+s":
        uri = uri.replace("neo4j+s", "neo4j", 1)
        scheme = "neo4j"
    elif scheme == "bolt+s":
        uri = uri.replace("bolt+s", "bolt", 1)
        scheme = "bolt"

    driver_config: dict[str, Any] = {
        "max_connection_lifetime": 3600,
        "max_connection_pool_size": 50,
        "connection_timeout": 30,
        "keep_alive": True,
        "user_agent": "multi-agent-research-synthesizer/1.0",
    }

    if scheme in {"neo4j", "bolt"} and TrustSystemCAs is not None:
        driver_config["encrypted"] = True
        try:
            import certifi
            from neo4j import TrustCustomCAs
            driver_config["trusted_certificates"] = TrustCustomCAs(certifi.where())
        except ImportError:
            driver_config["trusted_certificates"] = TrustSystemCAs()

    return uri, driver_config


@lru_cache(maxsize=1)
def get_neo4j_driver() -> Driver:
    if GraphDatabase is None:
        raise RuntimeError("The neo4j package is not installed. Install the official neo4j Python driver.")

    raw_uri, username, password = _require_connection_settings()
    uri, driver_config = _build_driver_config(raw_uri)

    try:
        return GraphDatabase.driver(
            uri,
            auth=(username, password),
            **driver_config,
        )
    except (AuthError, ConfigurationError, ServiceUnavailable, Neo4jError) as exc:
        LOGGER.exception("Failed to initialize Neo4j driver.")
        raise RuntimeError("Failed to initialize the Neo4j driver.") from exc


@contextmanager
def get_neo4j_session(database: str | None = None) -> Generator[Any, None, None]:
    driver = get_neo4j_driver()

    try:
        with driver.session(database=database) as session:
            yield session
    except (ServiceUnavailable, Neo4jError) as exc:
        LOGGER.exception("Neo4j session operation failed.")
        raise RuntimeError("Neo4j session operation failed.") from exc


def check_neo4j_health() -> bool:
    try:
        driver = get_neo4j_driver()
        driver.verify_connectivity()

        with driver.session() as session:
            record = session.run("RETURN 1 AS ok").single()

        return bool(record and record.get("ok") == 1)
    except (RuntimeError, ServiceUnavailable, Neo4jError):
        LOGGER.exception("Neo4j health check failed.")
        return False


def close_neo4j_driver() -> None:
    try:
        driver = get_neo4j_driver()
    except RuntimeError:
        return

    driver.close()
    get_neo4j_driver.cache_clear()

from neo4j import GraphDatabase
import os

_driver = GraphDatabase.driver(
    os.getenv("NEO4J_URI"),
    auth=(
        os.getenv("NEO4J_USERNAME"),
        os.getenv("NEO4J_PASSWORD")
    )
)

def get_driver():
    return _driver