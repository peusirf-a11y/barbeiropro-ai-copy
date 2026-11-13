// "Últimas indicações" + "Últimas comissões" lado a lado.
import { Link } from 'react-router-dom';
import { ArrowRight, Users, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const safeFmt = (dStr) => {
  if (!dStr) return '—';
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return '—';
  try { return format(d, 'dd MMM yyyy', { locale: ptBR }); } catch { return '—'; }
};

const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');

const REF_STATUS = {
  pending: { label: 'Em avaliação', cls: 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/80 border-[#E5E7EF] dark:border-[#232538]' },
  converted: { label: 'Trial (7 dias)', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
  active: { label: 'Ativa (30%)', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' },
  completed: { label: 'Concluída (12/12)', cls: 'bg-[#2563EB]/10 text-[#2563EB] dark:text-[#93C5FD] border-[#2563EB]/20' },
  cancelled: { label: 'Cancelada', cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20' },
  fraud: { label: 'Irregular', cls: 'bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500/30' },
};

const COMM_STATUS = {
  pending: { label: 'Em Hold (Anti-fraude)', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
  approved: { label: 'A Pagar (Aprovadas)', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' },
  paid: { label: 'Pago via Pix', cls: 'bg-[#2563EB]/10 text-[#2563EB] dark:text-[#93C5FD] border-[#2563EB]/20' },
  cancelled: { label: 'Cancelado', cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20' },
};

function Card({ title, icon: Icon, link, linkLabel, children, empty, emptyMessage }) {
  return (
    <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#2563EB] dark:text-[#93C5FD]" strokeWidth={1.75} />
          <h3 className="text-sm font-bold text-[#171827] dark:text-white">{title}</h3>
        </div>
        <Link to={link} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] dark:text-[#93C5FD] hover:underline">
          {linkLabel} <ArrowRight className="w-3 h-3" strokeWidth={1.75} />
        </Link>
      </div>
      <div className="space-y-1.5">
        {children}
        {empty && (
          <div className="text-center py-6 px-4">
            <p className="text-xs text-[#55596A] dark:text-white/50 leading-relaxed font-medium">
              {emptyMessage || 'Nada por aqui ainda.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PartnerRecentLists({ referrals = [], commissions = [] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card
        title="Últimas indicações"
        icon={Users}
        link="/parceiro/indicacoes"
        linkLabel="Ver todas"
        empty={referrals.length === 0}
        emptyMessage="Nenhuma indicação cadastrada ainda. Compartilhe seu link para começar!"
      >
        {referrals.map((r) => {
          const s = REF_STATUS[r.status] || REF_STATUS.pending;
          return (
            <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-[#E5E7EF] dark:border-[#232538]">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[#171827] dark:text-white truncate">
                  {r.referred_company_name || r.company_name || <span className="text-slate-400 dark:text-white/40 italic">Pendente</span>}
                </div>
                <div className="text-[10px] text-[#55596A] dark:text-white/45 tabular-nums">
                  {safeFmt(r.created_at || r.created_date)}
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${s.cls}`}>{s.label}</span>
            </div>
          );
        })}
      </Card>

      <Card
        title="Últimas comissões"
        icon={DollarSign}
        link="/parceiro/comissoes"
        linkLabel="Ver todas"
        empty={commissions.length === 0}
        emptyMessage="Nenhuma comissão gerada até o momento."
      >
        {commissions.map((c) => {
          const s = COMM_STATUS[c.status] || COMM_STATUS.pending;
          return (
            <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-[#E5E7EF] dark:border-[#232538]">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[#171827] dark:text-white tabular-nums">
                  {brl(c.amount)} · #{c.billing_cycle || 1}
                </div>
                <div className="text-[10px] text-[#55596A] dark:text-white/45 tabular-nums">
                  {safeFmt(c.created_at || c.created_date)}
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${s.cls}`}>{s.label}</span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}