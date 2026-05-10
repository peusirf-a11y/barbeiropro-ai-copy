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
        <Kpi icon={Send} label="Mensagens enviadas" value={sent + simulated} sub={simulated > 0 ? `${simulated} em modo teste` : null} color="text-[#2563EB]" />
        <Kpi icon={CheckCircle} label="Clientes recuperados" value={recoveredCount} sub={`${recoveryRate}% taxa de retorno`} color="text-emerald-600" />
        <Kpi icon={MessageSquare} label="Total de envios" value={messages.length} color="text-gray-700" />
        <Kpi icon={AlertCircle} label="Falhas" value={errors} color="text-red-500" />
      </div>

      <RetentionCampaignsCard companyId={companyId} customers={customers} />

      {/* Atalhos para segmentos críticos */}
      <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-[var(--shadow-sm)]">
        <h3 className="font-bold text-[#111827] mb-4">Quem precisa de atenção agora</h3>
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

function Kpi({ icon: Icon, label, value, sub, color = 'text-gray-700' }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-4 sm:p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[11px] text-[#6B7280] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-black text-[#111827] tracking-tight">{value}</div>
      {sub && <div className="text-xs text-[#6B7280] mt-1">{sub}</div>}
    </div>
  );
}

const ACCENT = {
  amber:  { bg: 'bg-amber-50',  ring: 'border-amber-200',  text: 'text-amber-700',  num: 'text-amber-600' },
  orange: { bg: 'bg-orange-50', ring: 'border-orange-200', text: 'text-orange-700', num: 'text-orange-600' },
  red:    { bg: 'bg-red-50',    ring: 'border-red-200',    text: 'text-red-700',    num: 'text-red-600' },
  violet: { bg: 'bg-violet-50', ring: 'border-violet-200', text: 'text-violet-700', num: 'text-violet-600' },
};

function SegmentCard({ label, count, accent, filter }) {
  const a = ACCENT[accent];
  return (
    <Link
      to={`/app/clientes?filter=${filter}`}
      className={`${a.bg} border ${a.ring} rounded-xl p-4 hover:-translate-y-0.5 transition-all duration-200 block group`}
    >
      <div className={`text-3xl font-black ${a.num} leading-none`}>{count}</div>
      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs font-bold ${a.text} uppercase tracking-wider`}>{label}</span>
        <ArrowRight className={`w-3 h-3 ${a.text} group-hover:translate-x-0.5 transition-transform`} />
      </div>
    </Link>
  );
}