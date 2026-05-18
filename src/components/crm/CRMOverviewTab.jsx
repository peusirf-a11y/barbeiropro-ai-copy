// Aba "Visão geral" da Central de CRM.
// Combina KPIs principais + RetentionCampaignsCard (já existente) + atalhos
// pros segmentos críticos (em risco, inativos, VIPs em risco).

import { Send, CheckCircle, AlertCircle, MessageSquare, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import RetentionCampaignsCard from '@/components/dashboard/RetentionCampaignsCard';

export default function CRMOverviewTab({ companyId, customers, messages }) {
  // KPIs (últimos envios)
  const sent = messages.filter(m => m.status === 'enviado').length;
  const simulated = messages.filter(m => m.status === 'simulado').length;
  const errors = messages.filter(m => m.status === 'erro').length;

  const reactivationMsgs = messages.filter(m => m.type === 'reativacao' && m.status !== 'erro');
  const recoveredCustomerIds = new Set();
  reactivationMsgs.forEach(rm => {
    const c = customers.find(c => c.id === rm.customer_id);
    if (c?.last_appointment_at && rm.sent_at && new Date(c.last_appointment_at) > new Date(rm.sent_at)) {
      recoveredCustomerIds.add(c.id);
    }
  });
  const recoveredCount = recoveredCustomerIds.size;
  const uniqueRecipients = new Set(reactivationMsgs.map(m => m.customer_id)).size;
  const recoveryRate = uniqueRecipients > 0 ? Math.round((recoveredCount / uniqueRecipients) * 100) : 0;

  // Lifecycle counts
  const counts = customers.reduce((acc, c) => {
    const lc = c.lifecycle_status || 'primeira_visita';
    acc[lc] = (acc[lc] || 0) + 1;
    if (c.status === 'vip') acc.vip = (acc.vip || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi icon={Send} label="Mensagens enviadas" value={sent + simulated} sub={simulated > 0 ? `${simulated} em modo teste` : null} color="text-[#93C5FD]" />
        <Kpi icon={CheckCircle} label="Clientes recuperados" value={recoveredCount} sub={`${recoveryRate}% taxa de retorno`} color="text-emerald-300" />
        <Kpi icon={MessageSquare} label="Total de envios" value={messages.length} color="text-white/70" />
        <Kpi icon={AlertCircle} label="Falhas" value={errors} color="text-rose-300" />
      </div>

      <RetentionCampaignsCard companyId={companyId} customers={customers} />

      {/* Atalhos para segmentos críticos */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5">
        <h3 className="font-bold text-white mb-4">Quem precisa de atenção agora</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SegmentCard label="Em risco" count={counts.em_risco || 0} accent="amber" filter="em_risco" />
          <SegmentCard label="Inativos" count={counts.inativo || 0} accent="orange" filter="inativo" />
          <SegmentCard label="Perdidos" count={counts.perdido || 0} accent="red" filter="perdido" />
          <SegmentCard label="VIPs ativos" count={counts.vip || 0} accent="violet" filter="vip" />
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, color = 'text-white/70' }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-4 sm:p-5 hover:border-blue-400/25 hover:bg-white/[0.04] hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[11px] text-white/55 font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">{value}</div>
      {sub && <div className="text-xs text-white/55 mt-1">{sub}</div>}
    </div>
  );
}

const ACCENT = {
  amber:  { bg: 'bg-amber-400/[0.12]',  ring: 'border-amber-400/30',  text: 'text-amber-200',  num: 'text-amber-300' },
  orange: { bg: 'bg-orange-400/[0.12]', ring: 'border-orange-400/30', text: 'text-orange-200', num: 'text-orange-300' },
  red:    { bg: 'bg-rose-400/[0.12]',   ring: 'border-rose-400/30',   text: 'text-rose-200',   num: 'text-rose-300' },
  violet: { bg: 'bg-violet-400/[0.12]', ring: 'border-violet-400/30', text: 'text-violet-200', num: 'text-violet-300' },
};

function SegmentCard({ label, count, accent, filter }) {
  const a = ACCENT[accent];
  return (
    <Link
      to={`/app/clientes?filter=${filter}`}
      className={`${a.bg} border ${a.ring} rounded-xl p-4 hover:-translate-y-0.5 hover:brightness-125 transition-all duration-200 block group backdrop-blur-md`}
    >
      <div className={`text-3xl font-black ${a.num} leading-none`}>{count}</div>
      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs font-bold ${a.text} uppercase tracking-wider`}>{label}</span>
        <ArrowRight className={`w-3 h-3 ${a.text} group-hover:translate-x-0.5 transition-transform`} />
      </div>
    </Link>
  );
}