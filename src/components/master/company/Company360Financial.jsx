// Company360Financial — receita gerada, status financeiro, projeções.
import { DollarSign, TrendingUp, Clock, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react';

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const fmtNumber = (v) => Number(v || 0).toLocaleString('pt-BR');

const subStatusInfo = {
  active:     { label: 'Pagando em dia', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50 ring-emerald-100' },
  trialing:   { label: 'Em período de trial', icon: Clock, color: 'text-amber-700 bg-amber-50 ring-amber-100' },
  past_due:   { label: 'Inadimplente', icon: AlertTriangle, color: 'text-red-700 bg-red-50 ring-red-100' },
  canceled:   { label: 'Assinatura cancelada', icon: AlertTriangle, color: 'text-gray-700 bg-gray-100 ring-gray-200' },
  incomplete: { label: 'Pagamento incompleto', icon: AlertTriangle, color: 'text-amber-700 bg-amber-50 ring-amber-100' },
  unpaid:     { label: 'Não paga', icon: AlertTriangle, color: 'text-red-700 bg-red-50 ring-red-100' },
};

export default function Company360Financial({ company, plan, counters, financial }) {
  const status = company.subscription_status ? subStatusInfo[company.subscription_status] : null;
  const StatusIcon = status?.icon;
  const planPrice = plan?.price_monthly || 0;
  const avgTicket = counters?.completed_appointments > 0
    ? financial.generated_revenue / counters.completed_appointments
    : 0;

  return (
    <div className="space-y-4">
      {status && (
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-[var(--shadow-sm)] flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ring-1 ${status.color}`}>
            <StatusIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Status financeiro</div>
            <div className="text-base font-bold text-foreground">{status.label}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Mensalidade</div>
            <div className="text-base font-black text-foreground">{fmtMoney(planPrice)}</div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">Receita gerada pela barbearia</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Receita total" value={fmtMoney(financial?.generated_revenue)} icon={DollarSign} color="emerald" />
          <StatCard label="Receita 30 dias" value={fmtMoney(financial?.revenue_30d)} icon={TrendingUp} color="emerald" />
          <StatCard label="Atendimentos concluídos" value={fmtNumber(counters?.completed_appointments)} icon={CheckCircle2} color="blue" />
          <StatCard label="Ticket médio" value={fmtMoney(avgTicket)} icon={BarChart3} color="violet" />
        </div>
      </div>
    </div>
  );
}

const COLORS = {
  emerald: 'text-emerald-700 bg-emerald-50 ring-emerald-100',
  blue: 'text-[#2563EB] bg-[#EFF6FF] ring-[#DBEAFE]',
  violet: 'text-violet-700 bg-violet-50 ring-violet-100',
};

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 shadow-[var(--shadow-sm)]">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ring-1 ${COLORS[color] || COLORS.blue}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-xl font-black text-foreground tracking-tight leading-none">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1.5">{label}</div>
    </div>
  );
}