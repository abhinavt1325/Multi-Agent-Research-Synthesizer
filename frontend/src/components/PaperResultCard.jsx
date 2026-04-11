function PaperResultCard({
  paper,
  onCopy,
  onExportPdf,
  onExportDocx,
  actionState,
}) {
  return (
    <article className="rounded-[28px] border border-line/90 bg-panel/95 p-6 shadow-panel-soft backdrop-blur sm:p-7">
      <div className="flex flex-col gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted">
            <span className="rounded-full border border-line bg-white/70 px-3 py-1">{paper.source}</span>
            <span className="rounded-full border border-line bg-white/70 px-3 py-1">
              {paper.year ?? "Year unavailable"}
            </span>
          </div>
          <h2 className="text-xl font-semibold leading-tight text-ink sm:text-2xl">{paper.title}</h2>
          <p className="text-sm leading-7 text-slate-600 sm:text-[15px]">
            {paper.abstract || "Abstract not available for this paper."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-line/80 pt-4">
          <button
            type="button"
            onClick={onCopy}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            {actionState === "copying" ? "Copying..." : "Copy"}
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            className="rounded-full border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {actionState === "pdf" ? "Exporting..." : "Export PDF"}
          </button>
          <button
            type="button"
            onClick={onExportDocx}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            {actionState === "docx" ? "Exporting..." : "Export DOCX"}
          </button>
        </div>
      </div>
    </article>
  );
}

export default PaperResultCard;
