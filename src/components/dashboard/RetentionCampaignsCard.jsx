// Card com visão geral das campanhas automáticas de retenção (últimos 7 dias).
// Aponta diretamente para /app/automacoes para configurar disparos e modelos.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Zap, Crown, ArrowRight, Settings, Send } from 'lucide-react';
import { CAMPAIGN_LABELS, CAMPAIGN_TO_MSG_TYPE } from '@/lib/lifecycleCampaigns';

export default function RetentionCampaignsCard({ companyId, customers = [] }) {
  const sinceISO = useMemo(() => new Date(Date.now() - 7 * 86400000).toISOString(), []);

  const { data: recentMessages = [] } = useQuery({
    queryKey: ['crm-messages-7d', companyId],
    queryFn: async () => {
      const res = await base44.functions.invoke('listWhatsAppMessages', { limit: 200 });
      return res?.data?.messages || [];
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const sentByCampaign = useMemo(() => {
    const counts = {};
    const crmTypes = new Set(Object.values(CAMPAIGN_TO_MSG_TYPE));
    for (const msg of recentMessages) {
      if (!crmTypes.has(msg.type)) continue;
      if (msg.status === 'erro') continue;
      if (msg.sent_at && msg.sent_at < sinceISO) continue;
      const key = Object.keys(CAMPAIGN_TO_MSG_TYPE).find((k) => CAMPAIGN_TO_MSG_TYPE[k] === msg.type);
      if (!key) continue;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [recentMessages, sinceISO]);

  const totalSent7d = useMemo(
    () => Object.values(sentByCampaign).reduce((s, n) => s + n, 0),
    [sentByCampaign]
  );

  const vipsAtRisk = useMemo(
    () =>
      customers
        .filter((c) => c.status === 'vip' && ['em_risco', 'inativo', 'perdido'].includes(c.lifecycle_status))
        .slice(0, 5),
    [customers]
  );

  const campaignsToShow = ['primeira_visita', 'em_risco', 'inativo', 'vip_inativo', 'fiel_sem_plano', 'perdido'];

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.025] backdrop-blur-md overflow-hidden shadow-sm">
      <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center shadow-sm ring-1 ring-white/15">
            <Zap className="relative w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Disparos de retenção</h3>
            <p className="text-xs text-slate-500 dark:text-white/55 mt-0.5">Últimos 7 dias</p>
          </div>
        </div>
        <Link
          to="/app/automacoes"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] dark:text-[#93C5FD] hover:underline"
        >
          <Settings className="w-3.5 h-3.5" /> Gerir campanhas
        </Link>
      </div>

      <div className="px-5 pt-4 pb-3 flex items-baseline gap-3 border-b border-slate-200 dark:border-white/10">
        <Send className="w-4 h-4 text-[#2563EB] dark:text-[#93C5FD]" />
        <span className="text-2xl font-black text-slate-900 dark:text-white">{totalSent7d}</span>
        <span className="text-xs text-slate-500 dark:text-white/55 font-medium">
          mensagem{totalSent7d === 1 ? '' : 's'} automática{totalSent7d === 1 ? '' : 's'} enviada{totalSent7d === 1 ? '' : 's'}
        </span>
      </div>

      {totalSent7d > 0 ? (
        <div className="p-3 grid grid-cols-2 gap-2">
          {campaignsToShow.map((key) => {
            const count = sentByCampaign[key] || 0;
            if (count === 0) return null;
            const meta = CAMPAIGN_LABELS[key];
            return (
              <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/8">
                <span className="text-base">{meta?.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-slate-600 dark:text-white/55 font-medium truncate">{meta?.label}</div>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{count}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-5 text-center">
          <p className="text-xs text-slate-500 dark:text-white/55">
            Nenhuma campanha enviada esta semana.{' '}
            <Link to="/app/automacoes" className="font-semibold text-[#2563EB] dark:text-[#93C5FD] hover:underline">
              Ative as campanhas de WhatsApp
            </Link>{' '}
            para reativar clientes inativos automaticamente.
          </p>
        </div>
      )}

      {vipsAtRisk.length > 0 && (
        <div className="border-t border-slate-200 dark:border-white/10 bg-violet-50/70 dark:bg-violet-400/[0.08] px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-violet-600 dark:text-violet-300" />
            <span className="text-xs font-bold text-violet-900 dark:text-violet-200 uppercase tracking-wider">
              {vipsAtRisk.length} VIP{vipsAtRisk.length > 1 ? 's' : ''} precisa{vipsAtRisk.length > 1 ? 'm' : ''} de atenção
            </span>
          </div>
          <div className="space-y-1.5">
            {vipsAtRisk.map((c) => {
              const meta = CAMPAIGN_LABELS[c.lifecycle_status];
              return (
                <div key={c.id} className="flex items-center gap-2 text-xs bg-white dark:bg-white/[0.04] rounded-lg px-2.5 py-1.5 border border-violet-200 dark:border-white/10">
                  <span className="font-semibold text-slate-900 dark:text-white truncate flex-1">{c.name}</span>
                  <span className="text-[10px] font-bold text-violet-800 dark:text-violet-200 bg-violet-100 dark:bg-violet-400/[0.18] border border-violet-200 dark:border-violet-400/30 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    {meta?.icon} {meta?.label}
                  </span>
                </div>
              );
            })}
          </div>
          <Link
            to="/app/clientes?filter=vip"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:underline"
          >
            Ver todos os VIPs <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}