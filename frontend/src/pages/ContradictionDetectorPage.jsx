import { useState } from "react";
import FileUploadZone from "../components/FileUploadZone";
import PlannerSectionCard from "../components/PlannerSectionCard";
import {
  exportFullContradictionAsDocx,
  exportFullContradictionAsPdf,
  runContradictionDetector,
} from "../services/contradictionDetector";


const SECTION_DEFINITIONS = [
  {
    key: "contradiction_found",
    title: "Contradiction Found",
    transform: (result) => [result.contradiction_found ? "Contradiction detected" : "No contradiction detected"],
  },
  {
    key: "conflicting_statements",
    title: "Conflicting Statements",
    transform: (result) => result.conflicting_statements || [],
  },
  {
    key: "confidence_level",
    title: "Confidence Level",
    transform: (result) => [result.confidence_level || "unknown"],
  },
  {
    key: "explanation",
    title: "Explanation",
    transform: (result) => (result.explanation ? [result.explanation] : []),
  },
];

function buildContradictionClipboardText(topic, title, items) {
  return [
    "Contradiction Detector Result",
    `Comparison: ${topic}`,
    `Section: ${title}`,
    "",
    ...(items.length ? items.map((item, index) => `${index + 1}. ${item}`) : ["No items returned for this section."]),
  ].join("\n");
}

function ClaimInput({ label, slot, value, setValue, mode, setMode, disabled }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-200">{label}</span>
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
              mode === "text" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            ✏️ TEXT
          </button>
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
              mode === "file" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            📎 FILE
          </button>
        </div>
      </div>
      {mode === "text" ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Paste the ${slot} research claim`}
          rows={5}
          className="w-full resize-none rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-white/20"
        />
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border-2 border-dashed border-white/10 bg-white/5 p-1 transition hover:border-white/20">
            <FileUploadZone
              onTextExtracted={(text) => setValue(text)}
              disabled={disabled}
            />
          </div>
          {value && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Extracted preview</p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-300 font-medium">{value.slice(0, 200)}…</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ContradictionDetectorPage() {
  const [claimA, setClaimA] = useState("");
  const [claimB, setClaimB] = useState("");
  const [modeA, setModeA] = useState("text");
  const [modeB, setModeB] = useState("text");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("Compare two research claims to detect conflicts and explain the result.");
  const [error, setError] = useState("");
  const [provider, setProvider] = useState("");
  const [result, setResult] = useState(null);
  const [actionState, setActionState] = useState({});

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedClaimA = claimA.trim();
    const normalizedClaimB = claimB.trim();

    if (!normalizedClaimA || !normalizedClaimB) {
      setError("Enter or upload both claims before running Contradiction Detector.");
      return;
    }

    setStatus("loading");
    setError("");
    setMessage("Checking both claims for direct contradiction through the backend detector.");

    try {
      const response = await runContradictionDetector({
        claimA: normalizedClaimA,
        claimB: normalizedClaimB,
      });
      setProvider(response.provider);
      setResult(response);
      setStatus("success");
      setMessage(`Contradiction Detector completed using ${response.provider}.`);
    } catch (requestError) {
      setProvider("");
      setResult(null);
      setStatus("error");
      setError(requestError.message || "Unable to analyze the supplied claims.");
      setMessage("The contradiction detection request could not be completed.");
    }
  }

  function buildExportTopic() {
    const left = claimA.trim().slice(0, 36) || "claim-a";
    const right = claimB.trim().slice(0, 36) || "claim-b";
    return `${left} vs ${right}`;
  }

  async function handleCopy(sectionTitle, items, sectionKey) {
    setActionState((current) => ({ ...current, [sectionKey]: "copying" }));
    try {
      await navigator.clipboard.writeText(buildContradictionClipboardText(buildExportTopic(), sectionTitle, items));
      setMessage(`Copied ${sectionTitle.toLowerCase()} to clipboard.`);
    } catch {
      setError("Clipboard access is unavailable in this browser context.");
    } finally {
      setActionState((current) => ({ ...current, [sectionKey]: "" }));
    }
  }

  async function handleFullExport(format) {
    if (!result) return;
    const exportTopic = buildExportTopic();
    setActionState((prev) => ({ ...prev, globalExport: format }));
    setError("");

    try {
      // Build sections mapping for backend using transforms
      const sections = {};
      SECTION_DEFINITIONS.forEach((def) => {
        sections[def.key] = def.transform(result);
      });

      if (format === "pdf") {
        await exportFullContradictionAsPdf({ topic: exportTopic, sections });
      } else {
        await exportFullContradictionAsDocx({ topic: exportTopic, sections });
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
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
              Contradiction Analysis
            </p>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Contradiction Detector
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Compare two research claims to decide whether they conflict, identify the clashing statements, and
                explain the confidence level.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-panel-soft backdrop-blur">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <ClaimInput
                label="Claim A — First Research Claim"
                slot="first"
                value={claimA}
                setValue={setClaimA}
                mode={modeA}
                setMode={setModeA}
                disabled={status === "loading"}
              />
              <ClaimInput
                label="Claim B — Second Research Claim"
                slot="second"
                value={claimB}
                setValue={setClaimB}
                mode={modeB}
                setMode={setModeB}
                disabled={status === "loading"}
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "loading" ? "Running Detector..." : "Run Contradiction Detector"}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.8fr_2fr]">
        <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-panel h-fit sticky top-8">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Session State</p>
              <h2 className="mt-2 text-lg font-bold text-slate-900">Current Detection</h2>
            </div>
            <dl className="space-y-4">
              {[
                { label: "Claim A Length", value: claimA.trim().length, large: true },
                { label: "Claim B Length", value: claimB.trim().length, large: true },
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
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <p className="text-xl font-bold text-slate-800">No contradiction output yet.</p>
              <p className="mt-2 text-sm leading-7 text-slate-500 font-medium">
                Paste or upload two research claims (PDF · DOCX · TXT) and run the detector.
              </p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

export default ContradictionDetectorPage;
