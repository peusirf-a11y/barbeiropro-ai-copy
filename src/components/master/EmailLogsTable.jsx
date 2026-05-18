import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TYPE_LABELS = {
  booking_confirmation: 'Confirmação de agendamento',
  trial_reminder_d1: 'Lembrete trial D-1',
  trial_reminder_d3: 'Lembrete trial D-3',
  system_test: 'Teste do sistema',
  password_reset: 'Reset de senha',
  welcome: 'Boas-vindas',
  other: 'Outro',
};

const STATUS_CONFIG = {
  sent:    { label: 'Enviado',  color: 'bg-emerald-500/15 text-emerald-500', icon: CheckCircle },
  failed:  { label: 'Falhou',   color: 'bg-red-500/15 text-red-500',         icon: AlertCircle },
  pending: { label: 'Pendente', color: 'bg-amber-500/15 text-amber-500',     icon: Clock },
};

export default function EmailLogsTable() {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['email-logs'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEmailHealth', {});
      return res?.data || res;
    },
    refetchInterval: 30000,
  });

  const logs = (data?.logs || []).filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    if (filterType !== 'all' && l.type !== filterType) return false;
    return true;
  });

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="font-bold text-foreground">Histórico de envios</h3>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="text-xs px-3 py-1.5 border border-border rounded-lg bg-background text-foreground min-w-0 flex-1 sm:flex-none">
            <option value="all">Todos os status</option>
            <option value="sent">Enviados</option>
            <option value="failed">Falhas</option>
            <option value="pending">Pendentes</option>
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="text-xs px-3 py-1.5 border border-border rounded-lg bg-background text-foreground min-w-0 flex-1 sm:flex-none">
            <option value="all">Todos os tipos</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-sm text-muted-foreground">Carregando…</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">Nenhum envio registrado</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="pb-2 pr-3 font-semibold">Quando</th>
                <th className="pb-2 pr-3 font-semibold">Tipo</th>
                <th className="pb-2 pr-3 font-semibold">Destinatário</th>
                <th className="pb-2 pr-3 font-semibold">Status</th>
                <th className="pb-2 pr-3 font-semibold">Erro</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                const ts = log.sent_at || log.created_date;
                return (
                  <tr key={log.id} className="border-b border-border hover:bg-muted/40">
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                      {ts ? format(new Date(ts), "dd/MM HH:mm", { locale: ptBR }) : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-foreground/80">{TYPE_LABELS[log.type] || log.type}</td>
                    <td className="py-2.5 pr-3 text-xs text-foreground/80 truncate max-w-[200px]" title={log.recipient}>{log.recipient}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-red-500 font-mono truncate max-w-[280px]" title={log.error_message}>
                      {log.error_message || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}