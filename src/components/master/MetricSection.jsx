// MetricSection.jsx — Agrupa cards de métrica sob um título executivo de categoria (BI)

export default function MetricSection({ title, subtitle, icon: Icon, children, accent = 'blue' }) {
  const accentStyles = {
    blue: 'text-[#2563EB] dark:text-blue-400 bg-[#EFF6FF] dark:bg-blue-950/50 border border-[#DBEAFE] dark:border-blue-500/25',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/25',
    violet: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-500/25',
  };

  return (
    <section className="space-y-3">
      {/* Header da Seção */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#E5E7EF]/70 dark:border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${accentStyles[accent] || accentStyles.blue}`}>
              <Icon className="w-4 h-4" strokeWidth={1.75} />
            </div>
          )}
          <div>
            <h3 className="text-xs font-bold text-[#171827] dark:text-white uppercase tracking-wider">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-[#55596A] dark:text-slate-300/75 font-medium leading-tight">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <span className="text-[10px] font-mono font-semibold text-[#59658F] dark:text-slate-400 uppercase tracking-[0.18em] hidden sm:inline-block">
          BI · Indicadores
        </span>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {children}
      </div>
    </section>
  );
}