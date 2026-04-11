import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchDashboardSummary,
  fetchGraphData,
  fetchRecentPapers,
} from "../services/dashboard";

function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [recentPapers, setRecentPapers] = useState([]);
  const [graphData, setGraphData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadDashboard() {
      setStatus("loading");
      setError("");

      try {
        const [summaryResponse, recentPapersResponse, graphDataResponse] = await Promise.all([
          fetchDashboardSummary(),
          fetchRecentPapers(),
          fetchGraphData(),
        ]);

        if (!isActive) {
          return;
        }

        setSummary(summaryResponse);
        setRecentPapers(recentPapersResponse.papers || []);
        setGraphData(graphDataResponse);
        setStatus("success");
      } catch (requestError) {
        if (!isActive) {
          return;
        }

        setError(requestError.message || "Unable to load dashboard data.");
        setStatus("error");
      }
    }

    loadDashboard();

    return () => {
      isActive = false;
    };
  }, []);

  const agentRoutes = summary?.agent_routes || [];
  const papersCount = graphData?.papers_count;
  const graphNodes = graphData?.total_nodes;
  const activeAgents = summary?.active_agents;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <section className="rounded-[32px] border border-white/80 bg-slate-950 px-6 py-8 text-white shadow-panel sm:px-8 lg:px-10">
        <div className="flex flex-col gap-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Dashboard</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Protected research workspace</h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              This dashboard is gated behind authentication and acts as the product entry point for research modules.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Entry Point</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Research modules</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Continue into live research workflows from the dashboard and move across all six agents from one place.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {agentRoutes.map((agent) => {
              const titles = {
                "/planner": "Planner",
                "/literature-hunter": "Literature Hunter",
                "/paper-reader": "Paper Reader",
                "/evidence-comparator": "Comparator",
                "/contradiction-detector": "Contradiction Detector",
                "/research-gap": "Research Gap",
              };
              const descriptions = {
                "/planner": "Research decomposition and topic planning",
                "/literature-hunter": "Retrieve papers and normalize literature",
                "/paper-reader": "Extract methods, datasets, findings",
                "/evidence-comparator": "Compare claims and evaluate evidence",
                "/contradiction-detector": "Identify conflicting statements across papers",
                "/research-gap": "Discover underexplored areas and future directions",
              };
              const title = titles[agent.path] || agent.name;
              const desc = descriptions[agent.path] || "Execute agent workflow";

              return (
                <Link
                  key={agent.path}
                  to={agent.path}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "1rem 1.25rem",
                    borderRadius: "16px",
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    textDecoration: "none",
                    transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#c7d2fe";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.03)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#0f172a", marginBottom: "0.25rem" }}>
                    {title} <span style={{ color: "#94a3b8", fontSize: "0.8rem", marginLeft: "2px" }}>&rarr;</span>
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", lineHeight: 1.4 }}>
                    {desc}
                  </span>
                </Link>
              );
            })}
          </div>
        </article>

        <article className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Live Status</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Backend overview</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {status === "loading"
              ? "Loading dashboard data from backend services."
              : status === "error"
                ? "Dashboard data could not be loaded."
                : summary?.graph_reusability}
          </p>
          {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Papers Count</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-ink">
            {papersCount ?? "Unavailable"}
          </p>
        </article>

        <article className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Graph Nodes</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-ink">
            {graphNodes ?? "Unavailable"}
          </p>
        </article>

        <article className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Active Agents</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-ink">
            {activeAgents ?? "Unavailable"}
          </p>
        </article>

        <article className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Relationships</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-ink">
            {graphData?.total_relationships ?? "Unavailable"}
          </p>
        </article>
      </section>

      <section className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Recent Papers</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Latest graph-backed papers</h2>
          </div>
          <p className="text-sm text-slate-500">
            {graphData?.status === "ok" ? "Loaded from Neo4j graph storage." : graphData?.detail}
          </p>
        </div>

        {recentPapers.length ? (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {recentPapers.map((paper) => (
              <article
                key={`${paper.paper_id || paper.title}-${paper.year || "na"}`}
                className="rounded-[24px] border border-line/80 bg-white/75 p-5"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted">
                    <span className="rounded-full border border-line bg-panel px-3 py-1">
                      {paper.source || "Unknown source"}
                    </span>
                    <span className="rounded-full border border-line bg-panel px-3 py-1">
                      {paper.year ?? "Year unavailable"}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-ink">{paper.title || "Untitled paper"}</h3>
                  <p className="text-sm text-slate-500">{paper.paper_id || "Paper ID unavailable"}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-dashed border-line bg-white/60 p-10 text-center">
            <p className="text-lg font-medium text-ink">No recent papers available.</p>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              {status === "error"
                ? "The dashboard could not load current paper data."
                : "Run Literature Hunter and sync papers into Neo4j to populate this list."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default DashboardPage;
