// RevenueByPlan — breakdown do MRR por plano com barra de proporção.
import { CreditCard } from 'lucide-react';

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const PLAN_COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2'];

export default function RevenueByPlan({ breakdown = [], totalMrr = 0 }) {
  if (breakdown.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-[var(--shadow-sm)]">
        <CreditCard className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        <div className="text-sm font-semibold text-foreground">Sem receita ativa</div>
        <div className="text-xs text-muted-foreground mt-1">Nenhuma empresa pagante registrada.</div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-foreground text-lg tracking-tight">Receita por plano</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Distribuição do MRR entre planos ativos</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total MRR</div>
          <div className="text-base font-black text-foreground">{fmtMoney(totalMrr)}</div>
        </div>
      </div>

      {/* Barra empilhada */}
      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted/40 mb-4">
        {breakdown.map((b, i) => {
          const pct = totalMrr > 0 ? (b.mrr / totalMrr) * 100 : 0;
          return (
            <div
              key={b.plan_name}
              style={{ width: `${pct}%`, background: PLAN_COLORS[i % PLAN_COLORS.length] }}
              title={`${b.plan_name}: ${fmtMoney(b.mrr)}`}
            />
          );
        })}
      </div>

      <div className="space-y-2">
        {breakdown.map((b, i) => {
          const pct = totalMrr > 0 ? (b.mrr / totalMrr) * 100 : 0;
          return (
            <div key={b.plan_name} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                <div className="min-w-0">
                  <div className="font-bold text-sm text-foreground truncate">{b.plan_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {b.count} {b.count === 1 ? 'empresa' : 'empresas'} · {fmtMoney(b.price)}/mês
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-black text-foreground tracking-tight">{fmtMoney(b.mrr)}</div>
                <div className="text-[11px] font-semibold text-muted-foreground">{pct.toFixed(0)}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}