// DRE consolidado do período + breakdown de formas de pagamento + ranking.
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

export default function HistoryDreCard({ kpis }) {
  const topPro = kpis.by_professional?.[0];
  const breakdown = Object.entries(kpis.payment_breakdown || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden mb-5">
      <div className="px-5 py-3 border-b border-white/8 bg-white/[0.02] flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold text-white/55">DRE do período</div>
          <div className="text-[11px] text-white/55">Consolidado de todos os caixas fechados</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-white/55 font-bold">Líquido</div>
          <div className={`text-2xl font-black ${kpis.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {kpis.net >= 0 ? '' : '-'}{fmt(Math.abs(kpis.net))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-white/8">
        <div className="p-5 space-y-0.5">
          <Row label="Faturamento bruto" icon={TrendingUp}      value={fmt(kpis.gross_in)}        color="text-emerald-300" />
          <Row label="Suprimentos"        icon={ArrowDownToLine} value={`+${fmt(kpis.total_suprimento)}`} color="text-[#93C5FD]" />
          <Row label="Saídas"             icon={TrendingDown}    value={`-${fmt(kpis.total_out)}`} color="text-rose-300" />
          <Row label="Sangrias"           icon={ArrowUpFromLine} value={`-${fmt(kpis.total_sangria)}`} color="text-orange-300" />
          <div className="border-t border-dashed border-white/10 my-2"></div>
          <Row label="Atendimentos" icon={Receipt} value={kpis.appointment_count} />
          <Row label="Ticket médio" value={fmt(kpis.ticket_avg)} />
          {(kpis.diff_total !== 0 || kpis.diff_positive !== 0 || kpis.diff_negative !== 0) && (
            <>
              <div className="border-t border-dashed border-white/10 my-2"></div>
              <Row label="Sobras" value={`+${fmt(kpis.diff_positive)}`} color="text-emerald-300" />
              <Row label="Faltas" value={fmt(kpis.diff_negative)} color="text-rose-300" />
            </>
          )}
          {topPro && (
            <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-amber-400/[0.08] border border-amber-400/25">
              <Crown className="w-4 h-4 text-amber-300 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-amber-200">Top barbeiro do período</div>
                <div className="text-sm font-bold text-white truncate">{topPro.professional_name}</div>
              </div>
              <div className="text-sm font-black text-amber-200">{fmt(topPro.revenue)}</div>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-white/55 mb-2">Entradas por forma de pagamento</div>
          {breakdown.length === 0 ? (
            <div className="text-xs text-white/55 py-4 text-center">Nenhuma entrada no período.</div>
          ) : (
            <div className="space-y-1.5">
              {breakdown.map(([method, amount]) => {
                const pct = kpis.gross_in > 0 ? (amount / kpis.gross_in) * 100 : 0;
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