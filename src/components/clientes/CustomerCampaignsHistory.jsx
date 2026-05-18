// Histórico das campanhas automáticas (CRM) enviadas para um cliente específico.
// Renderizado no modal de edição do cliente (StandardModal de AppClientes).
// Lê WhatsAppMessage filtrando por customer_id + type=crm_*.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { History, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CAMPAIGN_LABELS, CAMPAIGN_TO_MSG_TYPE } from '@/lib/lifecycleCampaigns';

const CRM_TYPES = new Set(Object.values(CAMPAIGN_TO_MSG_TYPE));
const TYPE_TO_KEY = Object.fromEntries(
  Object.entries(CAMPAIGN_TO_MSG_TYPE).map(([k, v]) => [v, k])
);

export default function CustomerCampaignsHistory({ customer }) {
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['customer-crm-messages', customer.id],
    queryFn: () => base44.entities.WhatsAppMessage.filter(
      { customer_id: customer.id },
      '-sent_at',
      50
    ),
    enabled: !!customer?.id,
    staleTime: 30_000,
  });

  const crmMessages = useMemo(
    () => messages.filter(m => CRM_TYPES.has(m.type)),
    [messages]
  );

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-[#93C5FD]" />
        <h3 className="font-bold text-white">Histórico de automações</h3>
      </div>

      {isLoading ? (
        <div className="text-xs text-white/45">Carregando...</div>
      ) : crmMessages.length === 0 ? (
        <div className="text-center py-4">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 text-white/20" />
          <p className="text-xs text-white/55">Nenhuma campanha automática enviada para este cliente ainda.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto modal-scroll">
          {crmMessages.map(msg => {
            const key = TYPE_TO_KEY[msg.type];
            const meta = CAMPAIGN_LABELS[key];
            const isError = msg.status === 'erro';
            return (
              <div
                key={msg.id}
                className={`p-3 rounded-lg border text-xs ${isError ? 'bg-rose-500/10 border-rose-400/30' : 'bg-white/[0.03] border-white/8'}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm">{meta?.icon}</span>
                    <span className="font-semibold text-white truncate">{meta?.label || msg.type}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isError ? (
                      <span className="text-[10px] font-bold text-rose-200 bg-rose-400/20 border border-rose-400/30 px-1.5 py-0.5 rounded-full">ERRO</span>
                    ) : msg.status === 'simulado' ? (
                      <span className="text-[10px] font-bold text-amber-200 bg-amber-400/20 border border-amber-400/30 px-1.5 py-0.5 rounded-full">SIMULADO</span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-200 bg-emerald-400/20 border border-emerald-400/30 px-1.5 py-0.5 rounded-full">ENVIADO</span>
                    )}
                    <span className="text-[10px] text-white/50 whitespace-nowrap">
                      {msg.sent_at ? format(new Date(msg.sent_at), "d MMM 'às' HH:mm", { locale: ptBR }) : '–'}
                    </span>
                  </div>
                </div>
                <p className="text-white/80 whitespace-pre-wrap leading-relaxed">{msg.message_text || '(sem conteúdo)'}</p>
                {isError && msg.error_message && (
                  <p className="mt-1.5 text-[10px] text-rose-200 italic">{msg.error_message}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}