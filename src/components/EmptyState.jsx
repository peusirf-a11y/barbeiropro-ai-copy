// Componente reutilizável para estados vazios.
// Uso: <EmptyState icon={Users} title="Nenhum cliente ainda" description="..." action={<button>...</button>} />

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-12 px-6">
      {Icon && (
        <div className="relative w-14 h-14 mx-auto mb-4 bg-blue-400/[0.12] ring-1 ring-blue-400/25 rounded-2xl flex items-center justify-center">
          <span className="absolute inset-0 rounded-2xl bg-[#60A5FA]/20 blur-md opacity-60" aria-hidden="true" />
          <Icon className="relative w-6 h-6 text-[#93C5FD]" />
        </div>
      )}
      <h3 className="text-base font-bold text-white mb-1.5">{title}</h3>
      {description && <p className="text-sm text-white/55 max-w-sm mx-auto mb-5">{description}</p>}
      {action}
    </div>
  );
}