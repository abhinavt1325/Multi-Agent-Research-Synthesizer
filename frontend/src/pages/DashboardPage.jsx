import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchDashboardSummary,
  fetchGraphData,
  fetchRecentPapers,
  deletePaper,
  restoreLegacyData,
} from "../services/dashboard";
import { useAuth } from "../hooks/useAuth";

function DashboardPage() {
  const { userEmail } = useAuth();
  const [summary, setSummary] = useState(null);
  const [recentPapers, setRecentPapers] = useState([]);
  const [graphData, setGraphData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [restoring, setRestoring] = useState(false);

  const loadDashboard = async () => {
    setStatus("loading");
    setError("");

    try {
      const [summaryResponse, recentPapersResponse, graphDataResponse] = await Promise.all([
        fetchDashboardSummary(userEmail),
        fetchRecentPapers(userEmail),
        fetchGraphData(userEmail),
      ]);

      setSummary(summaryResponse);
      setRecentPapers(recentPapersResponse.papers || []);
      setGraphData(graphDataResponse);
      setStatus("success");
    } catch (requestError) {
      setError(requestError.message || "Unable to load dashboard data.");
      setStatus("error");
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [userEmail]);

  const handleRestore = async () => {
    if (!userEmail) return;
    setRestoring(true);
    try {
      const result = await restoreLegacyData(userEmail);
      alert(`Restoration complete! ${result.results.restored_topics} topics and ${result.results.restored_papers} papers were linked to your account.`);
      loadDashboard();
    } catch (e) {
      alert("Restoration failed: " + e.message);
    } finally {
      setRestoring(false);
    }
  };

  const agentRoutes = summary?.agent_routes || [];
  const papersCount = graphData?.papers_count;
  const graphNodes = graphData?.total_nodes;
  const activeAgents = summary?.active_agents;

  const handleDeletePaper = async (paperId) => {
    if (!paperId) {
      alert("Cannot delete: paper_id is missing for this paper.");
      return;
    }
    if (!window.confirm("Remove this paper from your research memory?")) return;
    try {
      await deletePaper(paperId, userEmail);
      
      // Immediately refresh all dashboard data to sync counts and lists
      const [summaryResp, recentResp, graphResp] = await Promise.all([
        fetchDashboardSummary(userEmail),
        fetchRecentPapers(userEmail),
        fetchGraphData(userEmail),
      ]);
      
      setSummary(summaryResp);
      setRecentPapers(recentResp.papers || []);
      setGraphData(graphResp);
    } catch (e) {
      console.error("Failed to delete paper", e);
      alert(e.message || "Failed to delete paper");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <section className="rounded-[32px] border border-line bg-panel px-6 py-8 text-white shadow-panel sm:px-8 lg:px-10">
        <div className="flex flex-col gap-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Dashboard</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">AI Research Intelligence Workspace</h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Access all six AI research agents, graph memory, and evidence workflows from one unified workspace.
            </p>
          </div>
          {papersCount === 0 && status === "success" && (
            <div className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-bold text-white">Missing your old research data?</p>
                <p className="text-xs text-slate-400 font-medium">Our new privacy system segments data by user. Click below to link your legacy research to this account.</p>
              </div>
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="whitespace-nowrap rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-slate-100 disabled:opacity-50"
              >
                {restoring ? "Restoring..." : "Restore My Research"}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="hover-lift rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
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
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    background: "rgba(17, 24, 39, 0.6)",
                    backdropFilter: "blur(10px)",
                    textDecoration: "none",
                    transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(236, 72, 153, 0.45)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(236, 72, 153, 0.1)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.background = "rgba(17, 24, 39, 0.9)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.05)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.background = "rgba(17, 24, 39, 0.6)";
                  }}
                >
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#f8fafc", marginBottom: "0.25rem" }}>
                    {title} <span style={{ color: "#ec4899", fontSize: "0.8rem", marginLeft: "4px" }}>&rarr;</span>
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.4 }}>
                    {desc}
                  </span>
                </Link>
              );
            })}
          </div>
        </article>

        <article className="hover-lift rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
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
        <article className="hover-lift rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Papers Count</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-ink">
            {papersCount ?? "Unavailable"}
          </p>
        </article>

        <article className="hover-lift rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Graph Nodes</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-ink">
            {graphNodes ?? "Unavailable"}
          </p>
        </article>

        <article className="hover-lift rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Active Agents</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-ink">
            {activeAgents ?? "Unavailable"}
          </p>
        </article>

        <article className="hover-lift rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
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
                className="hover-lift rounded-[24px] border border-line bg-panel p-5"
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
                <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                  <button
                    onClick={() => handleDeletePaper(paper.paper_id)}
                    disabled={!paper.paper_id}
                    title={paper.paper_id ? "Remove from research memory" : "paper_id unavailable — cannot delete"}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-xs font-bold text-red-500 transition hover:bg-red-500/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-dashed border-line bg-panel/50 p-10 text-center">
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
