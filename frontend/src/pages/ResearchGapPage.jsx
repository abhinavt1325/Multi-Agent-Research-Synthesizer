import { useState } from "react";
import FileUploadZone from "../components/FileUploadZone";
import PlannerSectionCard from "../components/PlannerSectionCard";
import {
  exportFullResearchGapAsDocx,
  exportFullResearchGapAsPdf,
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

  async function handleFullExport(format) {
    if (!result) return;
    const exportTopic = actionState.topic || researchTopic.trim() || "research-gap-analysis";
    setActionState((prev) => ({ ...prev, globalExport: format }));
    setError("");

    try {
      // Build sections mapping for backend
      const sections = {};
      SECTION_DEFINITIONS.forEach((def) => {
        sections[def.key] = result[def.key] || [];
      });

      if (format === "pdf") {
        await exportFullResearchGapAsPdf({ topic: exportTopic, sections });
      } else {
        await exportFullResearchGapAsDocx({ topic: exportTopic, sections });
      }
      setMessage(`Consolidated research report exported as ${format.toUpperCase()}.`);
    } catch (err) {
      setError(err.message || "Export failed.");
    } finally {
      setActionState((prev) => ({ ...prev, globalExport: "" }));
    }
  }


  const sectionCount = result
    ? SECTION_DEFINITIONS.reduce((total, section) => total + (result[section.key]?.length || 0), 0)
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <section className="overflow-hidden rounded-[32px] border border-line bg-panel text-ink shadow-panel">
        <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-10">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">Gap Discovery</p>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Research Gap
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">
                Detect gaps, underexplored areas, future directions, and novelty opportunities from current findings.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-line bg-canvas/30 p-5 shadow-panel-soft backdrop-blur">
            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Research topic — always text */}
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">Research topic</span>
                <input
                  type="text"
                  value={researchTopic}
                  onChange={(event) => setResearchTopic(event.target.value)}
                  placeholder="Example: multi-agent systems for scientific discovery"
                  className="w-full rounded-2xl border border-line bg-canvas px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/25"
                />
              </label>

              {/* Paper findings — toggle between text and file */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">Paper findings</span>
                  <div className="flex gap-1 rounded-xl border border-line bg-canvas p-0.5">
                    <button
                      type="button"
                      onClick={() => setFindingsMode("text")}
                      className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition ${
                        findingsMode === "text" ? "bg-panel text-ink shadow border border-line" : "text-muted hover:text-ink"
                      }`}
                    >
                      ✏️ Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setFindingsMode("file")}
                      className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition ${
                        findingsMode === "file" ? "bg-panel text-ink shadow border border-line" : "text-muted hover:text-ink"
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
                    className="w-full resize-none rounded-2xl border border-line bg-canvas px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/25"
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
                      <div className="rounded-xl border border-line bg-canvas/40 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Extracted preview</p>
                        <p className="mt-1 line-clamp-3 text-xs text-ink/70">{paperFindings.slice(0, 300)}…</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-accent/20 border border-line px-5 py-3 text-sm font-semibold text-accent transition hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "loading" ? "Running Research Gap..." : "Run Research Gap"}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.8fr_2fr]">
        <aside className="rounded-[28px] border border-line bg-panel p-6 shadow-panel h-fit sticky top-8">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted">Session State</p>
              <h2 className="mt-2 text-lg font-bold text-ink">Current Gap Scan</h2>
            </div>
            <dl className="space-y-4">
              {[
                { label: "Topic", value: researchTopic.trim() || "No topic entered yet", large: false },
                { label: "Findings Length", value: paperFindings.trim().length, large: true },
                { label: "Input Mode", value: findingsMode, large: false },
                { label: "Provider", value: provider || "Not run yet", large: false },
                { label: "Total Items", value: sectionCount, large: false },
                { label: "Status", value: status, large: false },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-line bg-canvas/50 p-4">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{item.label}</dt>
                  <dd className={`mt-1 font-semibold text-ink ${item.large ? 'text-3xl' : 'text-sm'}`}>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>

        <section className="space-y-6">
          <div className="rounded-[28px] border border-line bg-panel p-6 shadow-panel">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${status === 'loading' ? 'bg-accent animate-pulse' : 'bg-muted'}`} />
              <p className="text-sm font-bold text-ink">{message}</p>
            </div>
            {error ? <p className="mt-3 text-sm font-bold text-red-500">{error}</p> : null}
          </div>

          {result ? (
            <div className="space-y-8">
              <div className="grid gap-6 xl:grid-cols-2">
                {SECTION_DEFINITIONS.map((section) => {
                  const items = result[section.key] || [];
                  return (
                    <PlannerSectionCard
                      key={section.key}
                      title={section.title}
                      items={items}
                      actionState={actionState[section.key]}
                      onCopy={() => handleCopy(section.title, items, section.key)}
                    />
                  );
                })}
              </div>

              {/* Unified Export Area */}
              <div className="overflow-hidden rounded-[32px] border border-line bg-panel p-8 shadow-2xl text-ink">
                <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
                  <div className="space-y-1 text-center sm:text-left">
                    <h3 className="text-xl font-bold">Consolidated Research Report</h3>
                    <p className="text-sm text-muted">Download the full analysis as a structured document.</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => handleFullExport("pdf")}
                      disabled={actionState.globalExport === "pdf"}
                      className="flex items-center gap-2 rounded-full border border-line bg-canvas px-6 py-3 text-sm font-bold text-ink transition hover:bg-line active:scale-95 disabled:opacity-50"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      {actionState.globalExport === "pdf" ? "Exporting PDF..." : "Export PDF"}
                    </button>
                    <button
                      onClick={() => handleFullExport("docx")}
                      disabled={actionState.globalExport === "docx"}
                      className="flex items-center gap-2 rounded-full border border-line bg-canvas px-6 py-3 text-sm font-bold text-ink transition hover:bg-line active:scale-95 disabled:opacity-50"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      {actionState.globalExport === "docx" ? "Exporting DOCX..." : "Export DOCX"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          ) : (
            <div className="rounded-[32px] border border-dashed border-line bg-panel p-16 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-canvas text-muted border border-line">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <p className="text-xl font-bold text-ink">No research gaps yet.</p>
              <p className="mt-2 text-sm leading-7 text-muted font-medium">
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
