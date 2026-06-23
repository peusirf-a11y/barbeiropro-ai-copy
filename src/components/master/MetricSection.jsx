// MetricSection — agrupa cards de métrica sob um título de categoria.
export default function MetricSection({ title, subtitle, icon: Icon, children, accent = 'blue' }) {
  const accentColors = {
    blue: 'text-[#2563EB] bg-[#EFF6FF] ring-[#DBEAFE]',
    emerald: 'text-emerald-700 bg-emerald-50 ring-emerald-100',
    violet: 'text-violet-700 bg-violet-50 ring-violet-100',
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        {Icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ring-1 ${accentColors[accent] || accentColors.blue}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div>
          <h3 className="text-sm font-bold text-foreground tracking-tight uppercase">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">{children}</div>
    </div>
  );
}