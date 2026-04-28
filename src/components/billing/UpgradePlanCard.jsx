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
      <div className="bg-white rounded-2xl border border-black/8 p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (plans.length === 0) return null;

  return (
    <div className={`rounded-2xl p-5 sm:p-6 ${highlight ? 'border-2 border-[#2563EB] bg-[#2563EB]/5' : 'bg-white border border-black/8'}`}>
      <div className="flex items-center gap-2 mb-3">
        <ArrowUpCircle className="w-5 h-5 text-[#2563EB]" />
        <h2 className="font-bold text-[#0F172A]">{highlight ? 'Faça upgrade para liberar' : 'Outros planos'}</h2>
      </div>
      {highlight && (
        <p className="text-sm text-gray-600 mb-4">
          Esta funcionalidade não está incluída no seu plano atual. Escolha um plano superior para continuar.
        </p>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg mb-3">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-3 rounded-lg mb-3">{success}</div>}

      <div className="grid sm:grid-cols-2 gap-3">
        {plans.map(p => {
          const isCurrent = p.id === currentPlanId;
          return (
            <div key={p.id} className={`border rounded-xl p-4 ${isCurrent ? 'border-[#2563EB] bg-[#2563EB]/5' : 'border-black/10 bg-white'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-[#0F172A]">{p.name}</div>
                {isCurrent && <span className="text-[10px] font-bold bg-[#2563EB] text-white px-2 py-0.5 rounded-full">ATUAL</span>}
              </div>
              <div className="text-2xl font-black text-[#0F172A] mb-3">
                R$ {Number(p.price_monthly || 0).toFixed(0)}
                <span className="text-sm font-medium text-gray-400">/mês</span>
              </div>
              {Array.isArray(p.features) && p.features.length > 0 && (
                <ul className="space-y-1 mb-4">
                  {p.features.slice(0, 5).map(f => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Check className="w-3 h-3 text-green-600 flex-shrink-0" />
                      <span className="capitalize">{f.replace(/_/g, ' ')}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => { setError(''); setSuccess(''); upgradeMutation.mutate(p.id); }}
                disabled={isCurrent || upgradeMutation.isPending}
                className="w-full bg-[#2563EB] text-white font-bold py-2 rounded-lg text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1d4ed8]"
              >
                {isCurrent ? 'Plano atual' : (upgradeMutation.isPending && upgradeMutation.variables === p.id ? 'Aplicando...' : 'Selecionar')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}