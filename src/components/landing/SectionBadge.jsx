// Kicker minimalista com hairline superior e tipografia mono/tracked (TasteSkill).
export default function SectionBadge({ icon: Icon, children }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-50/95 dark:bg-white/[0.04] border border-blue-200/90 dark:border-white/[0.10] backdrop-blur-md shadow-xs">
      {Icon && <Icon className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#93C5FD]" strokeWidth={1.75} />}
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1E3A8A] dark:text-slate-200/90">
        {children}
      </span>
    </div>
  );
}