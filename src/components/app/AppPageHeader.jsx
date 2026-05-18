// Header padrão de página interna — versão DARK premium.
// Título com gradiente sutil, ícone glowing e slot de ações.

export default function AppPageHeader({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="relative w-10 h-10 rounded-xl bg-white/[0.04] ring-1 ring-blue-400/25 flex items-center justify-center flex-shrink-0">
            <span className="absolute inset-0 rounded-xl bg-[#60A5FA]/30 blur-md opacity-60" aria-hidden="true" />
            <Icon className="relative w-5 h-5 text-[#93C5FD]" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl lg:text-[26px] font-black tracking-tight leading-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
            {title}
          </h1>
          {subtitle && <p className="text-white/50 text-sm mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-wrap sm:self-start">
          {children}
        </div>
      )}
    </div>
  );
}