// ActivationHealthCard.jsx — Widget de Saúde e Ativação Corporativa da Barbearia
// Superfície: #FFFFFF | Borda: #E5E7EF | Tipografia: tabular-nums | Ícones: Lucide strokeWidth=1.75
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';

const STATUS_STYLE = {
  INACTIVE: { color: 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/40', label: 'Inativa' },
  ACTIVATING: { color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40', label: 'Em Ativação' },
  ACTIVE: { color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40', label: 'Ativa' },
};

export default function ActivationHealthCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['activation-score'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getActivationScore', {});
      return res?.data?.success ? res.data : null;
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="bg-[#FFFFFF] dark:bg-[#171827] rounded-2xl border border-[#E5E7EF] dark:border-[#232538] p-5 flex items-center justify-center min-h-[140px] shadow-sm">
        <Loader2 className="w-5 h-5 text-[#59658F] animate-spin" strokeWidth={1.75} />
      </div>
    );
  }
  if (!data) return null;

  const style = STATUS_STYLE[data.status] || STATUS_STYLE.INACTIVE;
  const next = data.next_recommended_action;
  const fullyActive = data.status === 'ACTIVE' && !next;

  if (fullyActive && data.score >= 100) return null;

  return (
    <div className="bg-[#FFFFFF] dark:bg-[#171827] rounded-2xl border border-[#E5E7EF] dark:border-[#232538] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#55596A] dark:text-[#8F9BBF] uppercase tracking-wider mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" strokeWidth={1.75} />
            <span>Saúde Operacional da Unidade</span>
          </div>
          <div className="text-3xl font-black text-[#171827] dark:text-white tabular-nums">
            {data.score}
            <span className="text-sm font-semibold text-[#59658F] dark:text-[#7E8BAF]">/100</span>
          </div>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${style.color}`}>
          {style.label}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="h-2 bg-[#F1F2F7] dark:bg-[#232538] rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-[#2563EB] to-[#60A5FA] transition-all rounded-full"
          style={{ width: `${data.score}%` }}
        />
      </div>

      {fullyActive ? (
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />
          <span>Configuração completa. A unidade está 100% pronta para agendamentos e faturamento.</span>
        </div>
      ) : next ? (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E5E7EF] dark:border-[#232538]">
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-bold text-[#59658F] dark:text-[#7E8BAF]">Próximo passo recomendado</div>
            <div className="text-xs font-bold text-[#171827] dark:text-white truncate mt-0.5">{next.title}</div>
            <div className="text-[11px] text-[#55596A] dark:text-[#8F9BBF] truncate">{next.description}</div>
          </div>
          <Link
            to={next.action_url}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 hover:bg-[#DBEAFE] border border-[#DBEAFE] dark:border-blue-800/40 text-xs font-bold transition-colors"
          >
            <span>{next.action_label}</span>
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
          </Link>
        </div>
      ) : null}
    </div>
  );
}