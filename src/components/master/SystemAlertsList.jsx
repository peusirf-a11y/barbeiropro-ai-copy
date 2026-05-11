// Lista de alertas do sistema (Master). Mostra recentes e permite marcar como lido.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, AlertCircle, Info, CheckCheck, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const severityMeta = {
  critical: { icon: AlertCircle, color: 'text-red-600 bg-red-50 border-red-200' },
  warning: { icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  info: { icon: Info, color: 'text-blue-600 bg-blue-50 border-blue-200' },
};

// Labels amigáveis por tipo — evita expor o enum cru na UI.
const typeLabels = {
  payment_failed: 'Pagamento falhou',
  company_blocked: 'Empresa bloqueada',
  subscription_canceled: 'Assinatura cancelada',
  critical_error: 'Erro crítico',
  abnormal_usage: 'Uso anormal',
  stripe_env_mismatch: '⚠️ Stripe ambiente errado',
  info: 'Informação',
};

export default function SystemAlertsList() {
  const qc = useQueryClient();
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['system-alerts'],
    queryFn: () => base44.entities.SystemAlert.list('-created_date', 50),
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: (id) => base44.entities.SystemAlert.update(id, { read: true, read_at: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-alerts'] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = alerts.filter(a => !a.read);
      await Promise.all(unread.map(a =>
        base44.entities.SystemAlert.update(a.id, { read: true, read_at: new Date().toISOString() })
      ));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-alerts'] }),
  });

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="p-4 sm:p-5 border-b border-black/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-[#111827] text-lg tracking-tight">Alertas do sistema</h2>
          {unreadCount > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 bg-red-500 text-white rounded-full shadow-[0_2px_6px_rgba(239,68,68,0.4)]">{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Marcar todos como lidos
          </button>
        )}
      </div>
      <div className="divide-y divide-black/5 max-h-[480px] overflow-y-auto">
        {isLoading && <div className="p-6 text-center text-sm text-[#6B7280]">Carregando…</div>}
        {!isLoading && alerts.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center mx-auto mb-3">
              <CheckCheck className="w-7 h-7 text-emerald-600" />
            </div>
            <div className="text-sm font-semibold text-[#111827]">Nenhum alerta. Tudo certo!</div>
          </div>
        )}
        {alerts.map(a => {
          const meta = severityMeta[a.severity] || severityMeta.warning;
          const Icon = meta.icon;
          return (
            <div
              key={a.id}
              className={`p-4 flex items-start gap-3 transition-colors ${!a.read ? 'bg-amber-50/40' : 'hover:bg-[#FAFBFC]'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${meta.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#111827]">{a.message}</div>
                <div className="text-[11px] text-[#6B7280] mt-0.5 font-medium">
                  {typeLabels[a.type] || a.type} · {format(new Date(a.created_date), "d/MM 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>
              {!a.read && (
                <button
                  onClick={() => markRead.mutate(a.id)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex-shrink-0 transition-colors"
                  title="Marcar como lido"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}