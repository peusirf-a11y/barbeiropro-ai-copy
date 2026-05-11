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
    <div className="bg-white rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] overflow-hidden">
      <div className="p-5 border-b border-black/5 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.25)]">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-[#111827]">Automações de retenção</h3>
            <p className="text-xs text-[#6B7280] mt-0.5">Últimos 7 dias</p>
          </div>
        </div>
        <Link
          to="/app/configuracoes"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
        >
          <Settings className="w-3.5 h-3.5" /> Configurar
        </Link>
      </div>

      {/* Total destacado */}
      <div className="px-5 pt-4 pb-3 flex items-baseline gap-3 border-b border-black/5">
        <Send className="w-4 h-4 text-[#2563EB]" />
        <span className="text-2xl font-black text-[#111827]">{totalSent7d}</span>
        <span className="text-xs text-[#6B7280] font-medium">
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
              <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50/80">
                <span className="text-base">{meta?.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-gray-500 font-medium truncate">{meta?.label}</div>
                </div>
                <div className="text-sm font-bold text-[#111827]">{count}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-5 text-center">
          <p className="text-xs text-[#6B7280]">
            Nenhuma campanha enviada esta semana.{' '}
            <Link to="/app/configuracoes" className="font-semibold text-[#2563EB] hover:underline">
              Ative as automações
            </Link>{' '}
            para reativar clientes inativos automaticamente.
          </p>
        </div>
      )}

      {/* Alerta VIPs em risco */}
      {vipsAtRisk.length > 0 && (
        <div className="border-t border-black/5 bg-purple-50/40 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-purple-700" />
            <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">
              {vipsAtRisk.length} VIP{vipsAtRisk.length > 1 ? 's' : ''} precisa{vipsAtRisk.length > 1 ? 'm' : ''} de atenção
            </span>
          </div>
          <div className="space-y-1.5">
            {vipsAtRisk.map(c => {
              const meta = CAMPAIGN_LABELS[c.lifecycle_status];
              return (
                <div key={c.id} className="flex items-center gap-2 text-xs bg-white rounded-lg px-2.5 py-1.5 border border-purple-100">
                  <span className="font-semibold text-[#111827] truncate flex-1">{c.name}</span>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    {meta?.icon} {meta?.label}
                  </span>
                </div>
              );
            })}
          </div>
          <Link
            to="/app/clientes"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:underline"
          >
            Ver todos os VIPs <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}