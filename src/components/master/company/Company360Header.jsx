// Company360Header — header rico da empresa com badges de status + KPIs em destaque.
import { Mail, Globe, Building2, Calendar, Users, CalendarCheck, DollarSign, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig = {
  active:   { label: 'Ativa',     color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  trial:    { label: 'Trial',     color: 'bg-amber-50 text-amber-700 border-amber-200' },
  inactive: { label: 'Inativa',   color: 'bg-gray-100 text-gray-600 border-gray-200' },
  blocked:  { label: 'Bloqueada', color: 'bg-red-50 text-red-700 border-red-200' },
};

const subStatusConfig = {
  active:     { label: 'Pagando',      color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  trialing:   { label: 'Em trial',     color: 'bg-amber-50 text-amber-700 border-amber-200' },
  past_due:   { label: 'Inadimplente', color: 'bg-red-50 text-red-700 border-red-200' },
  canceled:   { label: 'Cancelada',    color: 'bg-gray-100 text-gray-600 border-gray-200' },
  incomplete: { label: 'Incompleta',   color: 'bg-amber-50 text-amber-700 border-amber-200' },
  unpaid:     { label: 'Não paga',     color: 'bg-red-50 text-red-700 border-red-200' },
};

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const fmtNumber = (v) => Number(v || 0).toLocaleString('pt-BR');

export default function Company360Header({ company, plan, counters, financial, lastActivity }) {
  const statusInfo = statusConfig[company.status] || statusConfig.active;
  const subStatusInfo = company.subscription_status ? subStatusConfig[company.subscription_status] : null;

  const kpis = [
    { icon: Users, label: 'Clientes', value: fmtNumber(counters?.total_customers) },
    { icon: CalendarCheck, label: 'Agendamentos', value: fmtNumber(counters?.total_appointments) },
    { icon: DollarSign, label: 'Receita gerada', value: fmtMoney(financial?.generated_revenue) },
    { icon: Clock, label: 'Receita 30d', value: fmtMoney(financial?.revenue_30d) },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-white shadow-[0_8px_24px_rgba(37,99,235,0.3)] flex-shrink-0">
          {company.logo_url ? (
            <img src={company.logo_url} alt="" className="w-full h-full object-cover rounded-2xl" />
          ) : (
            <Building2 className="w-6 h-6" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black text-foreground tracking-tight">{company.name}</h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {subStatusInfo && (
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${subStatusInfo.color}`}>
                {subStatusInfo.label}
              </span>
            )}
            <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
              {plan?.name || company.plan_name || 'Starter'}
              {plan?.price_monthly ? ` · ${fmtMoney(plan.price_monthly)}/mês` : ''}
            </span>
            {company.owner_email && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Mail className="w-3 h-3" /> {company.owner_email}
              </span>
            )}
            {company.slug && (
              <a href={`/agendar/${company.slug}`} target="_blank" rel="noreferrer" className="text-xs text-[#2563EB] hover:underline inline-flex items-center gap-1">
                <Globe className="w-3 h-3" /> /agendar/{company.slug}
              </a>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground font-medium flex-wrap">
            {company.created_date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Desde {format(new Date(company.created_date), "d 'de' MMM yyyy", { locale: ptBR })}
              </span>
            )}
            {lastActivity && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> Última atividade {format(new Date(lastActivity), "d/MM 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-muted/40 rounded-xl p-3 border border-border">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                <Icon className="w-3 h-3" /> {k.label}
              </div>
              <div className="text-lg font-black text-foreground tracking-tight">{k.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}