// Banner global mostrado quando há impersonação ativa.
// Renderizado dentro de AppLayout para ser visível em todo /app.
import { ShieldAlert, X } from 'lucide-react';
import { useImpersonationContext } from '@/contexts/ImpersonationContext';

export default function ImpersonationBanner() {
  const { isImpersonating, impersonatedCompanyName, impersonationExpiresAt, stopImpersonation } = useImpersonationContext();

  if (!isImpersonating) return null;

  const expiresIn = impersonationExpiresAt
    ? Math.max(0, Math.round((new Date(impersonationExpiresAt).getTime() - Date.now()) / 60000))
    : 0;

  return (
    <div className="sticky top-0 z-40 bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm shadow-md">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">
          <strong>Modo impersonação</strong> · visualizando como <strong>{impersonatedCompanyName}</strong> · expira em ~{expiresIn}min
        </span>
      </div>
      <button
        onClick={() => { stopImpersonation(); window.location.href = '/master'; }}
        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md text-xs font-semibold flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" /> Encerrar
      </button>
    </div>
  );
}