// Aba "Visão geral" da Central de CRM & Retenção.
// Combina KPIs principais + RetentionCampaignsCard + atalhos para segmentos críticos
// e acesso direto às Automações / Campanhas de WhatsApp.

import { Send, CheckCircle, AlertCircle, MessageSquare, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import RetentionCampaignsCard from '@/components/dashboard/RetentionCampaignsCard';

export default function CRMOverviewTab({ companyId, customers, messages }) {
  const sent = messages.filter((m) => m.status === 'enviado').length;
  const simulated = messages.filter((m) => m.status === 'simulado').length;
  const errors = messages.filter((m) => m.status === 'erro').length;

  const reactivationMsgs = messages.filter((m) => m.type === 'reativacao' && m.status !== 'erro');
  const recoveredCustomerIds = new Set();
  reactivationMsgs.forEach((rm) => {
    const c = customers.find((c) => c.id === rm.customer_id);
    if (c?.last_appointment_at && rm.sent_at && new Date(c.last_appointment_at) > new Date(rm.sent_at)) {
      recoveredCustomerIds.add(c.id);
    }
  });
  const recoveredCount = recoveredCustomerIds.size;
  const uniqueRecipients = new Set(reactivationMsgs.map((m) => m.customer_id)).size;
  const recoveryRate = uniqueRecipients > 0 ? Math.round((recoveredCount / uniqueRecipients) * 100) : 0;

  const counts = customers.reduce((acc, c) => {
    const lc = c.lifecycle_status || 'primeira_visita';
    acc[lc] = (acc[lc] || 0) + 1;
    if (c.status === 'vip') acc.vip = (acc.vip || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          icon={Send}
          label="Mensagens enviadas"
          value={sent + simulated}
          sub={simulated > 0 ? `${simulated} em modo teste` : null}
          color="text-[#2563EB] dark:text-[#93C5FD]"
        />
        <Kpi
          icon={CheckCircle}
          label="Clientes recuperados"
          value={recoveredCount}
          sub={`${recoveryRate}% taxa de retorno`}
          color="text-emerald-600 dark:text-emerald-300"
        />
        <Kpi
          icon={MessageSquare}
          label="Total de envios"
          value={messages.length}
          color="text-slate-600 dark:text-white/70"
        />
        <Kpi
          icon={AlertCircle}
          label="Falhas"
          value={errors}
          color="text-rose-600 dark:text-rose-300"
        />
      </div>

      <RetentionCampaignsCard companyId={companyId} customers={customers} />

      {/* Atalhos para segmentos críticos */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.025] backdrop-blur-md p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h3 className="font-bold text-slate-900 dark:text-white">Quem precisa de atenção agora</h3>
          <Link
            to="/app/automacoes"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] dark:text-[#93C5FD] hover:underline"
          >
            Configurar campanhas e modelos WhatsApp <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
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

function Kpi({ icon: Icon, label, value, sub, color = 'text-slate-600 dark:text-white/70' }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.025] backdrop-blur-md p-4 sm:p-5 hover:border-blue-300 dark:hover:border-blue-400/25 hover:-translate-y-0.5 transition-all duration-200 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[11px] text-slate-500 dark:text-white/55 font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-slate-500 dark:text-white/55 mt-1">{sub}</div>}
    </div>
  );
}

const ACCENT = {
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-400/[0.12]',
    ring: 'border-amber-200 dark:border-amber-400/30',
    text: 'text-amber-800 dark:text-amber-200',
    num: 'text-amber-700 dark:text-amber-300',
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-400/[0.12]',
    ring: 'border-orange-200 dark:border-orange-400/30',
    text: 'text-orange-800 dark:text-orange-200',
    num: 'text-orange-700 dark:text-orange-300',
  },
  red: {
    bg: 'bg-rose-50 dark:bg-rose-400/[0.12]',
    ring: 'border-rose-200 dark:border-rose-400/30',
    text: 'text-rose-800 dark:text-rose-200',
    num: 'text-rose-700 dark:text-rose-300',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-400/[0.12]',
    ring: 'border-violet-200 dark:border-violet-400/30',
    text: 'text-violet-800 dark:text-violet-200',
    num: 'text-violet-700 dark:text-violet-300',
  },
};

function SegmentCard({ label, count, accent, filter }) {
  const a = ACCENT[accent];
  return (
    <Link
      to={`/app/clientes?filter=${filter}`}
      className={`${a.bg} border ${a.ring} rounded-xl p-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 block group backdrop-blur-md`}
    >
      <div className={`text-3xl font-black ${a.num} leading-none`}>{count}</div>
      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs font-bold ${a.text} uppercase tracking-wider`}>{label}</span>
        <ArrowRight className={`w-3 h-3 ${a.text} group-hover:translate-x-0.5 transition-transform`} />
      </div>
    </Link>
  );
}