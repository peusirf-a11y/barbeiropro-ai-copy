// ImpersonationCountdown — Banner com countdown regressivo da sessão de impersonação.
// Exibido apenas quando isImpersonating=true.
// Exibe alerta quando < 2 min restantes.

import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, X } from 'lucide-react';
import { useImpersonationContext } from '@/contexts/ImpersonationContext';
import {
  getImpersonationSecondsLeft,
  formatSecondsLeft,
  isImpersonationExpiringSoon,
} from '@/lib/security/sessionManager';

export default function ImpersonationCountdown() {
  const { isImpersonating, impersonatedCompanyName, impersonationExpiresAt, stopImpersonation } =
    useImpersonationContext();

  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!isImpersonating) return;

    const update = () => setSecondsLeft(getImpersonationSecondsLeft(impersonationExpiresAt));
    update();
    const interval = setInterval(() => {
      const s = getImpersonationSecondsLeft(impersonationExpiresAt);
      setSecondsLeft(s);
      if (s === 0) {
        stopImpersonation();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isImpersonating, impersonationExpiresAt, stopImpersonation]);

  if (!isImpersonating) return null;

  const expiringSoon = secondsLeft <= 120;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-2 text-sm font-semibold shadow-lg ${
        expiringSoon
          ? 'bg-red-600 text-white animate-pulse'
          : 'bg-amber-500 text-white'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {expiringSoon ? (
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        ) : (
          <Clock className="w-4 h-4 flex-shrink-0" />
        )}
        <span className="truncate">
          Impersonando: <strong>{impersonatedCompanyName}</strong>
          {expiringSoon && ' — Sessão expira em breve!'}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="font-mono text-base font-black">
          {formatSecondsLeft(secondsLeft)}
        </span>
        <button
          onClick={stopImpersonation}
          className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors"
          title="Encerrar impersonação"
        >
          <X className="w-3 h-3" /> Encerrar
        </button>
      </div>
    </div>
  );
}