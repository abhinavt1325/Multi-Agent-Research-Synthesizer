import { useState, useRef, useEffect } from "react";
import { runSmartResearcher, exportSmartResearcherAsPdf, exportSmartResearcherAsDocx } from "../services/researchReport";

// ─── Pipeline stages ──────────────────────────────────────────────────────────
const STAGES = [
  { id: "planning",       label: "Planning research strategy",       icon: "🧭" },
  { id: "fetching",       label: "Fetching relevant papers",         icon: "📡" },
  { id: "reading",        label: "Extracting structured findings",   icon: "📖" },
  { id: "comparing",      label: "Comparing evidence patterns",      icon: "⚖️"  },
  { id: "contradictions", label: "Detecting contradictions",         icon: "🔍" },
  { id: "gaps",           label: "Analysing research gaps",          icon: "🕳️"  },
  { id: "synthesizing",   label: "Synthesising final briefing",      icon: "✨" },
];
const STAGE_MS = 9000;

const AGENT_TABS = [
  { id: "planner",       label: "Planner" },
  { id: "literature",    label: "Literature Hunter" },
  { id: "reader",        label: "Paper Reader" },
  { id: "comparator",    label: "Comparator" },
  { id: "contradiction", label: "Contradiction Detector" },
  { id: "gap",           label: "Research Gap" }
];

// ─── Export helpers ────────────────────────────────────────────────────────────

// ─── Confidence badge helper ───────────────────────────────────────────────────
function confidenceLabel(score) {
  if (score >= 75) return { label: "High Confidence", color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" };
  if (score >= 50) return { label: "Moderate Confidence", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" };
  return { label: "Preliminary", color: "#6366f1", bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.3)" };
}

function conflictMeta(level) {
  if (level === "high") return { label: "⚠ High Conflict", color: "#fca5a5", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" };
  if (level === "medium") return { label: "△ Medium Conflict", color: "#fcd34d", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" };
  return { label: "✓ Low Conflict", color: "#6ee7b7", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionAnchor({ id }) {
  return <div id={id} style={{ scrollMarginTop: "72px" }} />;
}

function SectionLabel({ text, color = "#ec4899" }) {
  return (
    <p style={{
      margin: "0 0 1.2rem 0", fontSize: "0.65rem", fontWeight: 800,
      letterSpacing: "0.25em", textTransform: "uppercase", color,
    }}>
      {text}
    </p>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: "rgba(17,24,39,0.8)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "20px", padding: "1.75rem", backdropFilter: "blur(8px)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function Bullet({ items, color = "#ec4899", emptyText = "No data." }) {
  if (!items?.length) return <p style={{ margin: 0, fontSize: "0.85rem", color: "#4b5563", fontStyle: "italic" }}>{emptyText}</p>;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.55rem" }}>
          <span style={{ color, flexShrink: 0, marginTop: "0.15em", fontSize: "0.75rem" }}>▸</span>
          <span style={{ fontSize: "0.87rem", lineHeight: 1.65, color: "#cbd5e1" }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Chip({ label, color, bg, border }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "0.3rem 0.8rem",
      borderRadius: "999px", fontSize: "0.74rem", fontWeight: 700,
      color, background: bg, border: `1px solid ${border}`,
    }}>
      {label}
    </span>
  );
}

function PipelineTracker({ stage, totalStages }) {
  return (
    <Card style={{ border: "1px solid rgba(236,72,153,0.2)", boxShadow: "0 0 40px rgba(236,72,153,0.05)" }}>
      <p style={{ margin: "0 0 1.5rem 0", fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "#ec4899" }}>
        Running Agent Pipeline
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
        {STAGES.map((s, idx) => {
          const isDone = idx < stage;
          const isActive = idx === stage;
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.85rem", opacity: idx > stage ? 0.3 : 1, transition: "opacity 0.4s" }}>
              <div style={{
                width: "9px", height: "9px", borderRadius: "50%", flexShrink: 0,
                background: isDone ? "#10b981" : isActive ? "#ec4899" : "rgba(255,255,255,0.15)",
                boxShadow: isActive ? "0 0 10px rgba(236,72,153,0.7)" : "none",
                animation: isActive ? "pulseDot 1.4s ease-in-out infinite" : "none",
              }} />
              <span style={{ fontSize: "0.88rem", color: isDone ? "#64748b" : isActive ? "#f8fafc" : "#374151", fontWeight: isActive ? 600 : 400 }}>
                {s.icon} {s.label}
                {isDone && <span style={{ marginLeft: "0.5rem", color: "#10b981", fontSize: "0.8rem" }}>✓</span>}
                {isActive && <span style={{ marginLeft: "0.5rem", color: "#ec4899", fontSize: "0.8rem" }}>…</span>}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Removed sticky nav due to tab architecture ───────────────────────────────

// ─── Executive Brief strip ────────────────────────────────────────────────────
function ExecutiveBrief({ report }) {
  const conf = confidenceLabel(report.confidence_score || 0);
  const items = [
    { label: "Confidence", value: `${report.confidence_score || 0}%`, sub: conf.label, color: conf.color },
    { label: "Papers Analyzed", value: report.pipeline_metadata?.papers_analyzed ?? 0, sub: `of ${report.pipeline_metadata?.papers_found ?? 0} retrieved`, color: "#60a5fa" },
    { label: "Domain", value: report.dominant_domain || "General Research", sub: "primary area", color: "#a78bfa" },
    { label: "Provider", value: (report.provider || "none").toUpperCase(), sub: "LLM engine", color: "#34d399" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
      {items.map((item) => (
        <div key={item.label} style={{
          background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "14px", padding: "1rem 1.25rem",
        }}>
          <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#475569" }}>
            {item.label}
          </p>
          <p style={{ margin: "0 0 0.2rem 0", fontSize: "1.3rem", fontWeight: 800, color: item.color, lineHeight: 1 }}>
            {item.value}
          </p>
          <p style={{ margin: 0, fontSize: "0.7rem", color: "#64748b" }}>{item.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Literature card ──────────────────────────────────────────────────────────
function PaperCard({ ps, index }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "14px", padding: "1.25rem 1.4rem",
    }}>
      {/* Title + URL */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6366f1", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Paper {index + 1}
          </span>
          <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.92rem", fontWeight: 600, color: "#f8fafc", lineHeight: 1.4 }}>
            {ps.title}
          </p>
        </div>
        {ps.url && (
          <a href={ps.url} target="_blank" rel="noopener noreferrer" style={{
            flexShrink: 0, fontSize: "0.7rem", padding: "0.25rem 0.65rem",
            background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
            borderRadius: "7px", color: "#a5b4fc", textDecoration: "none", whiteSpace: "nowrap",
          }}>
            Open ↗
          </a>
        )}
      </div>
      {/* Meta */}
      <p style={{ margin: "0 0 0.9rem 0", fontSize: "0.74rem", color: "#4b5563" }}>
        {ps.authors?.slice(0, 3).join(", ")}{ps.year ? ` · ${ps.year}` : ""}{ps.source ? ` · ${ps.source}` : ""}
      </p>
      {/* Structured fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
        {[
          { key: "objective", label: "Objective", color: "#60a5fa" },
          { key: "method",    label: "Method",    color: "#34d399" },
          { key: "finding",   label: "Key Finding", color: "#f9a8d4" },
          { key: "limitation",label: "Limitation", color: "#fbbf24" },
        ].map(({ key, label, color }) => (
          <div key={key} style={{ background: "rgba(255,255,255,0.025)", borderRadius: "8px", padding: "0.6rem 0.75rem" }}>
            <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color }}>
              {label}
            </p>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.55 }}>
              {ps[key] || "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Gap priority column ──────────────────────────────────────────────────────
function GapColumn({ label, items, accent, bg, border }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: "14px", padding: "1.1rem 1.25rem" }}>
      <p style={{ margin: "0 0 0.85rem 0", fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: accent }}>
        {label}
      </p>
      {items?.length ? (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {items.map((g, i) => (
            <li key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <span style={{ color: accent, flexShrink: 0, fontSize: "0.7rem", marginTop: "0.2em" }}>▸</span>
              <span style={{ fontSize: "0.83rem", color: "#94a3b8", lineHeight: 1.6 }}>{g}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#374151", fontStyle: "italic" }}>None identified.</p>
      )}
    </div>
  );
}

// ─── Export button ────────────────────────────────────────────────────────────
function ExportBtn({ id, onClick, icon, loading, disabled, children }) {
  return (
    <button id={id} type="button" onClick={onClick} disabled={loading || disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.4rem",
        padding: "0.5rem 1.1rem",
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "9px", fontSize: "0.82rem", fontWeight: 500,
        color: loading || disabled ? "#374151" : "#cbd5e1",
        cursor: loading || disabled ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.15s",
      }}
      onMouseEnter={(e) => { if (!loading && !disabled) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#f8fafc"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = loading || disabled ? "#374151" : "#cbd5e1"; }}
    >
      {loading ? <span style={{ width: "12px", height: "12px", border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#ec4899", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : <span>{icon}</span>}
      {children}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SmartResearcherPage() {
  const [topic, setTopic]               = useState("");
  const [pageStatus, setPageStatus]     = useState("idle"); // idle | generating | done | error
  const [report, setReport]             = useState(null);
  const [errMsg, setErrMsg]             = useState("");
  const [stageIdx, setStageIdx]         = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [copied, setCopied]             = useState(false);
  const [activeTab, setActiveTab]       = useState("planner");
  const timerRef = useRef(null);

  function startTimer() {
    setStageIdx(0);
    let idx = 0;
    function tick() {
      idx += 1;
      if (idx < STAGES.length) {
        setStageIdx(idx);
        timerRef.current = setTimeout(tick, STAGE_MS);
      }
    }
    timerRef.current = setTimeout(tick, STAGE_MS);
  }
  function stopTimer() { clearTimeout(timerRef.current); }

  async function handleGenerate() {
    if (!topic.trim()) return;
    setPageStatus("generating");
    setErrMsg("");
    setReport(null);
    startTimer();
    try {
      const result = await runSmartResearcher({ topic: topic.trim() });
      stopTimer();
      setStageIdx(STAGES.length);
      setReport(result);
      setPageStatus("done");
    } catch (err) {
      stopTimer();
      setErrMsg(err.message || "Report generation failed.");
      setPageStatus("error");
    }
  }

  async function handleExportPdf() {
    if (!report) return;
    setExportingPdf(true);
    try { await exportSmartResearcherAsPdf({ topic: report.topic, report_data: report }); }
    catch (err) { alert(err.message || "PDF export failed."); }
    finally { setExportingPdf(false); }
  }
  async function handleExportDocx() {
    if (!report) return;
    setExportingDocx(true);
    try { await exportSmartResearcherAsDocx({ topic: report.topic, report_data: report }); }
    catch (err) { alert(err.message || "DOCX export failed."); }
    finally { setExportingDocx(false); }
  }
  function handleCopy() {
    if (!report) return;
    navigator.clipboard.writeText(`Report ready for topic: ${report.topic}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  }

  const isGenerating = pageStatus === "generating";
  const isDone       = pageStatus === "done";

  return (
    <>
      <style>{`
        @keyframes pulseDot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:.6} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "2rem" }}>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section style={{
          background: "linear-gradient(135deg,rgba(236,72,153,.08) 0%,rgba(99,102,241,.05) 100%)",
          border: "1px solid rgba(236,72,153,.15)", borderRadius: "28px",
          padding: "2.25rem 2.75rem", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: "-50px", right: "-50px", width: "220px", height: "220px", background: "radial-gradient(circle,rgba(236,72,153,.1) 0%,transparent 70%)", pointerEvents: "none" }} />
          <p style={{ margin: "0 0 .75rem", fontSize: ".65rem", fontWeight: 800, letterSpacing: ".26em", textTransform: "uppercase", color: "#ec4899" }}>
            ✦ Flagship Feature
          </p>
          <h1 style={{ margin: "0 0 .6rem", fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 700, color: "#f8fafc", letterSpacing: "-.02em", lineHeight: 1.2 }}>
            Smart Researcher
          </h1>
          <p style={{ margin: 0, fontSize: ".92rem", color: "#94a3b8", lineHeight: 1.7, maxWidth: "520px" }}>
            Enter one research topic. All six AI agents analyse the literature, extract structured
            findings, compare evidence, detect contradictions, identify gaps, and synthesise one
            coherent professional research briefing.
          </p>
        </section>

        {/* ── Input ────────────────────────────────────────────────────────── */}
        <Card>
          <label htmlFor="smart-topic" style={{ display: "block", marginBottom: ".7rem", fontSize: ".72rem", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#4b5563" }}>
            Research Topic
          </label>
          <div style={{ display: "flex", gap: ".8rem", alignItems: "stretch" }}>
            <input
              id="smart-topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !isGenerating) handleGenerate(); }}
              placeholder="e.g. AI in medical diagnosis"
              disabled={isGenerating}
              style={{
                flex: 1, padding: ".85rem 1.2rem",
                background: "rgba(15,23,42,.8)", border: "1px solid rgba(255,255,255,.1)",
                borderRadius: "12px", fontSize: ".97rem", color: "#f8fafc", outline: "none",
                fontFamily: "inherit", opacity: isGenerating ? .5 : 1, transition: "border-color .2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(236,72,153,.5)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,.1)")}
            />
            <button
              id="smart-generate-btn"
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim()}
              style={{
                display: "inline-flex", alignItems: "center", gap: ".5rem",
                padding: ".85rem 1.85rem",
                background: isGenerating || !topic.trim()
                  ? "rgba(236,72,153,.25)"
                  : "linear-gradient(135deg,#ec4899 0%,#db2777 100%)",
                border: "none", borderRadius: "12px", fontSize: ".9rem", fontWeight: 700,
                color: "#fff", cursor: isGenerating || !topic.trim() ? "not-allowed" : "pointer",
                fontFamily: "inherit", whiteSpace: "nowrap", transition: "all .2s",
                boxShadow: isGenerating || !topic.trim() ? "none" : "0 4px 20px rgba(236,72,153,.35)",
              }}
            >
              {isGenerating ? (
                <><span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite" }} /> Generating…</>
              ) : (
                <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg> Generate Briefing</>
              )}
            </button>
          </div>
          <p style={{ margin: ".65rem 0 0", fontSize: ".76rem", color: "#374151" }}>
            Takes 60–120 s — all 6 agents run in sequence, extracting real findings from literature.
          </p>
        </Card>

        {/* ── Pipeline tracker ─────────────────────────────────────────────── */}
        {isGenerating && <PipelineTracker stage={stageIdx} totalStages={STAGES.length} />}

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {pageStatus === "error" && (
          <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", borderRadius: "14px", padding: "1.1rem 1.4rem" }}>
            <p style={{ margin: 0, color: "#fca5a5", fontSize: ".88rem" }}>⚠ {errMsg}</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* REPORT OUTPUT                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {isDone && report && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            
            {/* Export bar */}
            <div style={{
              display: "flex", flexWrap: "wrap", alignItems: "center",
              justifyContent: "space-between", gap: "1rem",
              background: "rgba(15,23,42,.7)", border: "1px solid rgba(255,255,255,.06)",
              borderRadius: "16px", padding: ".9rem 1.4rem",
            }}>
              <p style={{ margin: 0, fontSize: ".82rem", fontWeight: 600, color: "#94a3b8" }}>
                <span style={{ color: "#f8fafc" }}>{report.topic}</span> — Final Synthesis Ready
              </p>
              <div style={{ display: "flex", gap: ".55rem", flexWrap: "wrap" }}>
                <ExportBtn id="smart-copy-btn"  onClick={handleCopy} icon="📋" disabled={copied}>{copied ? "Copied!" : "Copy URL"}</ExportBtn>
                <ExportBtn id="smart-pdf-btn"   onClick={handleExportPdf}  icon="📄" loading={exportingPdf}>Export Academic PDF</ExportBtn>
                <ExportBtn id="smart-docx-btn"  onClick={handleExportDocx} icon="📝" loading={exportingDocx}>DOCX</ExportBtn>
              </div>
            </div>

            {/* ── Tabs Container ── */}
            <div style={{
              background: "rgba(11,18,32,0.6)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden"
            }}>
              <div style={{
                display: "flex", overflowX: "auto", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 0.5rem"
              }}>
                {AGENT_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: "1rem 1.2rem", background: "none", border: "none", cursor: "pointer",
                      fontSize: "0.8rem", fontWeight: activeTab === tab.id ? 700 : 500,
                      color: activeTab === tab.id ? "#ec4899" : "#64748b",
                      borderBottom: activeTab === tab.id ? "2px solid #ec4899" : "2px solid transparent",
                      whiteSpace: "nowrap", transition: "all 0.2s"
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content Area */}
              <div style={{ padding: "1.5rem", minHeight: "300px", animation: "fadeIn 0.3s ease-in-out" }}>
                
                {activeTab === "planner" && (
                  <div>
                    <SectionLabel text="Methods Landscape Generated" color="#34d399" />
                    {report.methods_landscape?.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
                        {report.methods_landscape.map((m, i) => (
                          <span key={i} style={{
                            display: "inline-flex", alignItems: "center", padding: ".3rem .85rem",
                            background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.2)",
                            borderRadius: "999px", fontSize: ".78rem", fontWeight: 500, color: "#6ee7b7",
                          }}>
                            {m}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: "#64748b", fontSize: "0.85rem" }}>No methods landscape available.</p>
                    )}
                  </div>
                )}

                {activeTab === "literature" && (
                  <div>
                    <SectionLabel text={`Literature Retrieved (${report.paper_summaries?.length || 0})`} color="#818cf8" />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {report.paper_summaries?.map((ps, i) => (
                        <div key={i} style={{ padding: "1rem", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <p style={{ margin: "0 0 0.3rem", fontSize: "0.85rem", fontWeight: 600, color: "#f8fafc" }}>{ps.title}</p>
                          <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>{ps.authors?.join(", ")} {ps.year ? `(${ps.year})` : ""}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "reader" && (
                  <div>
                    <SectionLabel text="Structured Evidence Extracted" color="#f9a8d4" />
                    <div style={{ display: "flex", flexDirection: "column", gap: ".85rem" }}>
                      {report.paper_summaries?.map((ps, i) => <PaperCard key={i} ps={ps} index={i} />)}
                    </div>
                  </div>
                )}

                {activeTab === "comparator" && (
                  <div>
                    <SectionLabel text="Evidence Comparison" color="#60a5fa" />
                    {(() => {
                      const ec = report.evidence_comparison;
                      const combined = [...(ec?.common_evidence || []), ...(ec?.consensus_trends || [])];
                      const differing = [...(ec?.differing_datasets || []), ...(ec?.evidence_clusters || [])];
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                          {combined.length > 0 && (<div><p style={{ margin: "0 0 .6rem", fontSize: ".65rem", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#475569" }}>Consensus & Common Evidence</p><Bullet items={combined} color="#60a5fa" /></div>)}
                          {differing.length > 0 && (<div><p style={{ margin: "0 0 .6rem", fontSize: ".65rem", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#475569" }}>Divergence & Clusters</p><Bullet items={differing} color="#f0abfc" /></div>)}
                          {!combined.length && !differing.length && (<p style={{ margin: 0, fontSize: ".85rem", color: "#374151", fontStyle: "italic" }}>Evidence comparison data not available.</p>)}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {activeTab === "contradiction" && (
                  <div>
                    <SectionLabel text="Contradiction Analysis" color="#f97316" />
                    {(() => {
                      const cf = report.contradictions_found;
                      if (!cf) return <p style={{ color: "#64748b", fontSize: "0.85rem" }}>No data.</p>;
                      const cMeta = conflictMeta(cf.conflict_level || "low");
                      return (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: ".75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                            <Chip label={cMeta.label} color={cMeta.color} bg={cMeta.bg} border={cMeta.border} />
                            <span style={{ fontSize: ".74rem", color: "#475569", textTransform: "capitalize" }}>Confidence: {cf.confidence_level}</span>
                          </div>
                          {cf.explanation && <p style={{ margin: "0 0 .85rem", fontSize: ".88rem", color: "#cbd5e1", lineHeight: 1.75 }}>{cf.explanation}</p>}
                          <Bullet items={cf.conflicting_statements} color="#f97316" emptyText="No specific conflicting statements identified." />
                        </div>
                      );
                    })()}
                  </div>
                )}

                {activeTab === "gap" && (
                  <div>
                    <SectionLabel text="Research Gaps by Priority" color="#a78bfa" />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: ".75rem" }}>
                      <GapColumn label="🔴 High Priority" items={report.research_gaps?.high_priority} accent="#fca5a5" bg="rgba(239,68,68,.06)" border="rgba(239,68,68,.2)" />
                      <GapColumn label="🟡 Medium Priority" items={report.research_gaps?.medium_priority} accent="#fcd34d" bg="rgba(245,158,11,.06)" border="rgba(245,158,11,.2)" />
                      <GapColumn label="🟢 Emerging Opportunity" items={report.research_gaps?.emerging} accent="#6ee7b7" bg="rgba(16,185,129,.06)" border="rgba(16,185,129,.2)" />
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* ── Final Synthesized Report (Always Visible Below Tabs) ── */}
            <div style={{ marginTop: "1rem" }}>
              <h2 style={{ fontSize: "1.2rem", color: "#f8fafc", margin: "0 0 1.5rem", fontWeight: 700 }}>Smart Researcher Final Report</h2>
              
              <ExecutiveBrief report={report} />

              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <Card>
                  <SectionLabel text="Executive Summary" />
                  <p style={{ margin: 0, fontSize: ".94rem", lineHeight: 1.9, color: "#cbd5e1", whiteSpace: "pre-wrap" }}>
                    {report.executive_summary || "Executive summary not available."}
                  </p>
                </Card>

                {report.key_findings?.length > 0 && (
                  <div>
                    <SectionLabel text="Key Synthesized Findings" color="#f9a8d4" />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: ".75rem" }}>
                      {report.key_findings.map((kf, i) => (
                        <div key={i} style={{
                          background: "linear-gradient(135deg,rgba(236,72,153,.07) 0%,rgba(99,102,241,.05) 100%)",
                          border: "1px solid rgba(236,72,153,.18)", borderRadius: "14px", padding: "1.1rem 1.25rem",
                          display: "flex", gap: ".7rem", alignItems: "flex-start",
                        }}>
                          <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: ".05rem" }}>{["💡","🔬","📊","🧪","🎯"][i % 5]}</span>
                          <p style={{ margin: 0, fontSize: ".86rem", color: "#e2e8f0", lineHeight: 1.65 }}>{kf}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {report.recommended_next_direction && (
                  <div style={{
                    background: "linear-gradient(135deg,rgba(236,72,153,.1) 0%,rgba(99,102,241,.07) 100%)",
                    border: "1px solid rgba(236,72,153,.25)", borderRadius: "20px",
                    padding: "2rem 2.25rem", position: "relative", overflow: "hidden",
                  }}>
                    <div style={{ position: "absolute", bottom: "-30px", right: "-30px", width: "160px", height: "160px", background: "radial-gradient(circle,rgba(236,72,153,.1) 0%,transparent 70%)", pointerEvents: "none" }} />
                    <SectionLabel text="🚀 Recommended Next Research Direction" />
                    <p style={{ margin: 0, fontSize: "1rem", lineHeight: 1.85, color: "#e2e8f0", fontStyle: "italic", maxWidth: "680px" }}>
                      "{report.recommended_next_direction}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
