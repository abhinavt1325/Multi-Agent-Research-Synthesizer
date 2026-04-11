from __future__ import annotations

import json
import logging
import re
import socket
import uuid
from dataclasses import dataclass
from typing import Any
from urllib import error, parse, request

try:
    from backend.config.settings import get_settings
    from backend.neo4j.queries import GraphQueryError, create_paper_node, create_topic_node, link_paper_to_topic
    from backend.services.export_utils import build_clipboard_text
except ModuleNotFoundError:  # pragma: no cover - supports execution from backend/
    from config.settings import get_settings
    from neo4j.queries import GraphQueryError, create_paper_node, create_topic_node, link_paper_to_topic
    from services.export_utils import build_clipboard_text


LOGGER = logging.getLogger(__name__)
SEMANTIC_SCHOLAR_SEARCH_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
SEMANTIC_SCHOLAR_SOURCE = "semantic_scholar"
DEFAULT_RESULT_LIMIT = 10
MAX_RESULT_LIMIT = 25
REQUEST_TIMEOUT_SECONDS = 15


@dataclass(frozen=True)
class LiteraturePaper:
    title: str
    abstract: str
    authors: list[str]
    year: int | None
    citation_count: int
    source: str
    paper_id: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "abstract": self.abstract,
            "authors": self.authors,
            "year": self.year,
            "citation_count": self.citation_count,
            "source": self.source,
            "paper_id": self.paper_id,
        }


class LiteratureHunterServiceError(RuntimeError):
    """Raised when the Literature Hunter cannot safely complete a live search."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def _normalize_topic(topic: str) -> str:
    cleaned = topic.strip()
    if not cleaned:
        raise ValueError("research_topic must not be empty.")
    return cleaned


def _normalize_limit(limit: int | None) -> int:
    if limit is None:
        return DEFAULT_RESULT_LIMIT
    return max(1, min(int(limit), MAX_RESULT_LIMIT))


def _normalize_paper_identifier(raw_paper: dict[str, Any]) -> str | None:
    paper_id = raw_paper.get("paperId")
    if isinstance(paper_id, str) and paper_id.strip():
        return paper_id.strip()

    external_ids = raw_paper.get("externalIds") or {}
    doi = external_ids.get("DOI")
    if isinstance(doi, str) and doi.strip():
        return f"doi:{doi.strip()}"

    corpus_id = raw_paper.get("corpusId")
    if corpus_id is not None:
        return f"corpus:{corpus_id}"

    return None


def _normalize_paper(raw_paper: dict[str, Any]) -> LiteraturePaper | None:
    title = (raw_paper.get("title") or "").strip()
    if not title:
        return None

    paper_id = _normalize_paper_identifier(raw_paper)
    if not paper_id:
        return None

    authors = [
        author_name
        for author in raw_paper.get("authors", [])
        for author_name in [(author.get("name") or "").strip()]
        if author_name
    ]

    year = raw_paper.get("year")
    if not isinstance(year, int):
        year = None

    citation_count = raw_paper.get("citationCount")
    if not isinstance(citation_count, int):
        citation_count = 0

    abstract = raw_paper.get("abstract")
    if not isinstance(abstract, str):
        abstract = ""

    return LiteraturePaper(
        title=title,
        abstract=abstract.strip(),
        authors=authors,
        year=year,
        citation_count=citation_count,
        source=SEMANTIC_SCHOLAR_SOURCE,
        paper_id=paper_id,
    )


def _query_semantic_scholar(research_topic: str, api_key: str, limit: int) -> list[LiteraturePaper]:
    query_params = parse.urlencode(
        {
            "query": research_topic,
            "limit": limit,
            "fields": "paperId,corpusId,title,abstract,year,citationCount,authors,externalIds",
        }
    )
    api_request = request.Request(
        f"{SEMANTIC_SCHOLAR_SEARCH_URL}?{query_params}",
        headers={
            "Accept": "application/json",
            "x-api-key": api_key,
        },
        method="GET",
    )

    try:
        with request.urlopen(api_request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        LOGGER.exception("Semantic Scholar request returned HTTP %s.", exc.code)
        if exc.code == 429:
            raise LiteratureHunterServiceError(
                "Semantic Scholar rate limited the request. Please retry shortly.",
                status_code=503,
            ) from exc
        raise LiteratureHunterServiceError("Semantic Scholar request failed.", status_code=502) from exc
    except (error.URLError, TimeoutError, socket.timeout) as exc:
        LOGGER.exception("Semantic Scholar request timed out or failed.")
        raise LiteratureHunterServiceError("Semantic Scholar request timed out.", status_code=504) from exc
    except json.JSONDecodeError as exc:
        LOGGER.exception("Semantic Scholar response could not be decoded.")
        raise LiteratureHunterServiceError(
            "Semantic Scholar returned an invalid response payload.",
            status_code=502,
        ) from exc

    raw_papers = payload.get("data", [])
    if not isinstance(raw_papers, list):
        raise LiteratureHunterServiceError(
            "Semantic Scholar returned an unexpected response shape.",
            status_code=502,
        )

    papers: list[LiteraturePaper] = []
    for raw_paper in raw_papers:
        if not isinstance(raw_paper, dict):
            continue
        normalized = _normalize_paper(raw_paper)
        if normalized is not None:
            papers.append(normalized)

    return papers


def _build_topic_id(research_topic: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", research_topic.lower()).strip("-")
    suffix = uuid.uuid5(uuid.NAMESPACE_URL, research_topic.lower()).hex[:12]
    return f"topic-{slug[:64]}-{suffix}" if slug else f"topic-{suffix}"


def _persist_papers_to_graph(research_topic: str, papers: list[LiteraturePaper]) -> dict[str, Any]:
    settings = get_settings()
    if not papers:
        return {
            "status": "skipped",
            "stored_papers": 0,
            "linked_papers": 0,
            "detail": "No papers were retrieved, so graph persistence was skipped.",
        }

    if not all([settings.neo4j_uri, settings.neo4j_username, settings.neo4j_password]):
        return {
            "status": "skipped",
            "stored_papers": 0,
            "linked_papers": 0,
            "detail": "Neo4j is not configured. Set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD.",
        }

    topic_id = _build_topic_id(research_topic)
    stored_papers = 0
    linked_papers = 0

    try:
        create_topic_node(
            topic_id=topic_id,
            name=research_topic,
            description=f"Research topic tracked by Literature Hunter: {research_topic}",
            metadata={"source": SEMANTIC_SCHOLAR_SOURCE, "paper_count": len(papers)},
        )
        for paper in papers:
            create_paper_node(
                paper_id=paper.paper_id,
                title=paper.title,
                abstract=paper.abstract or None,
                publication_year=paper.year,
                source=paper.source,
                metadata={"authors": paper.authors, "citation_count": paper.citation_count},
            )
            stored_papers += 1
            link_paper_to_topic(paper_id=paper.paper_id, topic_id=topic_id)
            linked_papers += 1
    except (GraphQueryError, RuntimeError, ValueError) as exc:
        LOGGER.exception("Failed to persist Literature Hunter results to Neo4j.")
        return {
            "status": "partial_failure" if stored_papers or linked_papers else "failed",
            "stored_papers": stored_papers,
            "linked_papers": linked_papers,
            "detail": "Retrieved papers were not fully synchronized to Neo4j.",
        }

    return {
        "status": "completed",
        "stored_papers": stored_papers,
        "linked_papers": linked_papers,
        "detail": "Retrieved papers were synchronized to Neo4j and linked to the topic graph.",
    }


def run_literature_hunter(research_topic: str, limit: int | None = None) -> dict[str, Any]:
    normalized_topic = _normalize_topic(research_topic)
    normalized_limit = _normalize_limit(limit)
    settings = get_settings()

    if not settings.semantic_scholar_api_key:
        return {
            "topic": normalized_topic,
            "status": "unavailable",
            "source": SEMANTIC_SCHOLAR_SOURCE,
            "message": "Semantic Scholar integration is unavailable. Set SEMANTIC_SCHOLAR_API_KEY.",
            "paper_count": 0,
            "papers": [],
            "export_options": {
                "copy_text": build_clipboard_text(normalized_topic, []),
                "pdf_endpoint": "/literature-hunter/export/pdf",
                "docx_endpoint": "/literature-hunter/export/docx",
                "export_ready": False,
            },
            "graph_sync": {
                "status": "skipped",
                "stored_papers": 0,
                "linked_papers": 0,
                "detail": "Graph persistence was skipped because no papers were retrieved.",
            },
        }

    retrieved_papers = _query_semantic_scholar(normalized_topic, settings.semantic_scholar_api_key, normalized_limit)
    papers = [paper.to_dict() for paper in retrieved_papers]

    return {
        "topic": normalized_topic,
        "status": "completed",
        "source": SEMANTIC_SCHOLAR_SOURCE,
        "message": "Literature search completed." if papers else "Literature search completed with no papers returned.",
        "paper_count": len(papers),
        "papers": papers,
        "export_options": {
            "copy_text": build_clipboard_text(normalized_topic, papers),
            "pdf_endpoint": "/literature-hunter/export/pdf",
            "docx_endpoint": "/literature-hunter/export/docx",
            "export_ready": bool(papers),
        },
        "graph_sync": _persist_papers_to_graph(normalized_topic, retrieved_papers),
    }
