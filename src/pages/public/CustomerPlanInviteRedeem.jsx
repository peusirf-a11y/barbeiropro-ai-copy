// Página pública de redenção de invite token de CUSTOMER PLAN (cliente assinando plano da barbearia).
// URL: /cliente/:slug/planos/convite/:token
//
// Fluxo:
//   1) Resolve company por slug
//   2) Se cliente não logado → redireciona pra /cliente/:slug/login com next
//   3) Chama validatePlanInvite(kind='customer', token, customer_token, slug)
//   4) Em sucesso → /cliente/:slug/planos com flash "plano liberado"
//
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function CustomerPlanInviteRedeem() {
  const { slug, token } = useParams();
  const navigate = useNavigate();

  const { data: companies = [], isLoading: loadingCo } = useQuery({
    queryKey: ['company-by-slug', slug],
    queryFn: () => base44.entities.Company.filter({ slug }),
    enabled: !!slug,
  });
  const company = companies[0];
  const { customer, token: customerToken, loading: loadingAuth } = useCustomerAuth(company?.id);

  const [status, setStatus] = useState('checking');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loadingCo || loadingAuth) return;
    if (!company) { setStatus('error'); setError('COMPANY_NOT_FOUND'); return; }
    if (!customer) {
      navigate(`/cliente/${slug}/login?next=${encodeURIComponent(`/cliente/${slug}/planos/convite/${token}`)}`);
      return;
    }
    if (!token || token.length < 8) { setStatus('error'); setError('INVALID_INVITE'); return; }

    (async () => {
      try {
        const res = await base44.functions.invoke('validatePlanInvite', {
          kind: 'customer', token, customer_token: customerToken, slug,
        });
        if (res?.data?.success) {
          setResult(res.data.plan);
          setStatus('success');
          setTimeout(() => navigate(`/cliente/${slug}/planos?invite=ok`), 1800);
        } else {
          setError(res?.data?.error || 'INVALID_INVITE');
          setStatus('error');
        }
      } catch (e) {
        setError(e?.response?.data?.error || 'INVALID_INVITE');
        setStatus('error');
      }
    })();
  }, [company, customer, customerToken, loadingCo, loadingAuth, navigate, slug, token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F1F2F7] dark:bg-[#050816] transition-colors">
      <div className="max-w-sm w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 backdrop-blur-xl rounded-2xl p-8 text-center shadow-sm dark:shadow-none">
        {status === 'checking' && (
          <>
            <Loader2 className="w-8 h-8 text-[#2563EB] dark:text-[#60A5FA] animate-spin mx-auto mb-4" />
            <h1 className="font-bold text-slate-900 dark:text-white mb-1">Validando convite…</h1>
            <p className="text-sm text-slate-600 dark:text-white/55">Aguarde um instante.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto mb-4" />
            <h1 className="font-bold text-slate-900 dark:text-white mb-1">Convite validado!</h1>
            <p className="text-sm text-slate-600 dark:text-white/55">
              O plano <strong className="text-slate-900 dark:text-white">{result?.name}</strong> está disponível para você.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-10 h-10 text-rose-600 dark:text-rose-400 mx-auto mb-4" />
            <h1 className="font-bold text-slate-900 dark:text-white mb-1">Convite inválido</h1>
            <p className="text-sm text-slate-600 dark:text-white/55 mb-4">
              {error === 'INVITE_EXPIRED' ? 'Este convite expirou.' :
               error === 'COMPANY_NOT_FOUND' ? 'Barbearia não encontrada.' :
               'O link não é válido ou já foi usado.'}
            </p>
            <button onClick={() => navigate(`/cliente/${slug}/planos`)}
              className="text-xs font-semibold px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl transition-colors cursor-pointer">
              Ver planos disponíveis
            </button>
          </>
        )}
      </div>
    </div>
  );
}