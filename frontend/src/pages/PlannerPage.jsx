import { useState } from "react";
import PlannerSectionCard from "../components/PlannerSectionCard";
import {
  exportFullPlannerAsDocx,
  exportFullPlannerAsPdf,
  runPlanner,
} from "../services/planner";

const SECTION_DEFINITIONS = [
  { key: "subtopics", title: "Subtopics" },
  { key: "search_keywords", title: "Search Keywords" },
  { key: "possible_methods", title: "Possible Methods" },
  { key: "likely_datasets", title: "Likely Datasets" },
];

function buildPlannerClipboardText(topic, title, items) {
  return [
    "Planner Agent Result",
    `Topic: ${topic}`,
    `Section: ${title}`,
    "",
    ...(items.length ? items.map((item, index) => `${index + 1}. ${item}`) : ["No items returned for this section."]),
  ].join("\n");
}

function PlannerPage() {
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("Decompose a research theme into actionable planning sections.");
  const [error, setError] = useState("");
  const [provider, setProvider] = useState("");
  const [result, setResult] = useState(null);
  const [actionState, setActionState] = useState({});

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedTopic = topic.trim();
    if (!normalizedTopic) {
      setError("Enter a research topic before running Planner.");
      return;
    }

    setStatus("loading");
    setError("");
    setMessage("Generating structured research decomposition from the planner backend.");

    try {
      const response = await runPlanner({ topic: normalizedTopic });
      setProvider(response.provider);
      setResult(response.research_decomposition);
      setStatus("success");
      setMessage(`Planner completed using ${response.provider}.`);
    } catch (requestError) {
      setProvider("");
      setResult(null);
      setStatus("error");
      setError(requestError.message || "Unable to generate planner output.");
      setMessage("The planner request could not be completed.");
    }
  }

  async function handleCopy(sectionTitle, items, sectionKey) {
    setActionState((current) => ({ ...current, [sectionKey]: "copying" }));

    try {
      await navigator.clipboard.writeText(buildPlannerClipboardText(topic.trim(), sectionTitle, items));
      setMessage(`Copied ${sectionTitle.toLowerCase()} to clipboard.`);
    } catch {
      setError("Clipboard access is unavailable in this browser context.");
    } finally {
      setActionState((current) => ({ ...current, [sectionKey]: "" }));
    }
  }

  async function handleFullExport(format) {
    if (!result) return;
    setActionState((current) => ({ ...current, globalExport: format }));
    setError("");

    try {
      if (format === "pdf") {
        await exportFullPlannerAsPdf({ topic: topic.trim(), sections: result });
      } else {
        await exportFullPlannerAsDocx({ topic: topic.trim(), sections: result });
      }
      setMessage(`Research report exported as ${format.toUpperCase()}.`);
    } catch (exportError) {
      setError(exportError.message || `Export failed.`);
    } finally {
      setActionState((current) => ({ ...current, globalExport: "" }));
    }
  }

  const sectionCount = result
    ? Object.values(result).reduce((total, sectionItems) => total + (Array.isArray(sectionItems) ? sectionItems.length : 0), 0)
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 pb-12">
        <section className="overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950 text-white shadow-2xl">
          <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-10">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Research Planning</p>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Planner</h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  Break down a research topic into subtopics, targeted search language, methods, and likely datasets.
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
                    placeholder="Example: autonomous scientific agents for literature review"
                    className="w-full rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-white/20"
                  />
                </label>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.98]"
                >
                  {status === "loading" ? "Running Planner..." : "Run Planner"}
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.8fr_2fr]">
          <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-panel h-fit sticky top-8">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Session State</p>
                <h2 className="mt-2 text-lg font-bold text-slate-900">Current Plan</h2>
              </div>
              <dl className="space-y-4">
                {[
                  { label: "Topic", value: topic.trim() || "No topic entered yet", large: false },
                  { label: "Provider", value: provider || "Not run yet", large: false },
                  { label: "Total Items", value: sectionCount, large: true },
                  { label: "Status", value: status, large: false },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{item.label}</dt>
                    <dd className={`mt-1 break-words font-semibold text-slate-800 ${item.large ? 'text-3xl tracking-tight' : 'text-sm'}`}>
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-panel">
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${status === 'loading' ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`} />
                <p className="text-sm font-medium text-slate-700">{message}</p>
              </div>
              {error ? <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-600 border border-red-100">{error}</p> : null}
            </div>

            {result ? (
              <>
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

                <div className="mt-8 overflow-hidden rounded-[32px] border border-slate-900 bg-slate-950 p-8 shadow-2xl text-white">
                  <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
                    <div className="space-y-1 text-center sm:text-left">
                      <h3 className="text-xl font-bold">Consolidated Research Report</h3>
                      <p className="text-sm text-slate-400">Download the full plan as a structured document.</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                      <button
                        onClick={() => handleFullExport("pdf")}
                        disabled={actionState.globalExport === "pdf"}
                        className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100 active:scale-95 disabled:opacity-50"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        {actionState.globalExport === "pdf" ? "Exporting PDF..." : "Export PDF"}
                      </button>
                      <button
                        onClick={() => handleFullExport("docx")}
                        disabled={actionState.globalExport === "docx"}
                        className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        {actionState.globalExport === "docx" ? "Exporting DOCX..." : "Export DOCX"}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[32px] border border-dashed border-slate-200 bg-white/50 p-16 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 text-slate-300">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800">Ready to Plan</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-slate-500">
                  Enter your research topic above to generate a multi-dimensional decomposition for your study.
                </p>
              </div>
            )}
          </section>
        </section>
    </div>
  );
}

export default PlannerPage;
