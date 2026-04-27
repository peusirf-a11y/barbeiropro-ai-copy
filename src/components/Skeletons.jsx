// Skeletons padronizados — variantes para diferentes layouts de página.
// Usa a classe .skeleton já definida em index.css.

export function SkeletonLine({ className = '' }) {
  return <div className={`skeleton h-4 ${className}`} />;
}

export function SkeletonCircle({ size = 40 }) {
  return <div className="skeleton rounded-full" style={{ width: size, height: size }} />;
}

// Skeleton para grid de KPIs no topo de uma página
export function SkeletonStats({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-black/8 p-5">
          <div className="skeleton h-9 w-9 rounded-xl mb-3" />
          <div className="skeleton h-7 w-20 mb-2" />
          <div className="skeleton h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

// Skeleton para listas (clientes, agendamentos, lançamentos…)
export function SkeletonList({ rows = 5, withAvatar = true }) {
  return (
    <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
      <div className="p-5 border-b border-black/5">
        <div className="skeleton h-5 w-48" />
      </div>
      <div className="divide-y divide-black/5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            {withAvatar && <div className="skeleton h-10 w-10 rounded-xl flex-shrink-0" />}
            <div className="flex-1 space-y-2 min-w-0">
              <div className="skeleton h-3.5 w-1/3" />
              <div className="skeleton h-3 w-1/2" />
            </div>
            <div className="skeleton h-6 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Skeleton para grid de cards (serviços, profissionais, combos…)
export function SkeletonCardGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-black/8 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="skeleton h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Skeleton genérico para uma página inteira (header + stats + lista)
export function SkeletonPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="space-y-2">
        <div className="skeleton h-7 w-48" />
        <div className="skeleton h-4 w-64" />
      </div>
      <SkeletonStats />
      <SkeletonList />
    </div>
  );
}