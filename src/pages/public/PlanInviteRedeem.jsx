// Página pública de redenção de invite token de PLANO DA PLATAFORMA (Plan/SaaS).
// URL: /planos/convite/:token
//
// Fluxo:
//   1) Se não autenticado → redireciona pra login
//   2) Se autenticado → chama validatePlanInvite(kind='platform', token)
//   3) Em sucesso → /app/configuracoes/assinatura com flash "plano liberado"
//
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function PlanInviteRedeem() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, isLoadingAuth, navigateToLogin } = useAuth();
  const [status, setStatus] = useState('checking'); // checking | success | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) { navigateToLogin?.(); return; }
    if (!token || token.length < 8) { setStatus('error'); setError('INVALID_INVITE'); return; }

    (async () => {
      try {
        const res = await base44.functions.invoke('validatePlanInvite', { kind: 'platform', token });
        if (res?.data?.success) {
          setResult(res.data.plan);
          setStatus('success');
          setTimeout(() => navigate('/app/configuracoes/assinatura?invite=ok'), 1800);
        } else {
          setError(res?.data?.error || 'INVALID_INVITE');
          setStatus('error');
        }
      } catch (e) {
        setError(e?.response?.data?.error || 'INVALID_INVITE');
        setStatus('error');
      }
    })();
  }, [token, user, isLoadingAuth, navigate, navigateToLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-sm w-full glass-surface rounded-2xl p-8 text-center">
        {status === 'checking' && (
          <>
            <Loader2 className="w-8 h-8 text-[#60A5FA] animate-spin mx-auto mb-4" />
            <h1 className="font-bold text-foreground mb-1">Validando convite…</h1>
            <p className="text-sm text-muted-foreground">Aguarde um instante.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
            <h1 className="font-bold text-foreground mb-1">Convite validado!</h1>
            <p className="text-sm text-muted-foreground">
              O plano <strong>{result?.name}</strong> agora está disponível na sua conta.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-4" />
            <h1 className="font-bold text-foreground mb-1">Convite inválido</h1>
            <p className="text-sm text-muted-foreground mb-4">
              {error === 'INVITE_EXPIRED' ? 'Este convite expirou.' : 'O link não é válido ou já foi usado.'}
            </p>
            <button onClick={() => navigate('/app/dashboard')}
              className="text-xs font-semibold px-4 py-2 bg-[#2563EB] text-white rounded-xl">
              Voltar ao painel
            </button>
          </>
        )}
      </div>
    </div>
  );
}