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


class GraphQueryError(RuntimeError):
    """Raised when a graph query cannot be completed safely."""


def _require_non_empty(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_name} must not be empty.")
    return cleaned


def create_topic_node(
    topic_id: str,
    name: str,
    description: str | None = None,
    metadata: dict[str, Any] | None = None,
    driver: Driver | None = None,
) -> dict[str, Any]:
    cypher = """
    MERGE (topic:Topic {topic_id: $topic_id})
    ON CREATE SET
        topic.name = $name,
        topic.description = $description,
        topic.metadata = $metadata,
        topic.created_at = datetime()
    ON MATCH SET
        topic.name = $name,
        topic.description = CASE
            WHEN $description IS NULL THEN topic.description
            ELSE $description
        END,
        topic.metadata = CASE
            WHEN size(keys($metadata)) = 0 THEN topic.metadata
            ELSE $metadata
        END,
        topic.updated_at = datetime()
    RETURN topic {
        .topic_id,
        .name,
        .description,
        metadata: coalesce(topic.metadata, {}),
        created_at: toString(topic.created_at),
        updated_at: CASE
            WHEN topic.updated_at IS NULL THEN NULL
            ELSE toString(topic.updated_at)
        END
    } AS topic
    """

    params = {
        "topic_id": _require_non_empty(topic_id, "topic_id"),
        "name": _require_non_empty(name, "name"),
        "description": description.strip() if description else None,
        "metadata": metadata or {},
    }

    active_driver = driver or get_neo4j_driver()

    try:
        with active_driver.session() as session:
            record = session.run(cypher, params).single()
    except (ServiceUnavailable, Neo4jError, RuntimeError) as exc:
        LOGGER.exception("Failed to create or update Topic node.")
        raise GraphQueryError("Failed to create or update Topic node.") from exc

    if not record:
        raise GraphQueryError("Neo4j did not return the Topic node.")

    return dict(record["topic"])


def create_paper_node(
    paper_id: str,
    title: str,
    abstract: str | None = None,
    doi: str | None = None,
    publication_year: int | None = None,
    source: str | None = None,
    metadata: dict[str, Any] | None = None,
    driver: Driver | None = None,
) -> dict[str, Any]:
    cypher = """
    MERGE (paper:Paper {paper_id: $paper_id})
    ON CREATE SET
        paper.title = $title,
        paper.abstract = $abstract,
        paper.doi = $doi,
        paper.publication_year = $publication_year,
        paper.source = $source,
        paper.metadata = $metadata,
        paper.created_at = datetime()
    ON MATCH SET
        paper.title = $title,
        paper.abstract = CASE
            WHEN $abstract IS NULL THEN paper.abstract
            ELSE $abstract
        END,
        paper.doi = CASE
            WHEN $doi IS NULL THEN paper.doi
            ELSE $doi
        END,
        paper.publication_year = CASE
            WHEN $publication_year IS NULL THEN paper.publication_year
            ELSE $publication_year
        END,
        paper.source = CASE
            WHEN $source IS NULL THEN paper.source
            ELSE $source
        END,
        paper.metadata = CASE
            WHEN size(keys($metadata)) = 0 THEN paper.metadata
            ELSE $metadata
        END,
        paper.updated_at = datetime()
    RETURN paper {
        .paper_id,
        .title,
        .abstract,
        .doi,
        .publication_year,
        .source,
        metadata: coalesce(paper.metadata, {}),
        created_at: toString(paper.created_at),
        updated_at: CASE
            WHEN paper.updated_at IS NULL THEN NULL
            ELSE toString(paper.updated_at)
        END
    } AS paper
    """

    params = {
        "paper_id": _require_non_empty(paper_id, "paper_id"),
        "title": _require_non_empty(title, "title"),
        "abstract": abstract.strip() if abstract else None,
        "doi": doi.strip() if doi else None,
        "publication_year": publication_year,
        "source": source.strip() if source else None,
        "metadata": metadata or {},
    }

    active_driver = driver or get_neo4j_driver()

    try:
        with active_driver.session() as session:
            record = session.run(cypher, params).single()
    except (ServiceUnavailable, Neo4jError, RuntimeError) as exc:
        LOGGER.exception("Failed to create or update Paper node.")
        raise GraphQueryError("Failed to create or update Paper node.") from exc

    if not record:
        raise GraphQueryError("Neo4j did not return the Paper node.")

    return dict(record["paper"])


def link_paper_to_topic(
    paper_id: str,
    topic_id: str,
    driver: Driver | None = None,
) -> dict[str, str]:
    cypher = """
    MATCH (paper:Paper {paper_id: $paper_id})
    MATCH (topic:Topic {topic_id: $topic_id})
    MERGE (paper)-[relationship:HAS_TOPIC]->(topic)
    ON CREATE SET relationship.created_at = datetime()
    RETURN paper.paper_id AS paper_id, topic.topic_id AS topic_id
    """

    params = {
        "paper_id": _require_non_empty(paper_id, "paper_id"),
        "topic_id": _require_non_empty(topic_id, "topic_id"),
    }

    active_driver = driver or get_neo4j_driver()

    try:
        with active_driver.session() as session:
            record = session.run(cypher, params).single()
    except (ServiceUnavailable, Neo4jError, RuntimeError) as exc:
        LOGGER.exception("Failed to link Paper node to Topic node.")
        raise GraphQueryError("Failed to link Paper node to Topic node.") from exc

    if not record:
        raise GraphQueryError("Paper or Topic node was not found for linking.")

    return {
        "paper_id": record["paper_id"],
        "topic_id": record["topic_id"],
    }


def fetch_graph_summary_counts(driver: Driver | None = None) -> dict[str, int]:
    cypher = """
    CALL {
        MATCH (node:Topic)
        RETURN count(node) AS topics
    }
    CALL {
        MATCH (node:Paper)
        RETURN count(node) AS papers
    }
    CALL {
        MATCH (node:Author)
        RETURN count(node) AS authors
    }
    CALL {
        MATCH (node:Method)
        RETURN count(node) AS methods
    }
    CALL {
        MATCH (node:Dataset)
        RETURN count(node) AS datasets
    }
    CALL {
        MATCH (node:Contradiction)
        RETURN count(node) AS contradictions
    }
    CALL {
        MATCH (node:Gap)
        RETURN count(node) AS gaps
    }
    CALL {
        MATCH ()-[relationship]->()
        RETURN count(relationship) AS total_relationships
    }
    CALL {
        MATCH (:Paper)-[relationship:HAS_TOPIC]->(:Topic)
        RETURN count(relationship) AS paper_topic_links
    }
    RETURN {
        topics: topics,
        papers: papers,
        authors: authors,
        methods: methods,
        datasets: datasets,
        contradictions: contradictions,
        gaps: gaps,
        total_relationships: total_relationships,
        paper_topic_links: paper_topic_links
    } AS summary
    """

    active_driver = driver or get_neo4j_driver()

    try:
        with active_driver.session() as session:
            record = session.run(cypher).single()
    except (ServiceUnavailable, Neo4jError, RuntimeError) as exc:
        LOGGER.exception("Failed to fetch graph summary counts.")
        raise GraphQueryError("Failed to fetch graph summary counts.") from exc

    if not record:
        raise GraphQueryError("Neo4j did not return graph summary counts.")

    summary = dict(record["summary"])
    return {key: int(value) for key, value in summary.items()}


def fetch_recent_papers(limit: int = 10, driver: Driver | None = None) -> list[dict[str, Any]]:
    if limit < 1:
        raise ValueError("limit must be greater than 0.")

    cypher = """
    MATCH (paper:Paper)
    RETURN paper {
        .paper_id,
        .title,
        .source,
        .publication_year,
        created_at: CASE
            WHEN paper.created_at IS NULL THEN NULL
            ELSE toString(paper.created_at)
        END
    } AS paper
    ORDER BY paper.publication_year DESC, paper.created_at DESC
    LIMIT $limit
    """

    active_driver = driver or get_neo4j_driver()

    try:
        with active_driver.session() as session:
            records = session.run(cypher, {"limit": int(limit)}).data()
    except (ServiceUnavailable, Neo4jError, RuntimeError) as exc:
        LOGGER.exception("Failed to fetch recent papers.")
        raise GraphQueryError("Failed to fetch recent papers.") from exc

    papers: list[dict[str, Any]] = []
    for record in records:
        paper = dict(record["paper"])
        papers.append(
            {
                "paper_id": paper.get("paper_id"),
                "title": paper.get("title"),
                "source": paper.get("source"),
                "year": paper.get("publication_year"),
                "created_at": paper.get("created_at"),
            }
        )

    return papers


def fetch_graph_data(driver: Driver | None = None) -> dict[str, int]:
    allowed_labels = ["Topic", "Paper", "Method", "Dataset", "Gap"]
    cypher = """
    CALL {
        MATCH (node)
        RETURN count(node) AS total_nodes
    }
    CALL {
        MATCH ()-[relationship]->()
        RETURN count(relationship) AS total_relationships
    }
    CALL {
        MATCH (paper:Paper)
        RETURN count(paper) AS papers_count
    }
    CALL {
        MATCH (topic:Topic)
        RETURN count(topic) AS topics_count
    }
    CALL {
        MATCH (method:Method)
        RETURN count(method) AS methods_count
    }
    CALL {
        MATCH (dataset:Dataset)
        RETURN count(dataset) AS datasets_count
    }
    CALL {
        MATCH (gap:Gap)
        RETURN count(gap) AS gaps_count
    }
    CALL {
        WITH $allowed_labels AS allowed_labels
        MATCH (node)
        WHERE any(label IN labels(node) WHERE label IN allowed_labels)
        RETURN collect(
            DISTINCT {
                node_id: elementId(node),
                label: head([label IN labels(node) WHERE label IN allowed_labels]),
                display_name: CASE
                    WHEN "Topic" IN labels(node) THEN coalesce(node.name, node.topic_id, "Unnamed Topic")
                    WHEN "Paper" IN labels(node) THEN coalesce(node.title, node.paper_id, "Untitled Paper")
                    WHEN "Method" IN labels(node) THEN coalesce(node.name, node.method_id, "Unnamed Method")
                    WHEN "Dataset" IN labels(node) THEN coalesce(node.name, node.dataset_id, "Unnamed Dataset")
                    WHEN "Gap" IN labels(node) THEN coalesce(node.name, node.description, node.gap_id, "Unnamed Gap")
                    ELSE "Unnamed Node"
                END,
                details: properties(node)
            }
        ) AS visualization_nodes
    }
    CALL {
        WITH $allowed_labels AS allowed_labels
        MATCH (source)-[relationship]->(target)
        WHERE any(label IN labels(source) WHERE label IN allowed_labels)
          AND any(label IN labels(target) WHERE label IN allowed_labels)
        RETURN collect(
            DISTINCT {
                edge_id: elementId(relationship),
                source_id: elementId(source),
                target_id: elementId(target),
                relationship_type: type(relationship)
            }
        ) AS visualization_edges
    }
    RETURN {
        total_nodes: total_nodes,
        total_relationships: total_relationships,
        papers_count: papers_count,
        topics_count: topics_count,
        methods_count: methods_count,
        datasets_count: datasets_count,
        gaps_count: gaps_count,
        nodes: visualization_nodes,
        edges: visualization_edges
    } AS graph_data
    """

    active_driver = driver or get_neo4j_driver()

    try:
        with active_driver.session() as session:
            record = session.run(cypher, {"allowed_labels": allowed_labels}).single()
    except (ServiceUnavailable, Neo4jError, RuntimeError) as exc:
        LOGGER.exception("Failed to fetch graph data.")
        raise GraphQueryError("Failed to fetch graph data.") from exc

    if not record:
        raise GraphQueryError("Neo4j did not return graph data.")

    raw_graph_data = dict(record["graph_data"])

    return {
        "total_nodes": int(raw_graph_data["total_nodes"]),
        "total_relationships": int(raw_graph_data["total_relationships"]),
        "papers_count": int(raw_graph_data["papers_count"]),
        "topics_count": int(raw_graph_data["topics_count"]),
        "methods_count": int(raw_graph_data["methods_count"]),
        "datasets_count": int(raw_graph_data["datasets_count"]),
        "gaps_count": int(raw_graph_data["gaps_count"]),
        "nodes": list(raw_graph_data.get("nodes", [])),
        "edges": list(raw_graph_data.get("edges", [])),
    }

def create_user(tx, name, email, password):
    tx.run(
        """
        MERGE (u:User {email: $email})
        SET u.name = $name,
            u.password = $password
        """,
        name=name,
        email=email,
        password=password
    )


def find_user(tx, email):
    result = tx.run(
        """
        MATCH (u:User {email: $email})
        RETURN u.name AS name, u.email AS email, u.password AS password
        """,
        email=email
    )
    return result.single()