// Widget de saúde da empresa — mostra activation score, status e próxima ação recomendada.
// Score calculado SOMENTE no backend via getActivationScore.
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle2, ArrowRight } from 'lucide-react';

const STATUS_STYLE = {
  INACTIVE: { color: 'text-red-600', bg: 'bg-red-50', label: 'Inativa' },
  ACTIVATING: { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Ativando' },
  ACTIVE: { color: 'text-green-600', bg: 'bg-green-50', label: 'Ativa' },
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
      <div className="bg-white rounded-2xl border border-black/8 p-5 flex items-center justify-center min-h-[140px]">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }
  if (!data) return null;

  const style = STATUS_STYLE[data.status] || STATUS_STYLE.INACTIVE;
  const next = data.next_recommended_action;
  const fullyActive = data.status === 'ACTIVE' && !next;

  return (
    <div className="bg-white rounded-2xl border border-black/8 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Saúde da conta</div>
          <div className="text-3xl font-black text-[#0F172A]">{data.score}<span className="text-sm font-medium text-gray-400">/100</span></div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${style.bg} ${style.color}`}>
          {style.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-[#2563EB] to-[#60A5FA] transition-all"
          style={{ width: `${data.score}%` }}
        />
      </div>

      {fullyActive ? (
        <div className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4" />
          <span>Sua conta está totalmente ativa 🎉</span>
        </div>
      ) : next ? (
        <Link
          to={next.href}
          className="flex items-center justify-between gap-2 bg-[#2563EB]/5 hover:bg-[#2563EB]/10 transition-colors rounded-xl p-3 group"
        >
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-[#2563EB] uppercase tracking-wide mb-0.5">Próximo passo</div>
            <div className="text-sm font-semibold text-[#0F172A] truncate">{next.text}</div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#2563EB] group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
        </Link>
      ) : null}
    </div>
  );
}