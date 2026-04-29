// Header padrão de página interna — título, subtítulo e slot de ações.
// Garante a hierarquia tipográfica oficial em todas as telas do app.

export default function AppPageHeader({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] ring-1 ring-[#DBEAFE] flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-[#2563EB]" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl lg:text-[26px] font-black text-[#111827] tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="text-[#6B7280] text-sm mt-0.5">{subtitle}</p>}
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