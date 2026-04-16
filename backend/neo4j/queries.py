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
LIVE_NODE_LABELS: tuple[str, ...] = ("User", "Topic", "Paper", "Method", "Dataset", "Gap")
RELATED_NODE_LABELS: tuple[str, ...] = ("Topic", "Method", "Dataset", "Gap")

class GraphQueryError(RuntimeError):
    """Raised when a graph query cannot be completed safely."""

def _require_non_empty(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_name} must not be empty.")
    return cleaned


def _run_query(
    query: str,
    params: dict[str, Any] | None = None,
    driver: Driver | None = None,
    query_name: str = "unnamed_query",
    single: bool = False,
    as_data: bool = False
) -> Any:
    """
    Executes a Cypher query with a single retry for defunct connections.
    Ensures fresh session handling per call.
    """
    active_driver = driver or get_neo4j_driver()
    params = params or {}
    
    def attempt_execution():
        with active_driver.session() as session:
            result = session.run(query, params)
            if single:
                return result.single()
            if as_data:
                return result.data()
            return result

    try:
        return attempt_execution()
    except (ServiceUnavailable, Neo4jError) as exc:
        # Retry only once if connection is defunct/stale
        error_msg = str(exc).lower()
        if "defunct" in error_msg or "service unavailable" in error_msg or "session expired" in error_msg:
            LOGGER.warning(f"Retrying {query_name} due to defunct connection.")
            try:
                return attempt_execution()
            except Exception as retry_exc:
                LOGGER.error(f"Retry failed for {query_name}: {retry_exc}")
                raise GraphQueryError(f"Neo4j operation '{query_name}' failed after retry.") from retry_exc
        
        LOGGER.exception(f"Neo4j query '{query_name}' failed.")
        raise GraphQueryError(f"Failed to execute query '{query_name}'.") from exc
    except Exception as exc:
        LOGGER.exception(f"Unexpected error during query '{query_name}'.")
        raise GraphQueryError(f"Unexpected error during query '{query_name}'.") from exc


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
    record = _run_query(
        cypher, 
        params, 
        driver=active_driver, 
        query_name="create_topic_node", 
        single=True
    )

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
    record = _run_query(
        cypher, 
        params, 
        driver=active_driver, 
        query_name="create_paper_node", 
        single=True
    )

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
    cypher = """
    MATCH (paper:Paper {paper_id: $paper_id})
    MATCH (topic:Topic {topic_id: $topic_id})
    MERGE (topic)-[relationship:HAS_PAPER]->(paper)
    ON CREATE SET relationship.created_at = datetime()
    RETURN paper.paper_id AS paper_id, topic.topic_id AS topic_id
    """

    params = {
        "paper_id": _require_non_empty(paper_id, "paper_id"),
        "topic_id": _require_non_empty(topic_id, "topic_id"),
    }

    active_driver = driver or get_neo4j_driver()
    record = _run_query(
        cypher, 
        params, 
        driver=active_driver, 
        query_name="link_paper_to_topic", 
        single=True
    )

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
    record = _run_query(
        cypher, 
        params, 
        driver=active_driver, 
        query_name="log_user_search", 
        single=True
    )

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
    record = _run_query(
        cypher, 
        params, 
        driver=active_driver, 
        query_name="save_paper_for_user", 
        single=True
    )

    if not record:
        raise GraphQueryError("User or Paper node was not found for linking.")

    return {
        "user_email": record["user_email"],
        "paper_id": record["paper_id"],
    }


def _normalize_graph_property_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _normalize_graph_property_value(item) for key, item in value.items()}

    if isinstance(value, list):
        return [_normalize_graph_property_value(item) for item in value]

    value_module = getattr(value.__class__, "__module__", "")
    if value_module.startswith("neo4j"):
        return str(value)

    return value


def _coerce_graph_payload(raw_graph_data: dict[str, Any] | None) -> dict[str, Any]:
    if not raw_graph_data:
        return {
            "total_nodes": 0,
            "total_relationships": 0,
            "papers_count": 0,
            "topics_count": 0,
            "methods_count": 0,
            "datasets_count": 0,
            "gaps_count": 0,
            "nodes": [],
            "edges": [],
        }

    nodes: list[dict[str, Any]] = []
    for raw_node in raw_graph_data.get("nodes", []):
        node = dict(raw_node)
        node["details"] = _normalize_graph_property_value(node.get("details", {}))
        nodes.append(node)

    return {
        "total_nodes": int(raw_graph_data.get("total_nodes", 0)),
        "total_relationships": int(raw_graph_data.get("total_relationships", 0)),
        "papers_count": int(raw_graph_data.get("papers_count", 0)),
        "topics_count": int(raw_graph_data.get("topics_count", 0)),
        "methods_count": int(raw_graph_data.get("methods_count", 0)),
        "datasets_count": int(raw_graph_data.get("datasets_count", 0)),
        "gaps_count": int(raw_graph_data.get("gaps_count", 0)),
        "nodes": nodes,
        "edges": [dict(edge) for edge in raw_graph_data.get("edges", [])],
    }


def fetch_graph_summary_counts(user_email: str | None = None, driver: Driver | None = None) -> dict[str, int]:
    if not user_email:
        return {"papers_count": 0, "graph_nodes": 0, "relationships": 0}

    counts_cypher = """
    MATCH (u:User {email: $user_email})
    CALL {
        WITH u
        MATCH (u)-[:SAVED]->(p:Paper) RETURN count(DISTINCT p) AS papers_count
    }
    CALL {
        WITH u
        MATCH (u)-[*0..3]-(n)
        WHERE any(label IN labels(n) WHERE label IN ["Topic", "Paper", "Method", "Dataset", "Gap", "User"])
        RETURN count(DISTINCT n) AS graph_nodes
    }
    CALL {
        WITH u
        MATCH (u)-[*0..3]-(n)
        WHERE any(label IN labels(n) WHERE label IN ["Topic", "Paper", "Method", "Dataset", "Gap", "User"])
        WITH collect(DISTINCT n) AS viz_nodes
        UNWIND viz_nodes AS source
        MATCH (source)-[r]->(target)
        WHERE target IN viz_nodes
        RETURN count(DISTINCT r) AS relationships_count
    }
    RETURN papers_count, graph_nodes, relationships_count
    """
    
    active_driver = driver or get_neo4j_driver()
    record = _run_query(
        counts_cypher, 
        {"user_email": user_email}, 
        driver=active_driver, 
        query_name="fetch_graph_summary_counts", 
        single=True
    )

    if not record:
        return {"papers_count": 0, "graph_nodes": 0, "relationships": 0}

    return {
        "papers_count": int(record["papers_count"]),
        "graph_nodes": int(record["graph_nodes"]),
        "relationships": int(record["relationships_count"]),
    }


def fetch_recent_papers(user_email: str, limit: int = 10, driver: Driver | None = None) -> list[dict[str, Any]]:
    if limit < 1:
        raise ValueError("limit must be greater than 0.")

    normalized_user_email = user_email.strip()
    if not normalized_user_email:
        return []

    cypher = """
    MATCH (user:User {email: $user_email})
    OPTIONAL MATCH (user)-[:SAVED]->(saved_paper:Paper)
    OPTIONAL MATCH (user)-[:SEARCHED_TOPIC]->(topic:Topic)
    OPTIONAL MATCH (topic)-[:HAS_PAPER]->(topic_paper:Paper)
    OPTIONAL MATCH (topic)<-[:HAS_TOPIC]-(legacy_topic_paper:Paper)
    WITH collect(DISTINCT saved_paper)
         + collect(DISTINCT topic_paper)
         + collect(DISTINCT legacy_topic_paper) AS paper_candidates
    UNWIND CASE
        WHEN size(paper_candidates) = 0 THEN [NULL]
        ELSE paper_candidates
    END AS paper
    WITH DISTINCT paper
    WHERE paper IS NOT NULL
    RETURN paper {
        .paper_id,
        .title,
        .source,
        .publication_year,
        created_at: CASE
            WHEN coalesce(paper.updated_at, paper.created_at) IS NULL THEN NULL
            ELSE toString(coalesce(paper.updated_at, paper.created_at))
        END
    } AS paper
    ORDER BY coalesce(paper.publication_year, 0) DESC, coalesce(paper.updated_at, paper.created_at) DESC
    LIMIT $limit
    """

    active_driver = driver or get_neo4j_driver()
    records = _run_query(
        cypher, 
        {"limit": int(limit), "user_email": normalized_user_email}, 
        driver=active_driver, 
        query_name="fetch_recent_papers", 
        as_data=True
    )

    papers: list[dict[str, Any]] = []
    for record in records:
        if not record or "paper" not in record: continue
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


def fetch_graph_data(user_email: str | None = None, driver: Driver | None = None) -> dict[str, Any]:
    live_labels = list(LIVE_NODE_LABELS)
    normalized_user_email = (user_email or "").strip()

    if not normalized_user_email:
        return _coerce_graph_payload(None)

    cypher_projection = """
    WITH viz_nodes_list, viz_edges_list, $live_labels AS live_labels
    RETURN {
        total_nodes: size(viz_nodes_list),
        total_relationships: size(viz_edges_list),
        papers_count: size([n IN viz_nodes_list WHERE "Paper" IN labels(n)]),
        topics_count: size([n IN viz_nodes_list WHERE "Topic" IN labels(n)]),
        methods_count: size([n IN viz_nodes_list WHERE "Method" IN labels(n)]),
        datasets_count: size([n IN viz_nodes_list WHERE "Dataset" IN labels(n)]),
        gaps_count: size([n IN viz_nodes_list WHERE "Gap" IN labels(n)]),
        nodes: [node IN viz_nodes_list | {
            node_id: elementId(node),
            id: elementId(node),
            label: head([label IN labels(node) WHERE label IN live_labels]),
            type: head([label IN labels(node) WHERE label IN live_labels]),
            display_name: CASE
                WHEN "User" IN labels(node) THEN coalesce(node.name, node.email, "Anonymous User")
                WHEN "Topic" IN labels(node) THEN coalesce(node.name, node.topic_id, "Unnamed Topic")
                WHEN "Paper" IN labels(node) THEN coalesce(node.title, node.paper_id, "Untitled Paper")
                WHEN "Method" IN labels(node) THEN coalesce(node.name, node.method_id, "Unnamed Method")
                WHEN "Dataset" IN labels(node) THEN coalesce(node.name, node.dataset_id, "Unnamed Dataset")
                WHEN "Gap" IN labels(node) THEN coalesce(node.name, node.description, node.gap_id, "Unnamed Gap")
                ELSE "Unnamed Node"
            END,
            details: {
                name: coalesce(node.name, ""),
                title: coalesce(node.title, ""),
                email: coalesce(node.email, ""),
                paper_id: coalesce(node.paper_id, ""),
                topic_id: coalesce(node.topic_id, ""),
                doi: coalesce(node.doi, ""),
                source_url: coalesce(node.source_url, ""),
                publication_year: coalesce(node.publication_year, "")
            }
        }],
            edges: [rel IN viz_edges_list WHERE rel IS NOT NULL | {
            edge_id: elementId(rel),
            source: elementId(startNode(rel)),
            target: elementId(endNode(rel)),
            relationship_type: type(rel)
        }]
    } AS graph_data
    """

    scoped_cypher = f"""
    MATCH (u:User {{email: $user_email}})
    OPTIONAL MATCH (u)-[*0..3]-(n)
    WHERE n IS NOT NULL AND any(label IN labels(n) WHERE label IN $live_labels)
    WITH collect(DISTINCT n) AS viz_nodes_list
    OPTIONAL MATCH (source)-[relationship]->(target)
    WHERE source IN viz_nodes_list AND target IN viz_nodes_list
    WITH viz_nodes_list, collect(DISTINCT relationship) AS viz_edges_list
    {cypher_projection}
    """
    
    active_driver = driver or get_neo4j_driver()
    record = _run_query(
        scoped_cypher, 
        {"user_email": normalized_user_email, "live_labels": live_labels}, 
        driver=active_driver, 
        query_name="fetch_graph_data", 
        single=True
    )
    
    if record and record["graph_data"]:
        return _coerce_graph_payload(dict(record["graph_data"]))

    return _coerce_graph_payload(None)


def find_user(tx, email):
    result = tx.run(
        """
        MATCH (u:User {email: $email})
        RETURN u.name AS name, u.email AS email, u.password AS password
        """,
        email=email
    )
    return result.single()


def delete_paper(paper_id: str, user_email: str, driver: Driver | None = None) -> dict[str, Any]:
    """Delete a paper by stable paper_id, scoped to the current user's SAVED or HAS_PAPER access.

    A paper may surface on the dashboard via two paths:
      (a) User -[:SAVED]-> Paper
      (b) User -[:SEARCHED_TOPIC]-> Topic -[:HAS_PAPER]-> Paper

    Both relationship types are severed. The Paper node is only removed when
    no other users retain any link to it.
    """
    print(f"[DEBUG] delete_paper called: paper_id='{paper_id}' user_email='{user_email}'")

    validated_paper_id = _require_non_empty(paper_id, "paper_id")
    validated_email = _require_non_empty(user_email, "user_email")
    params = {"paper_id": validated_paper_id, "user_email": validated_email}
    active_driver = driver or get_neo4j_driver()

    # ── Step 1: Read-only check — does ANY link exist for this user+paper? ────
    access_check_cypher = """
    MATCH (p:Paper {paper_id: $paper_id})
    MATCH (u:User {email: $user_email})
    OPTIONAL MATCH (u)-[r1:SAVED]->(p)
    OPTIONAL MATCH (u)-[:SEARCHED_TOPIC]->(:Topic)-[r2:HAS_PAPER]->(p)
    RETURN
        (r1 IS NOT NULL) AS has_saved,
        (r2 IS NOT NULL) AS has_hp
    LIMIT 1
    """

    access = _run_query(
        access_check_cypher, params,
        driver=active_driver, query_name="delete_paper_check", single=True,
    )

    if not access or (not access["has_saved"] and not access["has_hp"]):
        print(
            f"[DEBUG] delete_paper: no SAVED or HAS_PAPER link found — "
            f"paper_id='{validated_paper_id}' user='{validated_email}'"
        )
        return {
            "success": False,
            "reason": (
                f"Paper '{validated_paper_id}' is not linked to '{validated_email}'. "
                "It may have already been deleted or was never saved to your account."
            ),
        }

    print(f"[DEBUG] delete_paper: has_saved={access['has_saved']} has_hp={access['has_hp']}")

    # ── Step 2a: Delete SAVED relationship (plain, no RETURN) ─────────────────
    if access["has_saved"]:
        _run_query(
            "MATCH (u:User {email: $user_email})-[r:SAVED]->(p:Paper {paper_id: $paper_id}) DELETE r",
            params, driver=active_driver, query_name="delete_paper_saved",
        )
        print("[DEBUG] delete_paper: SAVED link deleted")

    # ── Step 2b: Delete HAS_PAPER relationships via user's topics ─────────────
    if access["has_hp"]:
        _run_query(
            "MATCH (u:User {email: $user_email})-[:SEARCHED_TOPIC]->(:Topic)-[r:HAS_PAPER]->(p:Paper {paper_id: $paper_id}) DELETE r",
            params, driver=active_driver, query_name="delete_paper_has_paper",
        )
        print("[DEBUG] delete_paper: HAS_PAPER link(s) deleted")

    # ── Step 3: Orphan cleanup ────────────────────────────────────────────────
    cleanup_record = _run_query(
        """
        MATCH (p:Paper {paper_id: $paper_id})
        WHERE NOT ()-[:SAVED]->(p) AND NOT ()-[:HAS_PAPER]->(p)
        DETACH DELETE p
        RETURN true AS deleted_node
        """,
        {"paper_id": validated_paper_id},
        driver=active_driver, query_name="delete_paper_cleanup", single=True,
    )
    deleted_node = bool(cleanup_record and cleanup_record.get("deleted_node"))
    print(f"[DEBUG] delete_paper: node_deleted={deleted_node}")

    return {
        "success": True,
        "deleted_relation": True,
        "deleted_node": deleted_node,
    }


def restore_legacy_data_to_user(user_email: str, driver: Driver | None = None) -> dict[str, Any]:
    """Links all orphan Research Topics and Papers to the provided user email."""
    cypher = """
    MATCH (orphan:Topic)
    WHERE NOT ()-[:SEARCHED_TOPIC]->(orphan)
    MERGE (user:User {email: $user_email})
    MERGE (user)-[rel:SEARCHED_TOPIC]->(orphan)
    ON CREATE SET rel.created_at = datetime(), rel.restored = true
    WITH user, count(DISTINCT orphan) AS restored_topics
    
    OPTIONAL MATCH (orphan_paper:Paper)
    WHERE NOT ()-[:SAVED|HAS_PAPER]-(orphan_paper)
    WITH user, restored_topics, orphan_paper
    
    // Safely link orphan papers if they exist
    FOREACH (p IN CASE WHEN orphan_paper IS NOT NULL THEN [orphan_paper] ELSE [] END |
        MERGE (user)-[rel2:SAVED]->(p)
        ON CREATE SET rel2.created_at = datetime(), rel2.restored = true
    )
    
    WITH restored_topics, count(DISTINCT orphan_paper) AS restored_papers
    RETURN {
        restored_topics: restored_topics,
        restored_papers: restored_papers
    } AS result
    """
    
    active_driver = driver or get_neo4j_driver()
    record = _run_query(
        cypher, 
        {"user_email": user_email}, 
        driver=active_driver, 
        query_name="restore_legacy_data_to_user", 
        single=True
    )
        
    if not record or not record["result"]:
        return {"restored_topics": 0, "restored_papers": 0}
        
    result = dict(record["result"])
    return {
        "restored_topics": int(result["restored_topics"]),
        "restored_papers": int(result["restored_papers"])
    }
