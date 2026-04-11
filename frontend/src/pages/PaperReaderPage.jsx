import { useState } from "react";
import FileUploadZone from "../components/FileUploadZone";
import PlannerSectionCard from "../components/PlannerSectionCard";
import {
  exportPaperReaderSectionAsDocx,
  exportPaperReaderSectionAsPdf,
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

  async function handleExport(sectionTitle, items, sectionKey, format) {
    const exportTopic = paperText.trim().slice(0, 80) || "paper-reader";
    setActionState((current) => ({ ...current, [sectionKey]: format }));
    setError("");

    try {
      if (format === "pdf") {
        await exportPaperReaderSectionAsPdf({ topic: exportTopic, sectionTitle, items });
      } else {
        await exportPaperReaderSectionAsDocx({ topic: exportTopic, sectionTitle, items });
      }
      setMessage(`Prepared ${format.toUpperCase()} export for ${sectionTitle.toLowerCase()}.`);
    } catch (exportError) {
      setError(exportError.message || `Unable to export ${format.toUpperCase()} file.`);
    } finally {
      setActionState((current) => ({ ...current, [sectionKey]: "" }));
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
        <aside className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Session State</p>
              <h2 className="mt-2 text-lg font-semibold text-ink">Current Analysis</h2>
            </div>
            <dl className="space-y-4 text-sm text-slate-600">
              <div className="rounded-2xl border border-line/80 bg-white/70 p-4">
                <dt className="text-xs uppercase tracking-[0.2em] text-muted">Text Length</dt>
                <dd className="mt-2 text-3xl font-semibold tracking-tight text-ink">{paperText.trim().length}</dd>
              </div>
              <div className="rounded-2xl border border-line/80 bg-white/70 p-4">
                <dt className="text-xs uppercase tracking-[0.2em] text-muted">Input Mode</dt>
                <dd className="mt-2 text-base font-medium capitalize text-ink">{inputMode}</dd>
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
                const items = section.transform(result);
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
              <p className="text-lg font-medium text-ink">No paper analysis yet.</p>
              <p className="mt-2 text-sm leading-7 text-slate-500">
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
