// Componente reutilizável para estados vazios.
// Uso: <EmptyState icon={Users} title="Nenhum cliente ainda" description="..." action={<button>...</button>} />

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-12 px-6">
      {Icon && (
        <div className="w-14 h-14 mx-auto mb-4 bg-[#2563EB]/10 rounded-2xl flex items-center justify-center">
          <Icon className="w-6 h-6 text-[#2563EB]" />
        </div>
      )}
      <h3 className="text-base font-bold text-[#0F172A] mb-1.5">{title}</h3>
      {description && <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">{description}</p>}
      {action}
    </div>
  );
}