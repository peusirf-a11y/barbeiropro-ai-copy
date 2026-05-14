// Usuários — gestão de acessos ao Master (super admins) e log de auditoria.
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, Mail, Calendar } from 'lucide-react';
import AuditLogList from '@/components/master/AuditLogList';

export default function MasterUsuarios() {
  // Lista TODOS os usuários da plataforma e separa por role
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['master-users-all'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listPlatformUsers', {});
      return res.data?.users || [];
    },
  });

  const admins = users.filter(u => u.role === 'admin');
  const regulars = users.filter(u => u.role !== 'admin');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-[#111827] tracking-tight">Usuários</h2>
        <p className="text-sm text-[#6B7280] mt-1">Controle de acessos e permissões da plataforma.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="p-5 border-b border-black/5 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#2563EB]" />
            <h3 className="font-bold text-[#111827] tracking-tight">Super Admins</h3>
            <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 bg-[#EFF6FF] text-[#2563EB] rounded-full">{admins.length}</span>
          </div>
          <div className="divide-y divide-black/5">
            {admins.map(u => (
              <div key={u.id} className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {(u.full_name?.[0] || u.email?.[0] || '?').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-[#111827] truncate">{u.full_name || '—'}</div>
                  <div className="text-xs text-[#6B7280] flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3 flex-shrink-0" />{u.email}
                  </div>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">admin</span>
              </div>
            ))}
            {!isLoading && admins.length === 0 && (
              <div className="p-8 text-center text-[#6B7280] text-sm">Nenhum super admin encontrado.</div>
            )}
            {isLoading && (
              <div className="p-8 text-center text-[#6B7280] text-sm">Carregando…</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="p-5 border-b border-black/5 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#6B7280]" />
            <h3 className="font-bold text-[#111827] tracking-tight">Usuários da plataforma</h3>
            <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{regulars.length}</span>
          </div>
          <div className="divide-y divide-black/5 max-h-[400px] overflow-y-auto">
            {regulars.slice(0, 50).map(u => (
              <div key={u.id} className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs flex-shrink-0">
                  {(u.full_name?.[0] || u.email?.[0] || '?').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-[#111827] truncate">{u.full_name || u.email}</div>
                  <div className="text-[11px] text-[#6B7280] truncate">{u.email}</div>
                </div>
                <span className="text-[10px] text-[#6B7280]">
                  {u.created_date ? new Date(u.created_date).toLocaleDateString('pt-BR') : '–'}
                </span>
              </div>
            ))}
            {!isLoading && regulars.length === 0 && (
              <div className="p-8 text-center text-[#6B7280] text-sm">Nenhum usuário cadastrado.</div>
            )}
          </div>
          {regulars.length > 50 && (
            <div className="px-4 py-2 text-[11px] text-[#6B7280] text-center border-t border-black/5 bg-[#FAFBFC]">
              Mostrando 50 de {regulars.length} usuários
            </div>
          )}
        </div>
      </div>

      <AuditLogList />
    </div>
  );
}