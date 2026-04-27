// Tabela de empresas com busca + paginação. Server-side via listCompanies.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, Globe, CheckCircle, Clock, Eye, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { startImpersonation } from '@/lib/impersonation';
import { useNavigate } from 'react-router-dom';
import ConfirmDestructiveDialog from '@/components/ConfirmDestructiveDialog';
import { useToast } from '@/components/ui/use-toast';
import { getTotpToken, clearTotpSession } from '@/lib/totpSession';

const statusConfig = {
  active: { label: 'Ativa', color: 'bg-green-100 text-green-700' },
  trial: { label: 'Trial', color: 'bg-orange-100 text-orange-600' },
  inactive: { label: 'Inativa', color: 'bg-gray-100 text-gray-500' },
  blocked: { label: 'Bloqueada', color: 'bg-red-100 text-red-600' },
};

export default function CompaniesTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [confirmTarget, setConfirmTarget] = useState(null); // company a bloquear

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
    <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-black/8 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-bold text-[#1B1C1E]">Empresas cadastradas</h2>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome, e-mail ou slug…"
            className="pl-9 pr-3 py-2 border border-black/10 rounded-lg text-sm w-64"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="border-b border-black/8">
              {['Empresa', 'Slug / Link', 'Plano', 'Onboarding', 'Status', 'Ações'].map(h => (
                <th key={h} className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(c => (
              <tr key={c.id} className="border-b border-black/5 hover:bg-[#F8F7F3]">
                <td className="p-4">
                  <div className="font-semibold text-sm text-[#1B1C1E]">{c.name}</div>
                  {c.owner_email && <div className="text-xs text-gray-400">{c.owner_email}</div>}
                </td>
                <td className="p-4">
                  {c.slug ? (
                    <a href={`/agendar/${c.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-[#2563EB] hover:underline">
                      <Globe className="w-3 h-3" />/agendar/{c.slug}
                    </a>
                  ) : <span className="text-xs text-gray-400">–</span>}
                </td>
                <td className="p-4">
                  <span className="text-xs font-medium px-2 py-1 bg-[#60A5FA]/15 text-[#2563EB] rounded-lg">{c.plan_name || 'Starter'}</span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1.5">
                    {c.onboarding_completed
                      ? <><CheckCircle className="w-4 h-4 text-green-500" /><span className="text-xs text-green-600">Completo</span></>
                      : <><Clock className="w-4 h-4 text-orange-400" /><span className="text-xs text-orange-600">Etapa {c.onboarding_step || 1}</span></>
                    }
                  </div>
                </td>
                <td className="p-4">
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${(statusConfig[c.status] || statusConfig.active).color}`}>
                    {(statusConfig[c.status] || statusConfig.active).label}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => impersonate.mutate(c)}
                      disabled={impersonate.isPending}
                      className="text-xs px-2 py-1 rounded-lg font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 flex items-center gap-1 disabled:opacity-50"
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
                      className={`text-xs px-2 py-1 rounded-lg font-medium disabled:opacity-50 inline-flex items-center gap-1 ${c.status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                      {toggleStatus.isPending && toggleStatus.variables?.id === c.id && <Loader2 className="w-3 h-3 animate-spin" />}
                      {c.status === 'active' ? 'Bloquear' : 'Ativar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400 text-sm">Nenhuma empresa encontrada</td></tr>
            )}
            {isLoading && (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400 text-sm">Carregando…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-black/8 flex items-center justify-between text-sm">
        <span className="text-gray-500">{total} {total === 1 ? 'empresa' : 'empresas'}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-1.5 rounded-md border border-black/10 disabled:opacity-40 hover:bg-gray-50"
          ><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-gray-500 text-xs">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-1.5 rounded-md border border-black/10 disabled:opacity-40 hover:bg-gray-50"
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
    </div>
  );
}