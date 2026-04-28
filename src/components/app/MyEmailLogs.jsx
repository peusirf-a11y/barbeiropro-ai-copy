import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle, AlertCircle, Clock, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TYPE_LABELS = {
  booking_confirmation: 'Confirmação ao cliente',
  trial_reminder_d1: 'Lembrete trial D-1',
  trial_reminder_d3: 'Lembrete trial D-3',
  system_test: 'Teste',
  password_reset: 'Reset de senha',
  welcome: 'Boas-vindas',
  other: 'Outro',
};

const STATUS_CONFIG = {
  sent:    { label: 'Enviado',  color: 'bg-green-100 text-green-700', icon: CheckCircle },
  failed:  { label: 'Falhou',   color: 'bg-red-100 text-red-700',     icon: AlertCircle },
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
};

export default function MyEmailLogs() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-email-logs'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEmailHealth', {});
      return res?.data || res;
    },
  });

  const logs = (data?.logs || []).slice(0, 20);

  return (
    <div className="bg-white rounded-2xl border border-black/8 p-6">
      <div className="flex items-center gap-3 mb-2">
        <Mail className="w-5 h-5 text-[#2563EB]" />
        <h2 className="font-bold text-[#1B1C1E]">Notificações por e-mail</h2>
      </div>
      <p className="text-xs text-gray-500 mb-5">
        Histórico dos últimos e-mails que o sistema enviou em nome da sua barbearia (confirmações para clientes, lembretes, etc.).
      </p>

      {isLoading ? (
        <div className="text-center py-8 text-sm text-gray-400">Carregando…</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          Nenhum e-mail enviado ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const ts = log.sent_at || log.created_date;
            return (
              <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F7F3] hover:bg-gray-100 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#1B1C1E] truncate">{log.recipient}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {TYPE_LABELS[log.type] || log.type} · {ts ? format(new Date(ts), "dd/MM 'às' HH:mm", { locale: ptBR }) : '—'}
                  </div>
                  {log.status === 'failed' && log.error_message && (
                    <div className="text-[11px] text-red-600 mt-1 font-mono truncate">{log.error_message}</div>
                  )}
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${cfg.color} flex-shrink-0`}>
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}