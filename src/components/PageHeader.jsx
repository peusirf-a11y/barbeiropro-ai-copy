// Cabeçalho de página padronizado para todas as telas internas (App e Demo).
// Mantém hierarquia tipográfica consistente — H1 grande + subtítulo discreto.

export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
      <div>
        <h1 className="text-[26px] sm:text-[28px] font-bold text-[#0F172A] tracking-tight leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-1.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
    </div>
  );
}