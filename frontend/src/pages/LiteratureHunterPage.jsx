import { useState } from "react";
import PaperResultCard from "../components/PaperResultCard";
import {
  exportPaperAsDocx,
  exportPaperAsPdf,
  searchLiterature,
} from "../services/literatureHunter";

function buildPaperClipboardText(topic, paper) {
  const authors = paper.authors?.length ? paper.authors.join(", ") : "Unknown authors";
  const year = paper.year ?? "Unknown year";

  return [
    "Literature Hunter Result",
    `Topic: ${topic}`,
    `Title: ${paper.title}`,
    `Year: ${year}`,
    `Source: ${paper.source}`,
    `Authors: ${authors}`,
    `Paper ID: ${paper.paper_id}`,
    `Citations: ${paper.citation_count}`,
    `Abstract: ${paper.abstract || "Abstract not available."}`,
  ].join("\n");
}

function LiteratureHunterPage() {
  const [topic, setTopic] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("Search for current literature to build a grounded research baseline.");
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState({});

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedTopic = topic.trim();
    if (!normalizedTopic) {
      setError("Enter a research topic before running Literature Hunter.");
      return;
    }

    setStatus("loading");
    setError("");
    setMessage("Searching Semantic Scholar and preparing normalized paper results.");

    try {
      const response = await searchLiterature({ topic: normalizedTopic, limit: 10 });
      setResults(response.papers);
      setStatus(response.status === "completed" ? "success" : "idle");
      setMessage(response.message);
    } catch (requestError) {
      setResults([]);
      setStatus("error");
      setError(requestError.message || "Unable to load literature results.");
      setMessage("The literature search could not be completed.");
    }
  }

  async function handleCopy(paper) {
    const normalizedTopic = topic.trim();
    const content = buildPaperClipboardText(normalizedTopic, paper);
    setActionState((current) => ({ ...current, [paper.paper_id]: "copying" }));

    try {
      await navigator.clipboard.writeText(content);
      setMessage(`Copied "${paper.title}" to clipboard.`);
    } catch {
      setError("Clipboard access is unavailable in this browser context.");
    } finally {
      setActionState((current) => ({ ...current, [paper.paper_id]: "" }));
    }
  }

  async function handleExport(paper, format) {
    const normalizedTopic = topic.trim();
    setActionState((current) => ({ ...current, [paper.paper_id]: format }));
    setError("");

    try {
      if (format === "pdf") {
        await exportPaperAsPdf({ topic: normalizedTopic, paper });
      } else {
        await exportPaperAsDocx({ topic: normalizedTopic, paper });
      }
      setMessage(`Prepared ${format.toUpperCase()} export for "${paper.title}".`);
    } catch (exportError) {
      setError(exportError.message || `Unable to export ${format.toUpperCase()} file.`);
    } finally {
      setActionState((current) => ({ ...current, [paper.paper_id]: "" }));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[32px] border border-white/80 bg-slate-950 text-white shadow-panel">
          <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-10">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
                Research Acquisition
              </p>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Literature Hunter
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  Discover relevant papers for a research topic, normalize the results, and prepare exports for
                  downstream review.
                </p>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-panel-soft backdrop-blur">
              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-200">Research topic</span>
                  <input
                    type="text"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="Example: multi-agent systems for scientific literature review"
                    className="w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-white focus:ring-2 focus:ring-white/25"
                  />
                </label>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {status === "loading" ? "Running Literature Hunter..." : "Run Literature Hunter"}
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.8fr_2fr]">
          <aside className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Session State</p>
                <h2 className="mt-2 text-lg font-semibold text-ink">Current Search</h2>
              </div>
              <dl className="space-y-4 text-sm text-slate-600">
                <div className="rounded-2xl border border-line/80 bg-white/70 p-4">
                  <dt className="text-xs uppercase tracking-[0.2em] text-muted">Topic</dt>
                  <dd className="mt-2 break-words text-base font-medium text-ink">
                    {topic.trim() || "No topic entered yet"}
                  </dd>
                </div>
                <div className="rounded-2xl border border-line/80 bg-white/70 p-4">
                  <dt className="text-xs uppercase tracking-[0.2em] text-muted">Results</dt>
                  <dd className="mt-2 text-3xl font-semibold tracking-tight text-ink">{results.length}</dd>
                </div>
                <div className="rounded-2xl border border-line/80 bg-white/70 p-4">
                  <dt className="text-xs uppercase tracking-[0.2em] text-muted">Status</dt>
                  <dd className="mt-2 text-base font-medium capitalize text-ink">{status}</dd>
                </div>
              </dl>
            </div>
          </aside>

          <section className="space-y-4">
            <div className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
              <p className="text-sm leading-7 text-slate-600">{message}</p>
              {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
            </div>

            {results.length ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {results.map((paper) => (
                  <PaperResultCard
                    key={paper.paper_id}
                    paper={paper}
                    actionState={actionState[paper.paper_id]}
                    onCopy={() => handleCopy(paper)}
                    onExportPdf={() => handleExport(paper, "pdf")}
                    onExportDocx={() => handleExport(paper, "docx")}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-line bg-white/60 p-12 text-center shadow-panel-soft">
                <p className="text-lg font-medium text-ink">No papers to display yet.</p>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  Run Literature Hunter with a topic to fetch live results from the backend.
                </p>
              </div>
            )}
          </section>
        </section>
    </div>
  );
}

export default LiteratureHunterPage;
