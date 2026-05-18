// Card de upgrade exibido quando o usuário foi redirecionado por feature gating
// (?upgrade=1) ou quer ver outros planos disponíveis.
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, ArrowUpCircle, Check } from 'lucide-react';

export default function UpgradePlanCard({ currentPlanId, highlight = false }) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans-list'],
    queryFn: () => base44.entities.Plan.filter({ active: true }, 'sort_order', 20),
    staleTime: 5 * 60_000,
  });

  const upgradeMutation = useMutation({
    mutationFn: (plan_id) => base44.functions.invoke('upgradePlan', { plan_id }),
    onSuccess: (res) => {
      if (res?.data?.success) {
        setSuccess(`Plano alterado para ${res.data.plan?.name}.`);
        setError('');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setError(res?.data?.error || 'Falha ao mudar de plano');
      }
    },
    onError: (err) => setError(err?.response?.data?.error || err.message || 'Erro ao mudar de plano'),
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-white/40" />
      </div>
    );
  }

  if (plans.length === 0) return null;

  return (
    <div className={`relative rounded-2xl p-5 sm:p-6 backdrop-blur-xl overflow-hidden ${highlight ? 'border-2 border-blue-400/40 bg-blue-500/10 shadow-[0_8px_32px_rgba(37,99,235,0.25)]' : 'border border-white/10 bg-white/[0.025] shadow-[0_8px_24px_rgba(0,0,0,0.35)]'}`}>
      {highlight && (
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-[#60A5FA]/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      )}
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <ArrowUpCircle className="w-5 h-5 text-[#60A5FA]" />
          <h2 className="font-bold text-white">{highlight ? 'Faça upgrade para liberar' : 'Outros planos'}</h2>
        </div>
        {highlight && (
          <p className="text-sm text-white/65 mb-4">
            Esta funcionalidade não está incluída no seu plano atual. Escolha um plano superior para continuar.
          </p>
        )}

        {error && <div className="bg-red-400/10 border border-red-400/30 text-red-300 text-xs p-3 rounded-lg mb-3">{error}</div>}
        {success && <div className="bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 text-xs p-3 rounded-lg mb-3">{success}</div>}

        <div className="grid sm:grid-cols-2 gap-3">
          {plans.map(p => {
            const isCurrent = p.id === currentPlanId;
            return (
              <div key={p.id} className={`border rounded-xl p-4 transition-all ${isCurrent ? 'border-blue-400/40 bg-blue-400/10 ring-1 ring-blue-400/20' : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-white">{p.name}</div>
                  {isCurrent && <span className="text-[10px] font-bold bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white px-2 py-0.5 rounded-full ring-1 ring-white/15">ATUAL</span>}
                </div>
                <div className="text-2xl font-black text-white mb-3">
                  R$ {Number(p.price_monthly || 0).toFixed(0)}
                  <span className="text-sm font-medium text-white/40">/mês</span>
                </div>
                {Array.isArray(p.features) && p.features.length > 0 && (
                  <ul className="space-y-1 mb-4">
                    {p.features.slice(0, 5).map(f => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-white/65">
                        <Check className="w-3 h-3 text-emerald-300 flex-shrink-0" />
                        <span className="capitalize">{f.replace(/_/g, ' ')}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={() => { setError(''); setSuccess(''); upgradeMutation.mutate(p.id); }}
                  disabled={isCurrent || upgradeMutation.isPending}
                  className="w-full bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white font-bold py-2 rounded-lg text-xs ring-1 ring-white/15 disabled:opacity-40 disabled:cursor-not-allowed disabled:brightness-75 hover:brightness-110 transition-all shadow-[0_4px_12px_rgba(37,99,235,0.35)]"
                >
                  {isCurrent ? 'Plano atual' : (upgradeMutation.isPending && upgradeMutation.variables === p.id ? 'Aplicando...' : 'Selecionar')}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}