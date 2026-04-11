import { useState } from "react";
import FileUploadZone from "../components/FileUploadZone";
import PlannerSectionCard from "../components/PlannerSectionCard";
import {
  exportContradictionSectionAsDocx,
  exportContradictionSectionAsPdf,
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-0.5">
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition ${
              mode === "text" ? "bg-white text-slate-900 shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            ✏️ Text
          </button>
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition ${
              mode === "file" ? "bg-white text-slate-900 shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            📎 File
          </button>
        </div>
      </div>
      {mode === "text" ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Paste the ${slot} research claim`}
          rows={5}
          className="w-full resize-none rounded-2xl border border-white/10 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-white focus:ring-2 focus:ring-white/25"
        />
      ) : (
        <>
          <FileUploadZone
            onTextExtracted={(text) => setValue(text)}
            disabled={disabled}
          />
          {value && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Extracted preview</p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-300">{value.slice(0, 200)}…</p>
            </div>
          )}
        </>
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

  async function handleExport(sectionTitle, items, sectionKey, format) {
    setActionState((current) => ({ ...current, [sectionKey]: format }));
    setError("");
    try {
      if (format === "pdf") {
        await exportContradictionSectionAsPdf({ topic: buildExportTopic(), sectionTitle, items });
      } else {
        await exportContradictionSectionAsDocx({ topic: buildExportTopic(), sectionTitle, items });
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

      <section className="grid gap-4 lg:grid-cols-[0.8fr_2fr]">
        <aside className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Session State</p>
              <h2 className="mt-2 text-lg font-semibold text-ink">Current Detection</h2>
            </div>
            <dl className="space-y-4 text-sm text-slate-600">
              <div className="rounded-2xl border border-line/80 bg-white/70 p-4">
                <dt className="text-xs uppercase tracking-[0.2em] text-muted">Claim A Length</dt>
                <dd className="mt-2 text-3xl font-semibold tracking-tight text-ink">{claimA.trim().length}</dd>
              </div>
              <div className="rounded-2xl border border-line/80 bg-white/70 p-4">
                <dt className="text-xs uppercase tracking-[0.2em] text-muted">Claim B Length</dt>
                <dd className="mt-2 text-3xl font-semibold tracking-tight text-ink">{claimB.trim().length}</dd>
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
              <p className="text-lg font-medium text-ink">No contradiction output yet.</p>
              <p className="mt-2 text-sm leading-7 text-slate-500">
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
