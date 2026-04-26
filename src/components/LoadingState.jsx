// Loading state premium — substitui o "carregando..." genérico.
// Use <LoadingState /> dentro de páginas para mostrar skeletons elegantes.

export default function LoadingState({ rows = 3 }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-premium">
            <div className="skeleton h-9 w-9 rounded-xl mb-3" />
            <div className="skeleton h-7 w-20 mb-2" />
            <div className="skeleton h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="card-premium">
        <div className="skeleton h-5 w-48 mb-5" />
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="skeleton h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-1/3" />
                <div className="skeleton h-3 w-1/2" />
              </div>
              <div className="skeleton h-6 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Spinner({ size = 32 }) {
  return (
    <div
      className="border-[3px] border-[#2563EB]/15 border-t-[#2563EB] rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  );
}