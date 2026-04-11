from __future__ import annotations

import logging
import re
import uuid
from typing import Any

try:
    from neo4j import Driver
    from neo4j.exceptions import Neo4jError, ServiceUnavailable
except ModuleNotFoundError:  # pragma: no cover
    Driver = Any  # type: ignore[assignment]
    class Neo4jError(Exception): pass
    class ServiceUnavailable(Neo4jError): pass

try:
    from backend.neo4j.connection import get_neo4j_driver
except ModuleNotFoundError:
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
            WHEN size(keys($metadata_dict)) = 0 THEN topic.metadata
            ELSE $metadata
        END,
        topic.updated_at = datetime()
    RETURN topic {
        .topic_id,
        .name,
        .description,
        metadata: coalesce(topic.metadata, "{}"),
        created_at: toString(topic.created_at),
        updated_at: CASE
            WHEN topic.updated_at IS NULL THEN NULL
            ELSE toString(topic.updated_at)
        END
    } AS topic
    """
    import json
    metadata_val = metadata or {}
    params = {
        "topic_id": _require_non_empty(topic_id, "topic_id"),
        "name": _require_non_empty(name, "name"),
        "description": description.strip() if description else None,
        "metadata_dict": metadata_val,
        "metadata": json.dumps(metadata_val),
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
    source_url: str | None = None,
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
        paper.source_url = $source_url,
        paper.pdf_url = $pdf_url,
        paper.metadata = $metadata,
        paper.created_at = datetime()
    ON MATCH SET
        paper.title = $title,
        paper.abstract = CASE WHEN $abstract IS NOT NULL THEN $abstract ELSE paper.abstract END,
        paper.doi = CASE WHEN $doi IS NOT NULL THEN $doi ELSE paper.doi END,
        paper.publication_year = CASE WHEN $publication_year IS NOT NULL THEN $publication_year ELSE paper.publication_year END,
        paper.source = CASE WHEN $source IS NOT NULL THEN $source ELSE paper.source END,
        paper.source_url = CASE WHEN $source_url IS NOT NULL THEN $source_url ELSE paper.source_url END,
        paper.pdf_url = CASE WHEN $pdf_url IS NOT NULL THEN $pdf_url ELSE paper.pdf_url END,
        paper.metadata = CASE WHEN size(keys($metadata_dict)) > 0 THEN $metadata ELSE paper.metadata END,
        paper.updated_at = datetime()
    RETURN paper {
        .paper_id,
        .title,
        .abstract,
        .doi,
        .publication_year,
        .source,
        .source_url,
        .pdf_url,
        metadata: coalesce(paper.metadata, "{}"),
        created_at: toString(paper.created_at),
        updated_at: CASE WHEN paper.updated_at IS NULL THEN NULL ELSE toString(paper.updated_at) END
    } AS paper
    """
    import json
    metadata_val = metadata or {}
    params = {
        "paper_id": paper_id.strip() if paper_id else title.strip(),
        "title": title.strip() if title else "Untitled Paper",
        "abstract": abstract.strip() if abstract else None,
        "doi": doi.strip() if doi else None,
        "publication_year": publication_year,
        "source": source.strip() if source else None,
        "source_url": source_url or metadata_val.get("url") or metadata_val.get("source_url"),
        "pdf_url": metadata_val.get("pdf_url"),
        "metadata_dict": metadata_val,
        "metadata": json.dumps(metadata_val)
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


def build_topic_id(research_topic: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", research_topic.lower()).strip("-")
    suffix = uuid.uuid5(uuid.NAMESPACE_URL, research_topic.lower()).hex[:12]
    return f"topic-{slug[:64]}-{suffix}" if slug else f"topic-{suffix}"


def link_paper_to_topic(
    paper_id: str,
    topic_id: str,
    driver: Driver | None = None,
) -> dict[str, str]:
    # Bi-directional consistency: Topic owns papers semantically
    cypher = """
    MATCH (paper:Paper {paper_id: $paper_id})
    MATCH (topic:Topic {topic_id: $topic_id})
    MERGE (topic)-[relationship:HAS_PAPER]->(paper)
    MERGE (paper)-[:HAS_TOPIC]->(topic)
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


def log_user_search(
    user_email: str,
    topic_id: str,
    driver: Driver | None = None,
) -> dict[str, str]:
    cypher = """
    MATCH (topic:Topic {topic_id: $topic_id})
    MERGE (user:User {email: $user_email})
    MERGE (user)-[relationship:SEARCHED_TOPIC]->(topic)
    ON CREATE SET relationship.created_at = datetime()
    RETURN user.email AS user_email, topic.topic_id AS topic_id
    """

    params = {
        "user_email": _require_non_empty(user_email, "user_email"),
        "topic_id": _require_non_empty(topic_id, "topic_id"),
    }

    active_driver = driver or get_neo4j_driver()

    try:
        with active_driver.session() as session:
            record = session.run(cypher, params).single()
    except (ServiceUnavailable, Neo4jError, RuntimeError) as exc:
        LOGGER.exception("Failed to log User search relationship.")
        raise GraphQueryError("Failed to log User search relationship.") from exc

    if not record:
        raise GraphQueryError("User or Topic node was not found for linking.")

    return {
        "user_email": record["user_email"],
        "topic_id": record["topic_id"],
    }


def save_paper_for_user(
    user_email: str,
    paper_id: str,
    driver: Driver | None = None,
) -> dict[str, str]:
    cypher = """
    MATCH (paper:Paper {paper_id: $paper_id})
    MERGE (user:User {email: $user_email})
    MERGE (user)-[relationship:SAVED]->(paper)
    ON CREATE SET relationship.created_at = datetime()
    RETURN user.email AS user_email, paper.paper_id AS paper_id
    """

    params = {
        "user_email": _require_non_empty(user_email, "user_email"),
        "paper_id": _require_non_empty(paper_id, "paper_id"),
    }

    active_driver = driver or get_neo4j_driver()

    try:
        with active_driver.session() as session:
            record = session.run(cypher, params).single()
    except (ServiceUnavailable, Neo4jError, RuntimeError) as exc:
        LOGGER.exception("Failed to log User saved paper relationship.")
        raise GraphQueryError("Failed to log User saved paper relationship.") from exc

    if not record:
        raise GraphQueryError("User or Paper node was not found for linking.")

    return {
        "user_email": record["user_email"],
        "paper_id": record["paper_id"],
    }


def fetch_graph_summary_counts(driver: Driver | None = None) -> dict[str, int]:
    cypher = """
    MATCH (n)
    WITH count(n) AS total_nodes
    OPTIONAL MATCH (p:Paper)
    WITH total_nodes, count(p) AS papers
    OPTIONAL MATCH ()-[r]->()
    RETURN {
        papers_count: papers,
        graph_nodes: total_nodes,
        relationships: count(r)
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
        return {
            "papers_count": 0,
            "graph_nodes": 0,
            "relationships": 0
        }

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
    allowed_labels = ["Topic", "Paper", "Method", "Dataset", "Gap", "User"]
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
                id: elementId(node),
                label: head([label IN labels(node) WHERE label IN allowed_labels]),
                type: head([label IN labels(node) WHERE label IN allowed_labels]),
                display_name: CASE
                    WHEN "User" IN labels(node) THEN coalesce(node.name, node.email, "Anonymous User")
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
                source: elementId(source),
                target_id: elementId(target),
                target: elementId(target),
                relationship_type: type(relationship),
                relation: type(relationship)
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

    nodes: list[dict[str, Any]] = []
    for node in raw_graph_data.get("nodes", []):
        # Ensure all property values in 'details' are JSON serializable
        details = node.get("details", {})
        for key, value in details.items():
            # Check for common Neo4j non-serializable types (DateTime, etc)
            if hasattr(value, "__class__") and "neo4j" in str(value.__class__):
                details[key] = str(value)
        node["details"] = details
        nodes.append(node)

    return {
        "total_nodes": int(raw_graph_data["total_nodes"]),
        "total_relationships": int(raw_graph_data["total_relationships"]),
        "papers_count": int(raw_graph_data["papers_count"]),
        "topics_count": int(raw_graph_data["topics_count"]),
        "methods_count": int(raw_graph_data["methods_count"]),
        "datasets_count": int(raw_graph_data["datasets_count"]),
        "gaps_count": int(raw_graph_data["gaps_count"]),
        "nodes": nodes,
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