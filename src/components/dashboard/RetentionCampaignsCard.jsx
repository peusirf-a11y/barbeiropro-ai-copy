// Card do Dashboard com visão geral das campanhas automáticas de retenção (Fase 3.3).
// - KPIs dos últimos 7 dias por tipo de campanha (envios bem-sucedidos)
// - Lista de clientes VIP em risco/inativo (precisam de atenção pessoal)
// - Atalho para "Configurações > Automações" e "Clientes em risco"
//
// Lê WhatsAppMessage com type=crm_* + Customer com lifecycle_status em {em_risco, inativo, perdido}

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Zap, Crown, ArrowRight, Settings, Send } from 'lucide-react';
import { CAMPAIGN_LABELS, CAMPAIGN_TO_MSG_TYPE } from '@/lib/lifecycleCampaigns';

export default function RetentionCampaignsCard({ companyId, customers = [] }) {
  const sinceISO = useMemo(() => new Date(Date.now() - 7 * 86400000).toISOString(), []);

  // Mensagens CRM dos últimos 7 dias (BFF Fase 4 — listWhatsAppMessages).
  // Servidor aplica tenant scope. Filtro por type/sent_at continua em memória
  // (não há operador de range no filter; pegamos os 200 mais recentes).
  const { data: recentMessages = [] } = useQuery({
    queryKey: ['crm-messages-7d', companyId],
    queryFn: async () => {
      const res = await base44.functions.invoke('listWhatsAppMessages', { limit: 200 });
      return res?.data?.messages || [];
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  // Conta envios bem-sucedidos por chave de campanha.
  const sentByCampaign = useMemo(() => {
    const counts = {};
    const crmTypes = new Set(Object.values(CAMPAIGN_TO_MSG_TYPE));
    for (const msg of recentMessages) {
      if (!crmTypes.has(msg.type)) continue;
      if (msg.status === 'erro') continue;
      if (msg.sent_at && msg.sent_at < sinceISO) continue;
      const key = Object.keys(CAMPAIGN_TO_MSG_TYPE).find(k => CAMPAIGN_TO_MSG_TYPE[k] === msg.type);
      if (!key) continue;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [recentMessages, sinceISO]);

  const totalSent7d = useMemo(
    () => Object.values(sentByCampaign).reduce((s, n) => s + n, 0),
    [sentByCampaign]
  );

  // VIPs que entraram em em_risco/inativo/perdido — chamada de atenção do dono.
  const vipsAtRisk = useMemo(
    () => customers.filter(c =>
      c.status === 'vip' &&
      ['em_risco', 'inativo', 'perdido'].includes(c.lifecycle_status)
    ).slice(0, 5),
    [customers]
  );

  // Ordenamos campanhas com pelo menos 1 envio ou mostramos top-4 mesmo zerado.
  const campaignsToShow = ['primeira_visita', 'em_risco', 'inativo', 'vip_inativo', 'fiel_sem_plano', 'perdido'];

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden">
      <div className="p-5 border-b border-white/8 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15">
            <span className="absolute inset-0 rounded-xl bg-[#60A5FA]/30 blur-md opacity-60" aria-hidden="true" />
            <Zap className="relative w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white">Automações de retenção</h3>
            <p className="text-xs text-white/55 mt-0.5">Últimos 7 dias</p>
          </div>
        </div>
        <Link
          to="/app/configuracoes"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#93C5FD] hover:text-white hover:underline"
        >
          <Settings className="w-3.5 h-3.5" /> Configurar
        </Link>
      </div>

      {/* Total destacado */}
      <div className="px-5 pt-4 pb-3 flex items-baseline gap-3 border-b border-white/8">
        <Send className="w-4 h-4 text-[#93C5FD]" />
        <span className="text-2xl font-black bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">{totalSent7d}</span>
        <span className="text-xs text-white/55 font-medium">
          mensagem{totalSent7d === 1 ? '' : 's'} automática{totalSent7d === 1 ? '' : 's'} enviada{totalSent7d === 1 ? '' : 's'}
        </span>
      </div>

      {/* Breakdown por campanha */}
      {totalSent7d > 0 ? (
        <div className="p-3 grid grid-cols-2 gap-2">
          {campaignsToShow.map(key => {
            const count = sentByCampaign[key] || 0;
            if (count === 0) return null;
            const meta = CAMPAIGN_LABELS[key];
            return (
              <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/8">
                <span className="text-base">{meta?.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white/55 font-medium truncate">{meta?.label}</div>
                </div>
                <div className="text-sm font-bold text-white">{count}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-5 text-center">
          <p className="text-xs text-white/55">
            Nenhuma campanha enviada esta semana.{' '}
            <Link to="/app/configuracoes" className="font-semibold text-[#93C5FD] hover:text-white hover:underline">
              Ative as automações
            </Link>{' '}
            para reativar clientes inativos automaticamente.
          </p>
        </div>
      )}

      {/* Alerta VIPs em risco */}
      {vipsAtRisk.length > 0 && (
        <div className="border-t border-white/8 bg-violet-400/[0.08] px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-violet-300" />
            <span className="text-xs font-bold text-violet-200 uppercase tracking-wider">
              {vipsAtRisk.length} VIP{vipsAtRisk.length > 1 ? 's' : ''} precisa{vipsAtRisk.length > 1 ? 'm' : ''} de atenção
            </span>
          </div>
          <div className="space-y-1.5">
            {vipsAtRisk.map(c => {
              const meta = CAMPAIGN_LABELS[c.lifecycle_status];
              return (
                <div key={c.id} className="flex items-center gap-2 text-xs bg-white/[0.04] rounded-lg px-2.5 py-1.5 border border-white/10">
                  <span className="font-semibold text-white truncate flex-1">{c.name}</span>
                  <span className="text-[10px] font-bold text-violet-200 bg-violet-400/[0.18] border border-violet-400/30 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    {meta?.icon} {meta?.label}
                  </span>
                </div>
              );
            })}
          </div>
          <Link
            to="/app/clientes"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:text-white hover:underline"
          >
            Ver todos os VIPs <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}