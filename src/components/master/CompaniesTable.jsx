// Tabela de empresas com busca + paginação. Server-side via listCompanies.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, Globe, CheckCircle, Clock, Eye, ChevronLeft, ChevronRight, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { useImpersonationContext } from '@/contexts/ImpersonationContext';
import { useNavigate } from 'react-router-dom';
import ConfirmDestructiveDialog from '@/components/ConfirmDestructiveDialog';
import { useToast } from '@/components/ui/use-toast';
import { getTotpToken, clearTotpSession } from '@/lib/totpSession';

const statusConfig = {
  active: { label: 'Ativa', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  trial: { label: 'Trial', color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  inactive: { label: 'Inativa', color: 'bg-gray-100 text-gray-600 border border-gray-200' },
  blocked: { label: 'Bloqueada', color: 'bg-red-50 text-red-700 border border-red-200' },
};

export default function CompaniesTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { startImpersonation } = useImpersonationContext();
  const [confirmTarget, setConfirmTarget] = useState(null); // company a bloquear
  const [deleteTarget, setDeleteTarget] = useState(null);   // company a EXCLUIR (irreversível)

  const { data, isLoading } = useQuery({
    queryKey: ['master-companies', search, page],
    queryFn: async () => {
      const res = await base44.functions.invoke('listCompanies', { page, page_size: pageSize, search });
      return res.data;
    },
    keepPreviousData: true,
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const toggleStatus = useMutation({
    mutationFn: async ({ id, nextStatus }) => {
      const fn = nextStatus === 'blocked' ? 'blockCompany' : 'activateCompany';
      const res = await base44.functions.invoke(fn, {
        company_id: id,
        totp_session_token: getTotpToken(),
      });
      if (!res.data?.success) {
        if (res.data?.totp_required) clearTotpSession();
        throw new Error(res.data?.error || 'Falha');
      }
      return { ...res.data, nextStatus };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['master-companies'] });
      queryClient.invalidateQueries({ queryKey: ['master-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['master-audit-log'] });
      queryClient.invalidateQueries({ queryKey: ['system-alerts'] });
      toast({
        title: data.nextStatus === 'blocked' ? 'Empresa bloqueada' : 'Empresa ativada',
        description: 'Ação registrada no log de auditoria.',
      });
      setConfirmTarget(null);
    },
    onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteCompany = useMutation({
    mutationFn: async (company) => {
      const res = await base44.functions.invoke('deleteCompany', {
        company_id: company.id,
        confirm_name: company.name,
        totp_session_token: getTotpToken(),
      });
      if (!res.data?.success) {
        if (res.data?.totp_required) clearTotpSession();
        throw new Error(res.data?.error || 'Falha ao excluir');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['master-companies'] });
      queryClient.invalidateQueries({ queryKey: ['master-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['master-audit-log'] });
      queryClient.invalidateQueries({ queryKey: ['system-alerts'] });
      const total = Object.values(data?.counters || {}).reduce((s, n) => s + (n || 0), 0);
      toast({
        title: 'Empresa excluída',
        description: `${total} registros relacionados removidos. Ação registrada no log.`,
      });
      setDeleteTarget(null);
    },
    onError: (e) => toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' }),
  });

  const impersonate = useMutation({
    mutationFn: async (company) => {
      const res = await base44.functions.invoke('startImpersonation', {
        company_id: company.id,
        totp_session_token: getTotpToken(),
      });
      if (!res.data?.success) {
        if (res.data?.totp_required) clearTotpSession();
        throw new Error(res.data?.error || 'Falha ao iniciar impersonação');
      }
      return { ...res.data, company_name: company.name };
    },
    onSuccess: (data) => {
      startImpersonation({
        company_id: data.company_id,
        company_name: data.company_name,
        token: data.token,
        expires_at: data.expires_at,
      });
      navigate('/app/dashboard');
    },
    onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="p-4 sm:p-5 border-b border-black/5 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-bold text-[#111827] text-lg tracking-tight">Empresas cadastradas</h2>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome, e-mail ou slug…"
            className="pl-9 pr-3 py-2 border border-black/10 rounded-xl text-sm w-64"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="border-b border-black/5 bg-[#FAFBFC]">
              {['Empresa', 'Slug / Link', 'Plano', 'Onboarding', 'Status', 'Ações'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(c => (
              <tr key={c.id} className="border-b border-black/5 hover:bg-[#FAFBFC] transition-colors duration-150">
                <td className="px-4 py-3">
                  <div className="font-semibold text-sm text-[#111827]">{c.name}</div>
                  {c.owner_email && <div className="text-xs text-[#6B7280] mt-0.5">{c.owner_email}</div>}
                </td>
                <td className="px-4 py-3">
                  {c.slug ? (
                    <a href={`/agendar/${c.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-[#2563EB] hover:underline font-medium">
                      <Globe className="w-3 h-3" />/agendar/{c.slug}
                    </a>
                  ) : <span className="text-xs text-gray-400">–</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-[#EFF6FF] text-[#2563EB] rounded-full border border-[#DBEAFE]">{c.plan_name || 'Starter'}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {c.onboarding_completed
                      ? <><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-xs text-emerald-600 font-medium">Completo</span></>
                      : <><Clock className="w-4 h-4 text-amber-500" /><span className="text-xs text-amber-600 font-medium">Etapa {c.onboarding_step || 1}</span></>
                    }
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${(statusConfig[c.status] || statusConfig.active).color}`}>
                    {(statusConfig[c.status] || statusConfig.active).label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => navigate(`/master/barbearias/${c.id}`)}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] border border-[#DBEAFE] flex items-center gap-1 transition-colors"
                      title="Detalhes da empresa (funcionalidades, plano, etc.)"
                    >
                      <ExternalLink className="w-3 h-3" /> Detalhes
                    </button>
                    <button
                      onClick={() => impersonate.mutate(c)}
                      disabled={impersonate.isPending}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 flex items-center gap-1 disabled:opacity-50 transition-colors"
                      title="Visualizar como esta empresa (15min)"
                    >
                      {impersonate.isPending && impersonate.variables?.id === c.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Eye className="w-3 h-3" />}
                      Visualizar
                    </button>
                    <button
                      disabled={toggleStatus.isPending}
                      onClick={() => {
                        if (c.status === 'active') {
                          // Confirmação forte: digitar nome
                          setConfirmTarget(c);
                        } else {
                          toggleStatus.mutate({ id: c.id, nextStatus: 'active' });
                        }
                      }}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold disabled:opacity-50 inline-flex items-center gap-1 transition-colors border ${c.status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200'}`}>
                      {toggleStatus.isPending && toggleStatus.variables?.id === c.id && <Loader2 className="w-3 h-3 animate-spin" />}
                      {c.status === 'active' ? 'Bloquear' : 'Ativar'}
                    </button>
                    <button
                      disabled={deleteCompany.isPending}
                      onClick={() => setDeleteTarget(c)}
                      title="Excluir empresa permanentemente (irreversível)"
                      className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 inline-flex items-center gap-1 disabled:opacity-50 transition-colors"
                    >
                      {deleteCompany.isPending && deleteCompany.variables?.id === c.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />}
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-[#6B7280] text-sm">Nenhuma empresa encontrada</td></tr>
            )}
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-[#6B7280] text-sm">Carregando…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-black/5 flex items-center justify-between text-sm bg-[#FAFBFC]">
        <span className="text-[#6B7280] font-medium">{total} {total === 1 ? 'empresa' : 'empresas'}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-1.5 rounded-lg border border-black/10 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors"
          ><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-[#6B7280] text-xs font-medium">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg border border-black/10 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors"
          ><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <ConfirmDestructiveDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => confirmTarget && toggleStatus.mutate({ id: confirmTarget.id, nextStatus: 'blocked' })}
        title={`Bloquear "${confirmTarget?.name || ''}"?`}
        description="A empresa perde imediatamente o acesso ao app. A ação é registrada no log de auditoria."
        expectedText={confirmTarget?.name || ''}
        confirmLabel="Bloquear empresa"
        isLoading={toggleStatus.isPending}
      />

      <ConfirmDestructiveDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteCompany.mutate(deleteTarget)}
        title={`EXCLUIR "${deleteTarget?.name || ''}" PERMANENTEMENTE?`}
        description="Esta ação é IRREVERSÍVEL. Serão apagados em cascata: agendamentos, clientes, profissionais, financeiro, comissões, equipe, mensagens, avaliações e a própria empresa. Apenas o AuditLog ficará preservado."
        expectedText={deleteTarget?.name || ''}
        confirmLabel="Excluir tudo permanentemente"
        isLoading={deleteCompany.isPending}
      />
    </div>
  );
}