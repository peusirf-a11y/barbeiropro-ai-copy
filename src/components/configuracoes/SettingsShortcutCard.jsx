// Card de atalho reutilizável para a página de Configurações.
// Padrão dark glass premium — usado por: Pagamentos, Unidades, CRM, Privacidade, Segurança.
import { Link } from 'react-router-dom';

export default function SettingsShortcutCard({
  title,
  description,
  icon: Icon,
  ctaLabel,
  to,
  statusBadge = null,
  className = '',
}) {
  return (
    <div className={`mt-6 rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${className}`}>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
        <h2 className="font-bold text-white">{title}</h2>
        {statusBadge}
      </div>
      <p className="text-sm text-white/55 mb-4">{description}</p>
      <Link
        to={to}
        className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-blue-400/12 text-[#93C5FD] ring-1 ring-blue-400/25 hover:bg-blue-400/20 hover:text-white transition-colors"
      >
        {Icon && <Icon className="w-4 h-4" />}
        {ctaLabel}
      </Link>
    </div>
  );
}

// Badge "Ativo" verde — exportado para uso composto.
export function ActiveBadge({ children = 'Ativo' }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30">
      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> {children}
    </span>
  );
}