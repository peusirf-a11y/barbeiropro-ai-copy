// Lista enxuta de ações recentes do Master (audit trail).
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Shield } from 'lucide-react';

const actionLabel = {
  BLOCK_COMPANY: { label: 'Bloqueou empresa', color: 'text-red-600 bg-red-50' },
  ACTIVATE_COMPANY: { label: 'Ativou empresa', color: 'text-green-600 bg-green-50' },
};

export default function AuditLogList() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['master-audit-log'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 30),
  });

  return (
    <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-black/8 flex items-center gap-2">
        <Shield className="w-4 h-4 text-[#2563EB]" />
        <h2 className="font-bold text-[#1B1C1E]">Log de auditoria (últimas 30 ações)</h2>
      </div>
      <div className="divide-y divide-black/5 max-h-96 overflow-y-auto">
        {isLoading && <div className="p-6 text-center text-sm text-gray-400">Carregando…</div>}
        {!isLoading && logs.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">Nenhuma ação registrada ainda.</div>
        )}
        {logs.map(l => {
          const cfg = actionLabel[l.action] || { label: l.action, color: 'text-gray-700 bg-gray-100' };
          return (
            <div key={l.id} className="p-4 flex items-start gap-3 text-sm">
              <span className={`text-[11px] font-semibold px-2 py-1 rounded-md flex-shrink-0 ${cfg.color}`}>
                {cfg.label}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[#1B1C1E] truncate">
                  <span className="font-medium">{l.actor_email || 'sistema'}</span>
                  {l.target_type && <span className="text-gray-500"> · {l.target_type} <code className="text-xs">{l.target_id?.slice(0, 8)}</code></span>}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {l.created_date && format(new Date(l.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  {l.ip && l.ip !== 'unknown' && <span> · IP {l.ip}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}