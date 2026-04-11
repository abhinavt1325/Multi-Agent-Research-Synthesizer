import { useState } from "react";
import FileUploadZone from "../components/FileUploadZone";
import PlannerSectionCard from "../components/PlannerSectionCard";
import {
  exportFullPaperReaderAsDocx,
  exportFullPaperReaderAsPdf,
  runPaperReader,
} from "../services/paperReader";


const SECTION_DEFINITIONS = [
  { key: "summary", title: "Summary", transform: (result) => (result.summary ? [result.summary] : []) },
  { key: "methods_used", title: "Methods Used", transform: (result) => result.methods_used || [] },
  { key: "datasets_mentioned", title: "Datasets Mentioned", transform: (result) => result.datasets_mentioned || [] },
  { key: "key_findings", title: "Key Findings", transform: (result) => result.key_findings || [] },
];

function buildPaperReaderClipboardText(topic, title, items) {
  return [
    "Paper Reader Result",
    `Topic: ${topic}`,
    `Section: ${title}`,
    "",
    ...(items.length ? items.map((item, index) => `${index + 1}. ${item}`) : ["No items returned for this section."]),
  ].join("\n");
}

function PaperReaderPage() {
  const [paperText, setPaperText] = useState("");
  const [inputMode, setInputMode] = useState("text"); // "text" | "file"
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("Analyze an abstract or extracted paper text into structured research notes.");
  const [error, setError] = useState("");
  const [provider, setProvider] = useState("");
  const [result, setResult] = useState(null);
  const [actionState, setActionState] = useState({});

  function handleFileText(text, fileName) {
    setPaperText(text);
    setMessage(`Text extracted from "${fileName}" — click Run Paper Reader to analyze.`);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedText = paperText.trim();
    if (!normalizedText) {
      setError("Enter or upload paper text before running Paper Reader.");
      return;
    }

    setStatus("loading");
    setError("");
    setMessage("Analyzing the paper text through the backend paper reader.");

    try {
      const response = await runPaperReader({ paperText: normalizedText });
      setProvider(response.provider);
      setResult(response);
      setStatus("success");
      setMessage(`Paper Reader completed using ${response.provider}.`);
    } catch (requestError) {
      setProvider("");
      setResult(null);
      setStatus("error");
      setError(requestError.message || "Unable to analyze paper text.");
      setMessage("The paper reader request could not be completed.");
    }
  }

  async function handleCopy(sectionTitle, items, sectionKey) {
    const exportTopic = paperText.trim().slice(0, 80) || "paper-reader";
    setActionState((current) => ({ ...current, [sectionKey]: "copying" }));

    try {
      await navigator.clipboard.writeText(buildPaperReaderClipboardText(exportTopic, sectionTitle, items));
      setMessage(`Copied ${sectionTitle.toLowerCase()} to clipboard.`);
    } catch {
      setError("Clipboard access is unavailable in this browser context.");
    } finally {
      setActionState((current) => ({ ...current, [sectionKey]: "" }));
    }
  }

  async function handleFullExport(format) {
    if (!result) return;
    const exportTopic = actionState.topic || "paper-analysis";
    setActionState((prev) => ({ ...prev, globalExport: format }));
    setError("");

    try {
      // Build sections mapping for backend
      const sections = {};
      SECTION_DEFINITIONS.forEach((def) => {
        sections[def.key] = def.transform(result);
      });

      if (format === "pdf") {
        await exportFullPaperReaderAsPdf({ topic: exportTopic, sections });
      } else {
        await exportFullPaperReaderAsDocx({ topic: exportTopic, sections });
      }
      setMessage(`Consolidated research report exported as ${format.toUpperCase()}.`);
    } catch (err) {
      setError(err.message || "Export failed.");
    } finally {
      setActionState((prev) => ({ ...prev, globalExport: "" }));
    }
  }


  const sectionCount = result
    ? SECTION_DEFINITIONS.reduce((total, section) => total + section.transform(result).length, 0)
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <section className="overflow-hidden rounded-[32px] border border-white/80 bg-slate-950 text-white shadow-panel">
        <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-10">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Deep Paper Analysis</p>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Paper Reader
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Turn raw abstract text or extracted paper content into concise research notes, methods, datasets, and findings.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-panel-soft backdrop-blur">
            {/* Input mode toggle */}
            <div className="mb-4 flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setInputMode("text")}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  inputMode === "text"
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                ✏️ Paste Text
              </button>
              <button
                type="button"
                onClick={() => setInputMode("file")}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  inputMode === "file"
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                📎 Upload File
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {inputMode === "text" ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-200">Paper text</span>
                  <textarea
                    value={paperText}
                    onChange={(event) => setPaperText(event.target.value)}
                    placeholder="Paste an abstract or extracted paper text here"
                    rows={8}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-white focus:ring-2 focus:ring-white/25"
                  />
                </label>
              ) : (
                <FileUploadZone
                  label="Upload paper (PDF · DOCX · TXT)"
                  onTextExtracted={handleFileText}
                  disabled={status === "loading"}
                />
              )}

              {/* Show extracted preview if file was loaded */}
              {inputMode === "file" && paperText && (
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Extracted preview</p>
                  <p className="mt-1 line-clamp-3 text-xs text-slate-300">{paperText.slice(0, 300)}…</p>
                </div>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "loading" ? "Running Paper Reader..." : "Run Paper Reader"}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_2fr]">
        <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-panel h-fit sticky top-8">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Session State</p>
              <h2 className="mt-2 text-lg font-bold text-slate-900">Current Analysis</h2>
            </div>
            <dl className="space-y-4">
              {[
                { label: "Text Length", value: paperText.trim().length, large: true },
                { label: "Input Mode", value: inputMode, large: false },
                { label: "Provider", value: provider || "Not run yet", large: false },
                { label: "Total Items", value: sectionCount, large: false },
                { label: "Status", value: status, large: false },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{item.label}</dt>
                  <dd className={`mt-1 font-semibold text-slate-800 ${item.large ? 'text-3xl' : 'text-sm'}`}>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>

        <section className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-panel">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${status === 'loading' ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`} />
              <p className="text-sm font-bold text-slate-700">{message}</p>
            </div>
            {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}
          </div>

          {result ? (
            <div className="space-y-8">
              <div className="grid gap-6 xl:grid-cols-2">
                {SECTION_DEFINITIONS.map((section) => {
                  const items = section.transform(result);
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
              <div className="overflow-hidden rounded-[32px] border border-slate-900 bg-slate-950 p-8 shadow-2xl text-white">
                <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
                  <div className="space-y-1 text-center sm:text-left">
                    <h3 className="text-xl font-bold">Consolidated Research Report</h3>
                    <p className="text-sm text-slate-400">Download the full analysis as a structured document.</p>
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
            </div>

          ) : (
            <div className="rounded-[32px] border border-dashed border-slate-200 bg-white/50 p-16 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 text-slate-300">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <p className="text-xl font-bold text-slate-800">No paper analysis yet.</p>
              <p className="mt-2 text-sm leading-7 text-slate-500 font-medium">
                Paste text or upload a PDF/DOCX/TXT file and run Paper Reader.
              </p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

export default PaperReaderPage;
