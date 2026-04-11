import { useState } from "react";
import FileUploadZone from "../components/FileUploadZone";
import PlannerSectionCard from "../components/PlannerSectionCard";
import {
  exportResearchGapSectionAsDocx,
  exportResearchGapSectionAsPdf,
  runResearchGap,
} from "../services/researchGap";

const SECTION_DEFINITIONS = [
  { key: "identified_gaps", title: "Identified Gaps" },
  { key: "underexplored_areas", title: "Underexplored Areas" },
  { key: "future_directions", title: "Future Directions" },
  { key: "novelty_opportunities", title: "Novelty Opportunities" },
];

function buildResearchGapClipboardText(topic, title, items) {
  return [
    "Research Gap Result",
    `Topic: ${topic}`,
    `Section: ${title}`,
    "",
    ...(items.length ? items.map((item, index) => `${index + 1}. ${item}`) : ["No items returned for this section."]),
  ].join("\n");
}

function ResearchGapPage() {
  const [researchTopic, setResearchTopic] = useState("");
  const [paperFindings, setPaperFindings] = useState("");
  const [findingsMode, setFindingsMode] = useState("text"); // "text" | "file"
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("Identify underexplored opportunities from a topic and its observed findings.");
  const [error, setError] = useState("");
  const [provider, setProvider] = useState("");
  const [result, setResult] = useState(null);
  const [actionState, setActionState] = useState({});

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedTopic = researchTopic.trim();
    const normalizedFindings = paperFindings.trim();

    if (!normalizedTopic || !normalizedFindings) {
      setError("Enter the research topic and provide paper findings before running Research Gap.");
      return;
    }

    setStatus("loading");
    setError("");
    setMessage("Analyzing research gaps from the topic and findings through the backend gap detector.");

    try {
      const response = await runResearchGap({
        researchTopic: normalizedTopic,
        paperFindings: normalizedFindings,
      });
      setProvider(response.provider);
      setResult(response);
      setStatus("success");
      setMessage(`Research Gap completed using ${response.provider}.`);
    } catch (requestError) {
      setProvider("");
      setResult(null);
      setStatus("error");
      setError(requestError.message || "Unable to identify research gaps.");
      setMessage("The research gap request could not be completed.");
    }
  }

  async function handleCopy(sectionTitle, items, sectionKey) {
    setActionState((current) => ({ ...current, [sectionKey]: "copying" }));
    try {
      await navigator.clipboard.writeText(buildResearchGapClipboardText(researchTopic.trim(), sectionTitle, items));
      setMessage(`Copied ${sectionTitle.toLowerCase()} to clipboard.`);
    } catch {
      setError("Clipboard access is unavailable in this browser context.");
    } finally {
      setActionState((current) => ({ ...current, [sectionKey]: "" }));
    }
  }

  async function handleExport(sectionTitle, items, sectionKey, format) {
    setActionState((current) => ({ ...current, [sectionKey]: format }));
    setError("");
    try {
      if (format === "pdf") {
        await exportResearchGapSectionAsPdf({ topic: researchTopic.trim(), sectionTitle, items });
      } else {
        await exportResearchGapSectionAsDocx({ topic: researchTopic.trim(), sectionTitle, items });
      }
      setMessage(`Prepared ${format.toUpperCase()} export for ${sectionTitle.toLowerCase()}.`);
    } catch (exportError) {
      setError(exportError.message || `Unable to export ${format.toUpperCase()} file.`);
    } finally {
      setActionState((current) => ({ ...current, [sectionKey]: "" }));
    }
  }

  const sectionCount = result
    ? SECTION_DEFINITIONS.reduce((total, section) => total + (result[section.key]?.length || 0), 0)
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <section className="overflow-hidden rounded-[32px] border border-white/80 bg-slate-950 text-white shadow-panel">
        <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-10">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Gap Discovery</p>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Research Gap
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Detect gaps, underexplored areas, future directions, and novelty opportunities from current findings.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-panel-soft backdrop-blur">
            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Research topic — always text */}
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Research topic</span>
                <input
                  type="text"
                  value={researchTopic}
                  onChange={(event) => setResearchTopic(event.target.value)}
                  placeholder="Example: multi-agent systems for scientific discovery"
                  className="w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-white focus:ring-2 focus:ring-white/25"
                />
              </label>

              {/* Paper findings — toggle between text and file */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">Paper findings</span>
                  <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-0.5">
                    <button
                      type="button"
                      onClick={() => setFindingsMode("text")}
                      className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition ${
                        findingsMode === "text" ? "bg-white text-slate-900 shadow" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      ✏️ Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setFindingsMode("file")}
                      className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition ${
                        findingsMode === "file" ? "bg-white text-slate-900 shadow" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      📎 File
                    </button>
                  </div>
                </div>

                {findingsMode === "text" ? (
                  <textarea
                    value={paperFindings}
                    onChange={(event) => setPaperFindings(event.target.value)}
                    placeholder="Paste synthesized findings from reviewed papers"
                    rows={7}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-white focus:ring-2 focus:ring-white/25"
                  />
                ) : (
                  <>
                    <FileUploadZone
                      onTextExtracted={(text, fileName) => {
                        setPaperFindings(text);
                        setMessage(`Findings text extracted from "${fileName}".`);
                      }}
                      disabled={status === "loading"}
                    />
                    {paperFindings && (
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Extracted preview</p>
                        <p className="mt-1 line-clamp-3 text-xs text-slate-300">{paperFindings.slice(0, 300)}…</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "loading" ? "Running Research Gap..." : "Run Research Gap"}
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
              <h2 className="mt-2 text-lg font-semibold text-ink">Current Gap Scan</h2>
            </div>
            <dl className="space-y-4 text-sm text-slate-600">
              <div className="rounded-2xl border border-line/80 bg-white/70 p-4">
                <dt className="text-xs uppercase tracking-[0.2em] text-muted">Topic</dt>
                <dd className="mt-2 break-words text-base font-medium text-ink">
                  {researchTopic.trim() || "No topic entered yet"}
                </dd>
              </div>
              <div className="rounded-2xl border border-line/80 bg-white/70 p-4">
                <dt className="text-xs uppercase tracking-[0.2em] text-muted">Findings Length</dt>
                <dd className="mt-2 text-3xl font-semibold tracking-tight text-ink">{paperFindings.trim().length}</dd>
              </div>
              <div className="rounded-2xl border border-line/80 bg-white/70 p-4">
                <dt className="text-xs uppercase tracking-[0.2em] text-muted">Input Mode</dt>
                <dd className="mt-2 text-base font-medium capitalize text-ink">{findingsMode}</dd>
              </div>
              <div className="rounded-2xl border border-line/80 bg-white/70 p-4">
                <dt className="text-xs uppercase tracking-[0.2em] text-muted">Provider</dt>
                <dd className="mt-2 text-base font-medium capitalize text-ink">{provider || "Not run yet"}</dd>
              </div>
              <div className="rounded-2xl border border-line/80 bg-white/70 p-4">
                <dt className="text-xs uppercase tracking-[0.2em] text-muted">Total Items</dt>
                <dd className="mt-2 text-3xl font-semibold tracking-tight text-ink">{sectionCount}</dd>
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

          {result ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {SECTION_DEFINITIONS.map((section) => {
                const items = result[section.key] || [];
                return (
                  <PlannerSectionCard
                    key={section.key}
                    title={section.title}
                    items={items}
                    actionState={actionState[section.key]}
                    onCopy={() => handleCopy(section.title, items, section.key)}
                    onExportPdf={() => handleExport(section.title, items, section.key, "pdf")}
                    onExportDocx={() => handleExport(section.title, items, section.key, "docx")}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-line bg-white/60 p-12 text-center shadow-panel-soft">
              <p className="text-lg font-medium text-ink">No research gaps yet.</p>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Enter a topic and paste or upload findings (PDF · DOCX · TXT) to generate structured opportunity analysis.
              </p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

export default ResearchGapPage;
