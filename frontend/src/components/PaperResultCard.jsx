function PaperResultCard({
  paper,
  onCopy,
  onExportPdf,
  onExportDocx,
  actionState,
  onSave,
}) {
  return (
    <article className="flex flex-col justify-between rounded-[28px] border border-slate-200 bg-white p-6 shadow-panel transition hover:border-slate-400 sm:p-7">
      <div className="flex flex-col gap-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5">{paper.source}</span>
              <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5">
                {paper.year ?? "Year N/A"}
              </span>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold leading-[1.3] text-slate-900 sm:text-[22px] tracking-tight">{paper.title}</h2>
            {paper.authors && paper.authors.length > 0 && (
              <p className="mt-2 text-sm font-bold text-indigo-700 line-clamp-1">{paper.authors.join(", ")}</p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-sm leading-relaxed text-slate-800 font-medium sm:text-[14.5px]">
              {paper.abstract || "Abstract not available for this publication."}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={actionState === "saved" || actionState === "saving"}
              className="inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 active:scale-95"
            >
              <svg className="mr-2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              {actionState === "saving" ? "Saving..." : actionState === "saved" ? "Saved ✓" : "Save to Graph"}
            </button>
            
            {paper.url ? (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-full bg-indigo-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-slate-900 active:scale-95"
              >
                <svg className="mr-2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Open Paper
              </a>
            ) : (
              <button
                disabled
                className="inline-flex rounded-full border border-slate-100 bg-slate-50 px-5 py-2.5 text-[13px] font-bold text-slate-400 cursor-not-allowed"
              >
                Source unavailable
              </button>
            )}

            {paper.pdf_url ? (
              <a
                href={paper.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-full border border-slate-300 bg-white px-5 py-2.5 text-[13px] font-bold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 active:scale-95"
              >
                View PDF
              </a>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopy}
              title="Copy details"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button
              type="button"
              onClick={onExportPdf}
              title="Export PDF"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </button>
            <button
              type="button"
              onClick={onExportDocx}
              title="Export DOCX"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2l6 6"/><path d="M11 13h5"/><path d="M11 17h5"/><path d="M11 9h2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default PaperResultCard;
