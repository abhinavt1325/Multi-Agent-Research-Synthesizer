import { useState } from "react";
import FileUploadZone from "../components/FileUploadZone";
import PlannerSectionCard from "../components/PlannerSectionCard";
import {
  exportFullEvidenceAsDocx,
  exportFullEvidenceAsPdf,
  runEvidenceComparator,
} from "../services/evidenceComparator";


const SECTION_DEFINITIONS = [
  { key: "common_evidence", title: "Common Evidence" },
  { key: "differing_methods", title: "Differing Methods" },
  { key: "differing_datasets", title: "Differing Datasets" },
  { key: "evidence_clusters", title: "Evidence Clusters" },
  { key: "consensus_trends", title: "Consensus Trends" },
];

function buildEvidenceClipboardText(title, items) {
  return [
    "Evidence Synthesis Result",
    `Section: ${title}`,
    "",
    ...(items.length ? items.map((item, index) => `${index + 1}. ${item}`) : ["No items returned for this section."]),
  ].join("\n");
}

function EvidenceComparatorPage() {
  const [summaries, setSummaries] = useState([
    { text: "", mode: "text" },
    { text: "", mode: "text" },
  ]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("Configure documents and run the multi-file synthesis workspace.");
  const [error, setError] = useState("");
  const [provider, setProvider] = useState("");
  const [result, setResult] = useState(null);
  const [actionState, setActionState] = useState({});

  const fileCount = summaries.length;

  function updateSummary(index, patch) {
    setSummaries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function addDocument() {
    if (summaries.length < 10) {
      setSummaries([...summaries, { text: "", mode: "text" }]);
    }
  }

  function removeDocument(index) {
    if (summaries.length > 2) {
      setSummaries(summaries.filter((_, i) => i !== index));
    }
  }

  function handleFileCountChange(newCount) {
    const currentCount = summaries.length;
    if (newCount > currentCount) {
      const additional = Array.from({ length: newCount - currentCount }, () => ({ text: "", mode: "text" }));
      setSummaries([...summaries, ...additional]);
    } else if (newCount < currentCount) {
      setSummaries(summaries.slice(0, newCount));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedTexts = summaries.map((s) => s.text.trim()).filter(Boolean);

    if (normalizedTexts.length < summaries.length) {
      setError("Please provide content for all document slots before running the synthesis.");
      return;
    }

    setStatus("loading");
    setError("");
    setMessage("Synthesizing evidence patterns across all documents...");

    try {
      const response = await runEvidenceComparator({
        summaries: normalizedTexts,
      });
      setProvider(response.provider);
      setResult(response);
      setStatus("success");
      setMessage(`Synthesis completed successfully using ${response.provider}.`);
    } catch (requestError) {
      setProvider("");
      setResult(null);
      setStatus("error");
      setError(requestError.message || "Unable to synthesize document evidence.");
      setMessage("Analysis failed. Please check your inputs and try again.");
    }
  }

  async function handleCopy(sectionTitle, items, sectionKey) {
    setActionState((current) => ({ ...current, [sectionKey]: "copying" }));
    try {
      await navigator.clipboard.writeText(buildEvidenceClipboardText(sectionTitle, items));
      setMessage(`Copied ${sectionTitle.toLowerCase()} to clipboard.`);
    } catch {
      setError("Clipboard access is unavailable.");
    } finally {
      setActionState((current) => ({ ...current, [sectionKey]: "" }));
    }
  }

  async function handleFullExport(format) {
    if (!result) return;
    const exportTopic = actionState.topic || "evidence-synthesis";
    setActionState((prev) => ({ ...prev, globalExport: format }));
    setError("");

    try {
      // Build sections mapping for backend
      const sections = {};
      SECTION_DEFINITIONS.forEach((def) => {
        sections[def.key] = result[def.key] || [];
      });

      if (format === "pdf") {
        await exportFullEvidenceAsPdf({ topic: exportTopic, sections });
      } else {
        await exportFullEvidenceAsDocx({ topic: exportTopic, sections });
      }
      setMessage(`Consolidated research report exported as ${format.toUpperCase()}.`);
    } catch (err) {
      setError(err.message || "Export failed.");
    } finally {
      setActionState((prev) => ({ ...prev, globalExport: "" }));
    }
  }


  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[32px] border border-line bg-panel text-ink shadow-panel">
        <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-10">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">Advanced Synthesis Agent</p>
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Evidence Comparator
              </h1>
              <p className="max-w-xl text-sm leading-7 text-muted sm:text-base">
                Compare multiple research papers to identify consensus, divergence, 
                methodological variation, and strongest evidence patterns.
              </p>
            </div>
            {/* Capability Chips */}
            <div className="flex flex-wrap gap-2">
              {["Multi-file comparison", "Consensus detection", "Method divergence", "Evidence clustering"].map((chip) => (
                <span key={chip} className="rounded-full border border-line bg-canvas/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  • {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-center gap-4">
            <div className="rounded-[24px] border border-line bg-canvas/30 p-6 backdrop-blur">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted">Comparison Scope</label>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-ink">Number of papers</span>
                <select 
                  className="rounded-xl border border-line bg-canvas px-3 py-1.5 text-sm font-medium text-ink outline-none focus:border-accent"
                  value={fileCount}
                  onChange={(e) => handleFileCountChange(parseInt(e.target.value, 10))}
                >
                  {[2,3,4,5,6,7,8,9,10].map(c => <option key={c} value={c}>{c} Documents</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Document Control ────────────────────────────────────────────── */}
      <section className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((s, idx) => (
            <div key={idx} className="flex flex-col rounded-[28px] border border-line bg-panel p-5 shadow-panel transition hover:border-line/80">
              <div className="mb-4 flex items-center justify-between">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-canvas border border-line text-[10px] font-bold text-ink shadow-sm">
                  {idx + 1}
                </span>
                <div className="flex gap-1 rounded-xl border border-line bg-canvas p-1">
                  <button
                    onClick={() => updateSummary(idx, { mode: "text" })}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${s.mode === "text" ? "bg-panel text-ink shadow-sm border border-line" : "text-muted hover:text-ink"}`}
                  >
                    TEXT
                  </button>
                  <button
                    onClick={() => updateSummary(idx, { mode: "file" })}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${s.mode === "file" ? "bg-panel text-ink shadow-sm border border-line" : "text-muted hover:text-ink"}`}
                  >
                    FILE
                  </button>
                </div>
              </div>

              <div className="flex-1">
                {s.mode === "text" ? (
                  <textarea
                    className="h-32 w-full resize-none rounded-2xl border border-line bg-canvas px-4 py-3 text-xs font-medium text-ink outline-none placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent/20"
                    placeholder={`Paste Paper ${idx + 1} summary or text...`}
                    value={s.text}
                    onChange={(e) => updateSummary(idx, { text: e.target.value })}
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-2xl border-2 border-dashed border-line bg-canvas/30 p-1 transition hover:border-accent/40">
                      <FileUploadZone
                        onTextExtracted={(text) => updateSummary(idx, { text })}
                        disabled={status === "loading"}
                      />
                    </div>
                    {s.text && (
                      <div className="rounded-xl border border-line bg-canvas/50 p-3">
                        <p className="line-clamp-2 text-[10px] font-medium text-ink/80">{s.text.slice(0, 150)}...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {summaries.length > 2 && (
                <button 
                  onClick={() => removeDocument(idx)}
                  className="mt-4 flex items-center justify-center gap-1.5 self-end text-[10px] font-bold uppercase tracking-wider text-red-600 hover:text-red-800 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  Remove Document
                </button>
              )}
            </div>
          ))}

          {summaries.length < 10 && (
            <button 
              onClick={addDocument}
              className="flex flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-line bg-panel p-10 text-muted transition hover:border-accent hover:bg-canvas hover:text-ink shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-canvas shadow-md border border-line text-ink">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest">Add Comparison Slot</span>
            </button>
          )}
        </div>

        <div className="flex justify-center py-6">
          <button
            onClick={handleSubmit}
            disabled={status === "loading"}
            className="group flex items-center gap-3 rounded-full border border-line bg-accent/20 px-12 py-5 text-sm font-bold text-accent shadow-2xl transition hover:scale-[1.02] hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
          >
            {status === "loading" ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
                Processing workspace...
              </>
            ) : (
              <>
                Analyze Synthesis Patterns
                <svg className="transition-transform group-hover:translate-x-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </>
            )}
          </button>
        </div>
      </section>

      {/* ── Results Section ─────────────────────────────────────────────── */}
      <section className="grid gap-6">
        <div className="rounded-[28px] border border-line bg-panel p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${status === 'loading' ? 'bg-accent animate-pulse' : 'bg-muted'}`} />
            <p className="text-sm font-bold text-ink">{message}</p>
          </div>
          {error && <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-bold text-red-500">{error}</p>}
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
                  <p className="text-sm text-muted">Download the full synthesis as a structured document.</p>
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
          status !== "loading" && (
            <div className="rounded-[32px] border-2 border-dashed border-line bg-panel py-24 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-canvas text-muted border border-line">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
              </div>
              <h3 className="text-xl font-bold text-ink">No Synthesis Findings</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-muted font-medium">
                Supply summaries for at least two research papers above and click analyze to generate synthesis patterns.
              </p>
            </div>
          )
        )}
      </section>
    </div>
  );
}

export default EvidenceComparatorPage;
