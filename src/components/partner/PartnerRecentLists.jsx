// "Últimas indicações" + "Últimas comissões" lado a lado.
import { Link } from 'react-router-dom';
import { ArrowRight, Users, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');

const REF_STATUS = {
  pending: { label: 'Clicou', cls: 'bg-white/8 text-white/70 border-white/15' },
  converted: { label: 'Trial', cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  active: { label: 'Pagando', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  cancelled: { label: 'Cancelado', cls: 'bg-rose-500/10 text-rose-200 border-rose-400/25' },
  fraud: { label: 'Fraude', cls: 'bg-rose-500/25 text-rose-200 border-rose-400/45' },
};

const COMM_STATUS = {
  pending: { label: 'Hold', cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  approved: { label: 'Aprovado', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  paid: { label: 'Pago', cls: 'bg-blue-500/15 text-blue-200 border-blue-400/30' },
  cancelled: { label: 'Cancelado', cls: 'bg-rose-500/10 text-rose-200 border-rose-400/25' },
};

function Card({ title, icon: Icon, link, linkLabel, children, empty }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#93C5FD]" />
          <h3 className="text-sm font-bold text-white">{title}</h3>
        </div>
        <Link to={link} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#93C5FD] hover:underline">
          {linkLabel} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-1.5">
        {children}
        {empty && <p className="text-xs text-white/45 text-center py-4">Nada por aqui ainda.</p>}
      </div>
    </div>
  );
}

export default function PartnerRecentLists({ referrals = [], commissions = [] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="Últimas indicações" icon={Users} link="/parceiro/indicacoes" linkLabel="Ver todas" empty={referrals.length === 0}>
        {referrals.map((r) => {
          const s = REF_STATUS[r.status] || REF_STATUS.pending;
          return (
            <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white truncate">
                  {r.referred_company_name || <span className="text-white/40 italic">Pendente</span>}
                </div>
                <div className="text-[10px] text-white/45">
                  {format(new Date(r.created_date), 'dd MMM yyyy', { locale: ptBR })}
                </div>
              </div>
              <span className={`ds-badge ${s.cls}`}>{s.label}</span>
            </div>
          );
        })}
      </Card>

      <Card title="Últimas comissões" icon={DollarSign} link="/parceiro/comissoes" linkLabel="Ver todas" empty={commissions.length === 0}>
        {commissions.map((c) => {
          const s = COMM_STATUS[c.status] || COMM_STATUS.pending;
          return (
            <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white">{brl(c.amount)} · #{c.billing_cycle}</div>
                <div className="text-[10px] text-white/45">
                  {format(new Date(c.created_date), 'dd MMM yyyy', { locale: ptBR })}
                </div>
              </div>
              <span className={`ds-badge ${s.cls}`}>{s.label}</span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}