// Kicker minimalista com hairline superior e tipografia mono/tracked (TasteSkill).
export default function SectionBadge({ icon: Icon, children }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.03] border border-white/[0.09] backdrop-blur-md">
      {Icon && <Icon className="w-3.5 h-3.5 text-[#93C5FD]" strokeWidth={1.75} />}
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200/90">
        {children}
      </span>
    </div>
  );
}