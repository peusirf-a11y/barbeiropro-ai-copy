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
    <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-black/8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-[#1B1C1E]">Alertas do sistema</h2>
          {unreadCount > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 bg-red-500 text-white rounded-full">{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-xs font-medium text-[#2563EB] hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Marcar todos como lidos
          </button>
        )}
      </div>
      <div className="divide-y divide-black/5 max-h-[480px] overflow-y-auto">
        {isLoading && <div className="p-6 text-center text-sm text-gray-400">Carregando…</div>}
        {!isLoading && alerts.length === 0 && (
          <div className="p-8 text-center">
            <CheckCheck className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <div className="text-sm text-gray-500">Nenhum alerta. Tudo certo!</div>
          </div>
        )}
        {alerts.map(a => {
          const meta = severityMeta[a.severity] || severityMeta.warning;
          const Icon = meta.icon;
          return (
            <div
              key={a.id}
              className={`p-4 flex items-start gap-3 ${!a.read ? 'bg-amber-50/30' : ''}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${meta.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#1B1C1E]">{a.message}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {a.type} · {format(new Date(a.created_date), "d/MM 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>
              {!a.read && (
                <button
                  onClick={() => markRead.mutate(a.id)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md flex-shrink-0"
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