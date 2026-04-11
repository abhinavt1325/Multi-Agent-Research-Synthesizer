from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field

try:
    from backend.agents.research_gap import ResearchGapServiceError, run_research_gap
    from backend.agents.contradiction_detector import (
        ContradictionDetectorServiceError,
        run_contradiction_detector,
    )
    from backend.agents.evidence_comparator import EvidenceComparatorServiceError, run_evidence_comparator
    from backend.agents.paper_reader import PaperReaderServiceError, run_paper_reader
    from backend.agents.planner_agent import PlannerAgentServiceError, run_planner_agent
    from backend.agents.literature_hunter import LiteratureHunterServiceError, run_literature_hunter
    from backend.config.settings import get_settings
    from backend.neo4j.queries import GraphQueryError, fetch_graph_data, fetch_recent_papers
    from backend.services.export_utils import (
        build_export_filename,
        build_named_export_filename,
        generate_paper_list_docx,
        generate_planner_section_docx,
        generate_planner_section_pdf,
        generate_research_summary_pdf,
    )
except ModuleNotFoundError:  # pragma: no cover - supports execution from backend/
    from agents.research_gap import ResearchGapServiceError, run_research_gap
    from agents.contradiction_detector import ContradictionDetectorServiceError, run_contradiction_detector
    from agents.evidence_comparator import EvidenceComparatorServiceError, run_evidence_comparator
    from agents.paper_reader import PaperReaderServiceError, run_paper_reader
    from agents.planner_agent import PlannerAgentServiceError, run_planner_agent
    from agents.literature_hunter import LiteratureHunterServiceError, run_literature_hunter
    from config.settings import get_settings
    from neo4j.queries import GraphQueryError, fetch_graph_data, fetch_recent_papers
    from services.export_utils import (
        build_export_filename,
        build_named_export_filename,
        generate_paper_list_docx,
        generate_planner_section_docx,
        generate_planner_section_pdf,
        generate_research_summary_pdf,
    )


api_router = APIRouter()


class ResearchAgentRequest(BaseModel):
    research_question: str = Field(..., min_length=1, description="Primary research question.")
    context: list[str] = Field(default_factory=list, description="Supporting context for the agent.")
    filters: dict[str, Any] = Field(
        default_factory=dict,
        description="Agent-specific constraints such as date windows or domains.",
    )


class AgentRouteDescriptor(BaseModel):
    name: str
    method: str
    path: str
    frontend_page_key: str


class DashboardSummaryResponse(BaseModel):
    entry_point: str
    graph_reusability: str
    semantic_source_ready: bool
    llm_providers: list[str]
    agent_routes: list[AgentRouteDescriptor]
    active_agents: int


class RecentPaperItemResponse(BaseModel):
    paper_id: str | None
    title: str | None
    year: int | None
    source: str | None
    created_at: str | None


class GraphDataResponse(BaseModel):
    status: str
    papers_count: int | None
    total_nodes: int | None
    total_relationships: int | None
    topics_count: int | None = None
    methods_count: int | None = None
    datasets_count: int | None = None
    gaps_count: int | None = None
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)
    detail: str


class RecentPapersResponse(BaseModel):
    status: str
    papers: list[RecentPaperItemResponse]
    detail: str


class PlannerResearchDecompositionResponse(BaseModel):
    subtopics: list[str]
    search_keywords: list[str]
    possible_methods: list[str]
    likely_datasets: list[str]


class PlannerResponse(BaseModel):
    provider: str
    topic: str
    research_decomposition: PlannerResearchDecompositionResponse


class PaperReaderRequest(BaseModel):
    paper_text: str = Field(..., min_length=1, description="Paper abstract or uploaded paper text.")


class PaperReaderResponse(BaseModel):
    provider: str
    summary: str
    methods_used: list[str]
    datasets_mentioned: list[str]
    key_findings: list[str]


class EvidenceComparatorRequest(BaseModel):
    summaries: list[str] = Field(..., min_items=2, max_items=10, description="List of paper summaries to compare.")


class EvidenceComparatorResponse(BaseModel):
    provider: str
    common_evidence: list[str]
    differing_methods: list[str]
    differing_datasets: list[str]
    evidence_clusters: list[str]
    consensus_trends: list[str]


class ContradictionDetectorRequest(BaseModel):
    claim_a: str = Field(..., min_length=1, description="First research claim.")
    claim_b: str = Field(..., min_length=1, description="Second research claim.")


class ContradictionDetectorResponse(BaseModel):
    provider: str
    contradiction_found: bool
    conflicting_statements: list[str]
    confidence_level: str
    explanation: str


class ResearchGapRequest(BaseModel):
    research_topic: str = Field(..., min_length=1, description="Research topic under investigation.")
    paper_findings: str = Field(..., min_length=1, description="Collected findings from reviewed papers.")


class ResearchGapResponse(BaseModel):
    provider: str
    identified_gaps: list[str]
    underexplored_areas: list[str]
    future_directions: list[str]
    novelty_opportunities: list[str]


class PlannerSectionExportRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    section_title: str = Field(..., min_length=1)
    items: list[str] = Field(default_factory=list)


class LiteraturePaperResponse(BaseModel):
    title: str
    abstract: str
    authors: list[str]
    year: int | None
    citation_count: int
    source: str
    paper_id: str


class LiteratureHunterExportOptions(BaseModel):
    copy_text: str
    pdf_endpoint: str
    docx_endpoint: str
    export_ready: bool


class LiteratureHunterGraphSync(BaseModel):
    status: str
    stored_papers: int
    linked_papers: int
    detail: str


class LiteratureHunterResponse(BaseModel):
    topic: str
    status: str
    source: str
    message: str
    paper_count: int
    papers: list[LiteraturePaperResponse]
    export_options: LiteratureHunterExportOptions
    graph_sync: LiteratureHunterGraphSync


class LiteratureHunterExportRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    papers: list[LiteraturePaperResponse] = Field(default_factory=list)


AGENT_ROUTE_DESCRIPTORS = [
    AgentRouteDescriptor(
        name="planner",
        method="POST",
        path="/planner",
        frontend_page_key="planner",
    ),
    AgentRouteDescriptor(
        name="literature-hunter",
        method="POST",
        path="/literature-hunter",
        frontend_page_key="literature-hunter",
    ),
    AgentRouteDescriptor(
        name="paper-reader",
        method="POST",
        path="/paper-reader",
        frontend_page_key="paper-reader",
    ),
    AgentRouteDescriptor(
        name="evidence-comparator",
        method="POST",
        path="/evidence-comparator",
        frontend_page_key="evidence-comparator",
    ),
    AgentRouteDescriptor(
        name="contradiction-detector",
        method="POST",
        path="/contradiction-detector",
        frontend_page_key="contradiction-detector",
    ),
    AgentRouteDescriptor(
        name="research-gap",
        method="POST",
        path="/research-gap",
        frontend_page_key="research-gap",
    ),
]


def _not_implemented_agent(agent_name: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=f"{agent_name} is registered but its execution service is not implemented yet.",
    )


def _extract_result_limit(filters: dict[str, Any]) -> int:
    raw_limit = filters.get("limit", 10)

    try:
        normalized_limit = int(raw_limit)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="filters.limit must be an integer.",
        ) from exc

    if normalized_limit < 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="filters.limit must be greater than 0.",
        )

    return normalized_limit


@api_router.post("/planner", response_model=PlannerResponse)
async def planner_agent(request: ResearchAgentRequest) -> PlannerResponse:
    try:
        result = run_planner_agent(request.research_question)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except PlannerAgentServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=str(exc),
        ) from exc

    return PlannerResponse(**result)


@api_router.post("/planner/export/pdf")
async def planner_export_pdf(request: PlannerSectionExportRequest) -> Response:
    try:
        pdf_content = generate_planner_section_pdf(
            topic=request.topic,
            title=request.section_title,
            items=request.items,
        )
        filename = build_named_export_filename("planner", request.topic, "pdf")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/planner/export/docx")
async def planner_export_docx(request: PlannerSectionExportRequest) -> Response:
    try:
        docx_content = generate_planner_section_docx(
            topic=request.topic,
            title=request.section_title,
            items=request.items,
        )
        filename = build_named_export_filename("planner", request.topic, "docx")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return Response(
        content=docx_content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/literature-hunter", response_model=LiteratureHunterResponse)
async def literature_hunter_agent(request: ResearchAgentRequest) -> LiteratureHunterResponse:
    try:
        result = run_literature_hunter(
            research_topic=request.research_question,
            limit=_extract_result_limit(request.filters),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except LiteratureHunterServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=str(exc),
        ) from exc

    return LiteratureHunterResponse(**result)


@api_router.post("/literature-hunter/export/pdf")
async def literature_hunter_export_pdf(request: LiteratureHunterExportRequest) -> Response:
    try:
        pdf_content = generate_research_summary_pdf(
            topic=request.topic,
            papers=[paper.model_dump() for paper in request.papers],
        )
        filename = build_export_filename(request.topic, "pdf")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/literature-hunter/export/docx")
async def literature_hunter_export_docx(request: LiteratureHunterExportRequest) -> Response:
    try:
        docx_content = generate_paper_list_docx(
            topic=request.topic,
            papers=[paper.model_dump() for paper in request.papers],
        )
        filename = build_export_filename(request.topic, "docx")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return Response(
        content=docx_content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/paper-reader", response_model=PaperReaderResponse)
async def paper_reader_agent(request: PaperReaderRequest) -> PaperReaderResponse:
    try:
        result = run_paper_reader(request.paper_text)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except PaperReaderServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=str(exc),
        ) from exc

    return PaperReaderResponse(**result)


@api_router.post("/paper-reader/export/pdf")
async def paper_reader_export_pdf(request: PlannerSectionExportRequest) -> Response:
    try:
        pdf_content = generate_planner_section_pdf(
            topic=request.topic,
            title=request.section_title,
            items=request.items,
        )
        filename = build_named_export_filename("paper-reader", request.topic, "pdf")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/paper-reader/export/docx")
async def paper_reader_export_docx(request: PlannerSectionExportRequest) -> Response:
    try:
        docx_content = generate_planner_section_docx(
            topic=request.topic,
            title=request.section_title,
            items=request.items,
        )
        filename = build_named_export_filename("paper-reader", request.topic, "docx")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return Response(
        content=docx_content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/evidence-comparator", response_model=EvidenceComparatorResponse)
async def evidence_comparator_agent(request: EvidenceComparatorRequest) -> EvidenceComparatorResponse:
    try:
        result = run_evidence_comparator(
            summaries=request.summaries
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except EvidenceComparatorServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=str(exc),
        ) from exc

    return EvidenceComparatorResponse(**result)


@api_router.post("/evidence-comparator/export/pdf")
async def evidence_comparator_export_pdf(request: PlannerSectionExportRequest) -> Response:
    try:
        pdf_content = generate_planner_section_pdf(
            topic=request.topic,
            title=request.section_title,
            items=request.items,
        )
        filename = build_named_export_filename("evidence-comparator", request.topic, "pdf")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/evidence-comparator/export/docx")
async def evidence_comparator_export_docx(request: PlannerSectionExportRequest) -> Response:
    try:
        docx_content = generate_planner_section_docx(
            topic=request.topic,
            title=request.section_title,
            items=request.items,
        )
        filename = build_named_export_filename("evidence-comparator", request.topic, "docx")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return Response(
        content=docx_content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/contradiction-detector", response_model=ContradictionDetectorResponse)
async def contradiction_detector_agent(request: ContradictionDetectorRequest) -> ContradictionDetectorResponse:
    try:
        result = run_contradiction_detector(
            claim_a=request.claim_a,
            claim_b=request.claim_b,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except ContradictionDetectorServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=str(exc),
        ) from exc

    return ContradictionDetectorResponse(**result)


@api_router.post("/contradiction-detector/export/pdf")
async def contradiction_detector_export_pdf(request: PlannerSectionExportRequest) -> Response:
    try:
        pdf_content = generate_planner_section_pdf(
            topic=request.topic,
            title=request.section_title,
            items=request.items,
        )
        filename = build_named_export_filename("contradiction-detector", request.topic, "pdf")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/contradiction-detector/export/docx")
async def contradiction_detector_export_docx(request: PlannerSectionExportRequest) -> Response:
    try:
        docx_content = generate_planner_section_docx(
            topic=request.topic,
            title=request.section_title,
            items=request.items,
        )
        filename = build_named_export_filename("contradiction-detector", request.topic, "docx")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return Response(
        content=docx_content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/research-gap", response_model=ResearchGapResponse)
async def research_gap_agent(request: ResearchGapRequest) -> ResearchGapResponse:
    try:
        result = run_research_gap(
            research_topic=request.research_topic,
            paper_findings=request.paper_findings,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except ResearchGapServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=str(exc),
        ) from exc

    return ResearchGapResponse(**result)


@api_router.post("/research-gap/export/pdf")
async def research_gap_export_pdf(request: PlannerSectionExportRequest) -> Response:
    try:
        pdf_content = generate_planner_section_pdf(
            topic=request.topic,
            title=request.section_title,
            items=request.items,
        )
        filename = build_named_export_filename("research-gap", request.topic, "pdf")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/research-gap/export/docx")
async def research_gap_export_docx(request: PlannerSectionExportRequest) -> Response:
    try:
        docx_content = generate_planner_section_docx(
            topic=request.topic,
            title=request.section_title,
            items=request.items,
        )
        filename = build_named_export_filename("research-gap", request.topic, "docx")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return Response(
        content=docx_content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.get("/dashboard-summary", response_model=DashboardSummaryResponse)
async def dashboard_summary() -> DashboardSummaryResponse:
    settings = get_settings()
    llm_providers = [
        provider
        for provider, configured in (
            ("groq", settings.groq_api_key),
            ("gemini", settings.gemini_api_key),
        )
        if configured
    ]

    return DashboardSummaryResponse(
        entry_point="dashboard",
        graph_reusability="Shared graph data is exposed through a dedicated graph-data contract for all modules.",
        semantic_source_ready=bool(settings.semantic_scholar_api_key),
        llm_providers=llm_providers,
        agent_routes=AGENT_ROUTE_DESCRIPTORS,
        active_agents=len(AGENT_ROUTE_DESCRIPTORS),
    )


@api_router.get("/recent-papers", response_model=RecentPapersResponse)
async def recent_papers() -> RecentPapersResponse:
    settings = get_settings()
    neo4j_configured = all(
        [
            settings.neo4j_uri,
            settings.neo4j_username,
            settings.neo4j_password,
        ]
    )

    if not neo4j_configured:
        return RecentPapersResponse(
            status="unavailable",
            papers=[],
            detail="Neo4j integration is unavailable. Set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD.",
        )

    try:
        papers = fetch_recent_papers(limit=10)
    except GraphQueryError:
        return RecentPapersResponse(
            status="error",
            papers=[],
            detail="Recent papers could not be loaded from Neo4j.",
        )

    return RecentPapersResponse(
        status="ok",
        papers=[RecentPaperItemResponse(**paper) for paper in papers],
        detail="Recent papers loaded from graph storage.",
    )


@api_router.get("/graph-data", response_model=GraphDataResponse)
async def graph_data() -> GraphDataResponse:
    settings = get_settings()
    neo4j_configured = all(
        [
            settings.neo4j_uri,
            settings.neo4j_username,
            settings.neo4j_password,
        ]
    )

    if not neo4j_configured:
        return GraphDataResponse(
            status="unavailable",
            papers_count=None,
            total_nodes=None,
            total_relationships=None,
            topics_count=None,
            methods_count=None,
            datasets_count=None,
            gaps_count=None,
            nodes=[],
            edges=[],
            detail="Neo4j integration is unavailable. Set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD.",
        )

    try:
        graph_payload = fetch_graph_data()
    except GraphQueryError:
        return GraphDataResponse(
            status="error",
            papers_count=None,
            total_nodes=None,
            total_relationships=None,
            topics_count=None,
            methods_count=None,
            datasets_count=None,
            gaps_count=None,
            nodes=[],
            edges=[],
            detail="Graph data could not be loaded from Neo4j.",
        )

    return GraphDataResponse(
        status="ok",
        papers_count=graph_payload["papers_count"],
        total_nodes=graph_payload["total_nodes"],
        total_relationships=graph_payload["total_relationships"],
        topics_count=graph_payload["topics_count"],
        methods_count=graph_payload["methods_count"],
        datasets_count=graph_payload["datasets_count"],
        gaps_count=graph_payload["gaps_count"],
        nodes=graph_payload["nodes"],
        edges=graph_payload["edges"],
        detail="Graph data loaded from Neo4j.",
    )

from fastapi import Body
import sqlite3


@api_router.post("/signup", status_code=201)
def signup(data: dict = Body(...)):
    try:
        from backend.auth_db import create_user
    except ModuleNotFoundError:
        from auth_db import create_user

    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not name or not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="name, email, and password are required.",
        )

    try:
        create_user(name, email, password)
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists.",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    return {"message": "Account created successfully."}


@api_router.post("/login")
def login(data: dict = Body(...)):
    try:
        from backend.auth_db import find_user
    except ModuleNotFoundError:
        from auth_db import find_user

    email = data.get("email", "").strip()
    password = data.get("password", "")

    user = find_user(email)

    if user and user["password"] == password:
        return {
            "token": "demo-token",
            "email": user["email"],
            "name": user.get("name", ""),
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
    )


@api_router.post("/forgot-password")
def forgot_password(data: dict = Body(...)):
    return {"message": "reset link simulated"}
