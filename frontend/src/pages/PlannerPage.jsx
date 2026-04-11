import { useState } from "react";
import PlannerSectionCard from "../components/PlannerSectionCard";
import {
  exportPlannerSectionAsDocx,
  exportPlannerSectionAsPdf,
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

  async function handleExport(sectionTitle, items, sectionKey, format) {
    setActionState((current) => ({ ...current, [sectionKey]: format }));
    setError("");

    try {
      if (format === "pdf") {
        await exportPlannerSectionAsPdf({ topic: topic.trim(), sectionTitle, items });
      } else {
        await exportPlannerSectionAsDocx({ topic: topic.trim(), sectionTitle, items });
      }
      setMessage(`Prepared ${format.toUpperCase()} export for ${sectionTitle.toLowerCase()}.`);
    } catch (exportError) {
      setError(exportError.message || `Unable to export ${format.toUpperCase()} file.`);
    } finally {
      setActionState((current) => ({ ...current, [sectionKey]: "" }));
    }
  }

  const sectionCount = result
    ? Object.values(result).reduce((total, sectionItems) => total + (Array.isArray(sectionItems) ? sectionItems.length : 0), 0)
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[32px] border border-white/80 bg-slate-950 text-white shadow-panel">
          <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-10">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Research Planning</p>
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
                    className="w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-white focus:ring-2 focus:ring-white/25"
                  />
                </label>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {status === "loading" ? "Running Planner..." : "Run Planner"}
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
                <h2 className="mt-2 text-lg font-semibold text-ink">Current Plan</h2>
              </div>
              <dl className="space-y-4 text-sm text-slate-600">
                <div className="rounded-2xl border border-line/80 bg-white/70 p-4">
                  <dt className="text-xs uppercase tracking-[0.2em] text-muted">Topic</dt>
                  <dd className="mt-2 break-words text-base font-medium text-ink">
                    {topic.trim() || "No topic entered yet"}
                  </dd>
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
                <p className="text-lg font-medium text-ink">No planner output yet.</p>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  Run Planner with a topic to generate structured research decomposition from the backend.
                </p>
              </div>
            )}
          </section>
        </section>
    </div>
  );
}

export default PlannerPage;
