// DRE operacional do dia — resumo financeiro inteligente do caixa aberto.
// Mostra: bruto, saídas, sangrias, suprimentos, líquido, ticket médio, qtd atendimentos,
// barbeiro top, e breakdown por forma de pagamento.

import { Crown, Receipt, TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { getPaymentMethodLabel, getPaymentMethodIcon } from '@/lib/cashRegister';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

function Row({ label, value, color, icon: Icon }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5">
      <span className="flex items-center gap-1.5 text-white/55">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </span>
      <span className={`font-bold ${color || 'text-white'}`}>{value}</span>
    </div>
  );
}

export default function CaixaDreCard({ dre }) {
  if (!dre) return null;
  const topPro = dre.by_professional?.[0];
  const breakdownEntries = Object.entries(dre.payment_breakdown || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden mb-5">
      <div className="px-5 py-3 border-b border-white/8 bg-white/[0.02] flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold text-white/55">DRE do dia</div>
          <div className="text-[11px] text-white/55">Resumo financeiro do caixa aberto</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-white/55 font-bold">Líquido</div>
          <div className={`text-2xl font-black ${dre.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {dre.net >= 0 ? '' : '-'}{fmt(Math.abs(dre.net))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-white/8">
        {/* Coluna 1 — linhas do DRE */}
        <div className="p-5 space-y-0.5">
          <Row label="Faturamento bruto" icon={TrendingUp}      value={fmt(dre.gross_in)}        color="text-emerald-300" />
          <Row label="Suprimentos"        icon={ArrowDownToLine} value={`+${fmt(dre.total_suprimento)}`} color="text-[#93C5FD]" />
          <Row label="Saídas"             icon={TrendingDown}    value={`-${fmt(dre.total_out)}`}  color="text-rose-300" />
          <Row label="Sangrias"           icon={ArrowUpFromLine} value={`-${fmt(dre.total_sangria)}`} color="text-orange-300" />
          <div className="border-t border-dashed border-white/10 my-2"></div>
          <Row label="Atendimentos pagos" icon={Receipt} value={dre.appointment_count} />
          <Row label="Ticket médio" value={fmt(dre.ticket_avg)} />
          {topPro && (
            <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-amber-400/[0.08] border border-amber-400/25">
              <Crown className="w-4 h-4 text-amber-300 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-amber-200">Top barbeiro</div>
                <div className="text-sm font-bold text-white truncate">{topPro.professional_name}</div>
              </div>
              <div className="text-sm font-black text-amber-200">{fmt(topPro.revenue)}</div>
            </div>
          )}
        </div>

        {/* Coluna 2 — breakdown por método */}
        <div className="p-5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-white/55 mb-2">Entradas por forma de pagamento</div>
          {breakdownEntries.length === 0 ? (
            <div className="text-xs text-white/55 py-4 text-center">Nenhuma entrada com forma de pagamento ainda.</div>
          ) : (
            <div className="space-y-1.5">
              {breakdownEntries.map(([method, amount]) => {
                const pct = dre.gross_in > 0 ? (amount / dre.gross_in) * 100 : 0;
                return (
                  <div key={method}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white/85 font-medium">
                        <span className="mr-1">{getPaymentMethodIcon(method)}</span>
                        {getPaymentMethodLabel(method)}
                      </span>
                      <span className="font-bold text-white">{fmt(amount)}</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#2563EB] to-[#60A5FA] rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
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