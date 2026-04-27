// TotpGate — Garante que super admin tenha sessão 2FA válida antes de exibir o conteúdo.
// Combina com SuperAdminRoute (que valida is_super_admin).
//
// Fluxo:
//   1. Se totp_enabled === false → mostra TotpSetup
//   2. Se totp_enabled === true mas sessão inválida → mostra TotpChallenge
//   3. Se sessão válida → renderiza children
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getTotpToken, getTotpSession } from '@/lib/totpSession';
import TotpSetup from '@/components/master/TotpSetup';
import TotpChallenge from '@/components/master/TotpChallenge';

export default function TotpGate({ children }) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const refresh = () => setRefreshKey(k => k + 1);
    window.addEventListener('totp-session-changed', refresh);
    return () => window.removeEventListener('totp-session-changed', refresh);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['totp-status', refreshKey],
    queryFn: async () => {
      const res = await base44.functions.invoke('totpStatus', {
        totp_session_token: getTotpToken(),
      });
      return res.data;
    },
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F7F8FB]">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-sm text-red-600">Erro ao verificar 2FA: {data?.error || 'desconhecido'}</div>
      </div>
    );
  }

  if (!data.totp_enabled) {
    return <TotpSetup onComplete={() => setRefreshKey(k => k + 1)} />;
  }

  // Confere sessão local também (guarda contra token expirado)
  const localSession = getTotpSession();
  if (!data.session_valid || !localSession) {
    return <TotpChallenge onSuccess={() => setRefreshKey(k => k + 1)} />;
  }

  return children;
}