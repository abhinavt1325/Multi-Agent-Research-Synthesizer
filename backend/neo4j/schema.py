from __future__ import annotations

import logging
from typing import Any

try:
    from neo4j import Driver
    from neo4j.exceptions import Neo4jError, ServiceUnavailable
except ModuleNotFoundError:  # pragma: no cover - import-safe when dependency is absent
    Driver = Any  # type: ignore[assignment]

    class Neo4jError(Exception):
        """Fallback Neo4j base exception when the dependency is unavailable."""

    class ServiceUnavailable(Neo4jError):
        """Fallback service-unavailable exception."""

try:
    from backend.neo4j.connection import get_neo4j_driver
except ModuleNotFoundError:  # pragma: no cover - supports execution from backend/
    from .connection import get_neo4j_driver


LOGGER = logging.getLogger(__name__)

NODE_LABELS: tuple[str, ...] = (
    "Topic",
    "Paper",
    "Author",
    "Method",
    "Dataset",
    "Contradiction",
    "Gap",
)

RELATIONSHIP_TYPES: tuple[str, ...] = (
    "CITES",
    "WRITTEN_BY",
    "USES_METHOD",
    "TESTED_ON",
    "CONTRADICTS",
    "IDENTIFIES_GAP",
    "HAS_TOPIC",
)

SCHEMA_STATEMENTS: tuple[str, ...] = (
    "CREATE CONSTRAINT topic_topic_id_unique IF NOT EXISTS FOR (node:Topic) REQUIRE node.topic_id IS UNIQUE",
    "CREATE CONSTRAINT paper_paper_id_unique IF NOT EXISTS FOR (node:Paper) REQUIRE node.paper_id IS UNIQUE",
    "CREATE CONSTRAINT author_author_id_unique IF NOT EXISTS FOR (node:Author) REQUIRE node.author_id IS UNIQUE",
    "CREATE CONSTRAINT method_method_id_unique IF NOT EXISTS FOR (node:Method) REQUIRE node.method_id IS UNIQUE",
    "CREATE CONSTRAINT dataset_dataset_id_unique IF NOT EXISTS FOR (node:Dataset) REQUIRE node.dataset_id IS UNIQUE",
    "CREATE CONSTRAINT contradiction_contradiction_id_unique IF NOT EXISTS FOR (node:Contradiction) REQUIRE node.contradiction_id IS UNIQUE",
    "CREATE CONSTRAINT gap_gap_id_unique IF NOT EXISTS FOR (node:Gap) REQUIRE node.gap_id IS UNIQUE",
    "CREATE INDEX topic_name_index IF NOT EXISTS FOR (node:Topic) ON (node.name)",
    "CREATE INDEX paper_title_index IF NOT EXISTS FOR (node:Paper) ON (node.title)",
    "CREATE INDEX paper_doi_index IF NOT EXISTS FOR (node:Paper) ON (node.doi)",
    "CREATE INDEX paper_publication_year_index IF NOT EXISTS FOR (node:Paper) ON (node.publication_year)",
    "CREATE INDEX author_name_index IF NOT EXISTS FOR (node:Author) ON (node.name)",
    "CREATE INDEX method_name_index IF NOT EXISTS FOR (node:Method) ON (node.name)",
    "CREATE INDEX dataset_name_index IF NOT EXISTS FOR (node:Dataset) ON (node.name)",
)


class GraphSchemaError(RuntimeError):
    """Raised when the graph schema cannot be created or updated."""


def get_node_labels() -> tuple[str, ...]:
    return NODE_LABELS


def get_relationship_types() -> tuple[str, ...]:
    return RELATIONSHIP_TYPES


def get_schema_statements() -> tuple[str, ...]:
    return SCHEMA_STATEMENTS


def apply_graph_schema(driver: Driver | None = None) -> None:
    active_driver = driver or get_neo4j_driver()

    try:
        with active_driver.session() as session:
            for statement in SCHEMA_STATEMENTS:
                session.run(statement).consume()
    except (ServiceUnavailable, Neo4jError, RuntimeError) as exc:
        LOGGER.exception("Failed to apply Neo4j schema.")
        raise GraphSchemaError("Failed to apply the Neo4j graph schema.") from exc
