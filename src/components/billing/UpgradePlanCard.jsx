// Card de upgrade exibido quando o usuário foi redirecionado por feature gating
// (?upgrade=1) ou quer ver outros planos disponíveis e assinar via Asaas (Modelo A).
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, ArrowUpCircle, Check, Zap } from 'lucide-react';
import { filterPlansVisibleToCompany } from '@/lib/planVisibility';
import SaasPaymentModal from './SaasPaymentModal';

export default function UpgradePlanCard({ currentPlanId, companyId, highlight = false }) {
  const [cycle, setCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState(null);

  const { data: rawPlans = [], isLoading } = useQuery({
    queryKey: ['plans-list', companyId || 'no-company'],
    queryFn: () => base44.entities.Plan.filter({ active: true }, 'sort_order', 50),
    staleTime: 5 * 60_000,
  });

  const plans = filterPlansVisibleToCompany(rawPlans, companyId);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-white/40" />
      </div>
    );
  }

  if (plans.length === 0) return null;

  return (
    <div className={`relative rounded-3xl p-5 sm:p-7 backdrop-blur-xl overflow-hidden ${
      highlight
        ? 'border-2 border-blue-400/40 bg-blue-500/10 shadow-[0_8px_32px_rgba(37,99,235,0.25)]'
        : 'border border-white/10 bg-[#0B1020]/80 shadow-[0_8px_24px_rgba(0,0,0,0.35)]'
    }`}>
      {highlight && (
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-[#60A5FA]/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      )}
      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-blue-400">
              <ArrowUpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">
                {highlight ? 'Faça upgrade para liberar todos os recursos' : 'Planos de Assinatura O CORTE'}
              </h2>
              <p className="text-xs text-white/55 mt-0.5">
                Escolha o plano ideal para a sua barbearia e pague com Pix ou Cartão via Asaas.
              </p>
            </div>
          </div>

          {/* Toggle Mensal / Anual */}
          <div className="flex items-center p-1 rounded-2xl bg-white/[0.04] border border-white/10 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setCycle('monthly')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                cycle === 'monthly'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setCycle('yearly')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                cycle === 'yearly'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <span>Anual</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded-full font-black">
                20% OFF
              </span>
            </button>
          </div>
        </div>

        {highlight && (
          <p className="text-sm text-white/70 mb-4 bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl">
            Esta funcionalidade não está incluída no seu plano atual. Escolha um plano abaixo para liberar imediatamente.
          </p>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isCurrent = p.id === currentPlanId;
            const basePrice = Number(p.price_monthly || p.price || 0);
            const displayPrice = cycle === 'yearly' ? Math.round(basePrice * 0.8) : basePrice;

            return (
              <div
                key={p.id}
                className={`border rounded-2xl p-5 transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'border-blue-400/40 bg-blue-500/10 ring-1 ring-blue-400/20'
                    : 'border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.04]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-white text-base">{p.name}</div>
                    {isCurrent && (
                      <span className="text-[10px] font-bold bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white px-2.5 py-0.5 rounded-full ring-1 ring-white/15">
                        PLANO ATUAL
                      </span>
                    )}
                  </div>

                  <div className="text-3xl font-black text-white mb-1">
                    R$ {displayPrice}
                    <span className="text-xs font-medium text-white/40 ml-1">/mês</span>
                  </div>

                  {cycle === 'yearly' && (
                    <div className="text-[11px] text-emerald-400 font-medium mb-3">
                      Cobrado anualmente (R$ {displayPrice * 12}/ano)
                    </div>
                  )}

                  {Array.isArray(p.features) && p.features.length > 0 && (
                    <ul className="space-y-1.5 my-4">
                      {p.features.slice(0, 6).map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-white/70">
                          <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span className="capitalize">{f.replace(/_/g, ' ')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPlanForPayment(p)}
                  disabled={isCurrent}
                  className="w-full mt-4 bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white font-bold py-2.5 rounded-xl text-xs ring-1 ring-white/15 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all shadow-[0_4px_12px_rgba(37,99,235,0.35)] cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isCurrent ? 'Seu Plano Atual' : `Assinar ${p.name}`}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Pagamento SaaS com Pix / Cartão via Master Asaas */}
      {selectedPlanForPayment && (
        <SaasPaymentModal
          isOpen={!!selectedPlanForPayment}
          onClose={() => setSelectedPlanForPayment(null)}
          plan={selectedPlanForPayment}
          cycle={cycle}
          companyId={companyId}
          onSuccess={() => {
            setTimeout(() => window.location.reload(), 1000);
          }}
        />
      )}
    </div>
  );
}