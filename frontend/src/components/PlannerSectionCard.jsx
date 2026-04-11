function PlannerSectionCard({
  title,
  items,
  onCopy,
  onExportPdf,
  onExportDocx,
  actionState,
}) {
  return (
    <article className="rounded-[28px] border border-line/90 bg-panel/95 p-6 shadow-panel-soft backdrop-blur sm:p-7">
      <div className="flex h-full flex-col gap-5">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">{title}</p>
          {items.length ? (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item}
                  className="rounded-2xl border border-line/80 bg-white/75 px-4 py-3 text-sm leading-7 text-slate-700"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-6 text-sm text-slate-500">
              No items returned for this section.
            </div>
          )}
        </div>

        <div className="mt-auto flex flex-wrap gap-3 border-t border-line/80 pt-4">
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

export default PlannerSectionCard;
