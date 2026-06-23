// SubscriptionHealthBar — barra horizontal de saúde da base (pagantes / trial / inadimplentes / cancelados).
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

export default function SubscriptionHealthBar({ revenue, churn }) {
  const navigate = useNavigate();
  const items = [
    { key: 'paying',   label: 'Pagantes',      count: churn?.paying_now,   icon: CheckCircle2, color: 'emerald', amount: revenue?.mrr },
    { key: 'trialing', label: 'Em trial',      count: null,                icon: Clock,        color: 'amber',   amount: revenue?.mrr_trialing },
    { key: 'past_due', label: 'Inadimplentes', count: churn?.past_due,     icon: AlertTriangle, color: 'rose',   amount: revenue?.mrr_past_due },
    { key: 'canceled', label: 'Cancelados 30d', count: churn?.canceled_30d, icon: XCircle,      color: 'gray',    amount: churn?.lost_mrr_30d },
  ];
  const total = items.reduce((s, it) => s + (it.amount || 0), 0);

  const COLORS = {
    emerald: 'bg-emerald-500',
    amber:   'bg-amber-500',
    rose:    'bg-red-500',
    gray:    'bg-gray-400',
  };
  const RING = {
    emerald: 'bg-emerald-50 ring-emerald-100 text-emerald-700',
    amber:   'bg-amber-50 ring-amber-100 text-amber-700',
    rose:    'bg-red-50 ring-red-100 text-red-700',
    gray:    'bg-gray-100 ring-gray-200 text-gray-700',
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-foreground text-lg tracking-tight">Saúde da base</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Distribuição de status financeiro</p>
        </div>
        <button onClick={() => navigate('/master/barbearias')}
          className="text-xs font-semibold text-[#2563EB] hover:underline">
          Ver todas →
        </button>
      </div>

      {total > 0 && (
        <div className="flex h-2.5 rounded-full overflow-hidden bg-muted/40 mb-4">
          {items.map(it => {
            const pct = total > 0 ? ((it.amount || 0) / total) * 100 : 0;
            if (pct === 0) return null;
            return <div key={it.key} style={{ width: `${pct}%` }} className={COLORS[it.color]} title={`${it.label}: ${fmtMoney(it.amount)}`} />;
          })}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(it => {
          const Icon = it.icon;
          return (
            <div key={it.key} className="bg-muted/40 rounded-xl p-3 border border-border">
              <div className={`w-8 h-8 rounded-lg ring-1 flex items-center justify-center mb-2 ${RING[it.color]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-base font-black text-foreground tracking-tight">{fmtMoney(it.amount)}</div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
                {it.label} {it.count != null ? `· ${it.count}` : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}