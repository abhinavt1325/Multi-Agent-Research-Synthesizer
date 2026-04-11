function PlannerSectionCard({
  title,
  items,
  onCopy,
  actionState,
}) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-panel backdrop-blur sm:p-7">
      <div className="flex h-full flex-col gap-5">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
          {items.length ? (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item}
                  className="rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm leading-7 text-slate-800"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/30 px-4 py-6 text-sm text-slate-600">
              No items identified for this section.
            </div>
          )}
        </div>

        <div className="mt-auto pt-4 flex justify-end">
          <button
            type="button"
            onClick={onCopy}
            className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-bold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            {actionState === "copying" ? "Copied" : "Copy Section"}
          </button>
        </div>
      </div>
    </article>
  );
}

export default PlannerSectionCard;
