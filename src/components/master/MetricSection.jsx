// MetricSection.jsx — Agrupa cards de métrica sob um título executivo de categoria (BI)
// Estilização com tokens #171827, #59658F, #E5E7EF e ícones Lucide strokeWidth=1.75

export default function MetricSection({ title, subtitle, icon: Icon, children, accent = 'blue' }) {
  const accentStyles = {
    blue: 'text-[#2563EB] bg-[#EFF6FF] dark:bg-blue-950/40 border border-[#DBEAFE] dark:border-blue-800/40',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40',
    violet: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40',
  };

  return (
    <section className="space-y-3">
      {/* Header da Seção */}
      <div className="flex items-center justify-between gap-3 pb-1 border-b border-[#E5E7EF]/70 dark:border-[#232538]/70">
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
              <p className="text-[11px] text-[#55596A] dark:text-[#8F9BBF] font-medium leading-tight">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#59658F]/10 text-[#59658F] dark:text-[#B5D7E8] border border-[#59658F]/20 uppercase tracking-widest hidden sm:inline-block">
          BI Metrics
        </span>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {children}
      </div>
    </section>
  );
}