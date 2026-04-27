// Banner global mostrado quando há impersonação ativa.
// Renderizado dentro de AppLayout para ser visível em todo /app.
import { useEffect, useState } from 'react';
import { Eye, X, ShieldAlert } from 'lucide-react';
import { getImpersonation, stopImpersonation } from '@/lib/impersonation';

export default function ImpersonationBanner() {
  const [imp, setImp] = useState(getImpersonation());

  useEffect(() => {
    const refresh = () => setImp(getImpersonation());
    window.addEventListener('impersonation-changed', refresh);
    window.addEventListener('storage', refresh);
    const t = setInterval(refresh, 30_000); // verifica TTL
    return () => {
      window.removeEventListener('impersonation-changed', refresh);
      window.removeEventListener('storage', refresh);
      clearInterval(t);
    };
  }, []);

  if (!imp?.active) return null;

  const expiresIn = Math.max(0, Math.round((new Date(imp.expires_at).getTime() - Date.now()) / 60000));

  return (
    <div className="sticky top-0 z-40 bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm shadow-md">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">
          <strong>Modo impersonação</strong> · visualizando como <strong>{imp.company_name}</strong> · expira em ~{expiresIn}min
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