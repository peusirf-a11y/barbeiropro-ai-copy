// DRE operacional do dia — resumo financeiro inteligente do caixa aberto.
// Design System: Premium Business SaaS & Business Intelligence
import { Crown, Receipt, TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { getPaymentMethodLabel, getPaymentMethodIcon } from '@/lib/cashRegister';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

function Row({ label, value, color, icon: Icon }) {
  return (
    <div className="flex items-center justify-between text-sm py-2 border-b border-[#F1F2F7] dark:border-[#232538]/50 last:border-0">
      <span className="flex items-center gap-2 text-[#55596A] dark:text-[#8F9BBF] font-medium text-xs sm:text-sm">
        {Icon && <Icon className="w-4 h-4 text-[#59658F] dark:text-[#8F9BBF]" strokeWidth={1.75} />}
        {label}
      </span>
      <span className={`font-bold tabular-nums text-xs sm:text-sm ${color || 'text-[#171827] dark:text-white'}`}>{value}</span>
    </div>
  );
}

export default function CaixaDreCard({ dre }) {
  if (!dre) return null;
  const topPro = dre.by_professional?.[0];
  const breakdownEntries = Object.entries(dre.payment_breakdown || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] shadow-sm overflow-hidden mb-5">
      <div className="px-5 py-3.5 border-b border-[#E5E7EF] dark:border-[#232538] bg-[#F8FAFC] dark:bg-[#1C1E30] flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold text-[#59658F] dark:text-[#8F9BBF]">DRE Operacional do Dia</div>
          <div className="text-xs text-[#55596A] dark:text-[#8F9BBF] font-medium">Balanço consolidado de receitas e despesas</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-[#59658F] dark:text-[#8F9BBF] font-bold">Resultado Líquido</div>
          <div className={`text-2xl font-black tabular-nums ${dre.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {dre.net >= 0 ? '' : '-'}{fmt(Math.abs(dre.net))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-[#E5E7EF] dark:divide-[#232538]">
        {/* Coluna 1 — linhas do DRE */}
        <div className="p-5 space-y-0.5">
          <Row label="Faturamento bruto" icon={TrendingUp} value={fmt(dre.gross_in)} color="text-emerald-600 dark:text-emerald-400" />
          <Row label="Suprimentos" icon={ArrowDownToLine} value={`+${fmt(dre.total_suprimento)}`} color="text-[#2563EB] dark:text-blue-400" />
          <Row label="Saídas operacionais" icon={TrendingDown} value={`-${fmt(dre.total_out)}`} color="text-rose-600 dark:text-rose-400" />
          <Row label="Sangrias de caixa" icon={ArrowUpFromLine} value={`-${fmt(dre.total_sangria)}`} color="text-amber-600 dark:text-amber-400" />
          <div className="border-t border-[#E5E7EF] dark:border-[#232538] my-2" />
          <Row label="Atendimentos faturados" icon={Receipt} value={dre.appointment_count} />
          <Row label="Ticket médio" value={fmt(dre.ticket_avg)} />
          {topPro && (
            <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
                <Crown className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400">Destaque de Faturamento</div>
                <div className="text-sm font-bold text-[#171827] dark:text-white truncate">{topPro.professional_name}</div>
              </div>
              <div className="text-sm font-black text-amber-700 dark:text-amber-300 tabular-nums">{fmt(topPro.revenue)}</div>
            </div>
          )}
        </div>

        {/* Coluna 2 — breakdown por método */}
        <div className="p-5">
          <div className="text-[11px] uppercase tracking-wider font-bold text-[#59658F] dark:text-[#8F9BBF] mb-3">Entradas por forma de pagamento</div>
          {breakdownEntries.length === 0 ? (
            <div className="text-xs text-[#55596A] dark:text-[#8F9BBF] py-8 text-center font-medium">Nenhuma entrada com forma de pagamento registrada ainda.</div>
          ) : (
            <div className="space-y-3">
              {breakdownEntries.map(([method, amount]) => {
                const pct = dre.gross_in > 0 ? (amount / dre.gross_in) * 100 : 0;
                return (
                  <div key={method}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[#171827] dark:text-white font-semibold flex items-center gap-1.5">
                        <span className="text-sm">{getPaymentMethodIcon(method)}</span>
                        <span>{getPaymentMethodLabel(method)}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#55596A] dark:text-[#8F9BBF] tabular-nums font-medium">
                          {pct.toFixed(0)}%
                        </span>
                        <span className="font-bold text-[#171827] dark:text-white tabular-nums">{fmt(amount)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-[#F1F2F7] dark:bg-[#232538] rounded-full overflow-hidden">
                      <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}