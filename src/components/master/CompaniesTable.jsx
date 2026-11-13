'use client';

// CompaniesTable.jsx — Tabela Avançada de Tenants (Barbearias) com TanStack Table (@tanstack/react-table)
// Design System: Premium Business SaaS + Business Intelligence
// Superfície: #FFFFFF | Bordas: #E5E7EF | Acentos: #171827, #59658F, #B5D7E8
import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { base44 } from '@/api/base44Client';
import {
  Search,
  Globe,
  CheckCircle,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  ExternalLink,
  Building2,
  Lock,
  Unlock,
  Building,
} from 'lucide-react';
import { useImpersonationContext } from '@/contexts/ImpersonationContext';
import { useNavigate, useLocation } from 'react-router-dom';
import ConfirmDestructiveDialog from '@/components/ConfirmDestructiveDialog';
import { useToast } from '@/components/ui/use-toast';
import { getTotpToken, clearTotpSession } from '@/lib/totpSession';
import { calculateSubscriptionPrice } from '@/lib/planPricing';

const statusConfig = {
  active: { label: 'Ativa', color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40' },
  trial: { label: 'Trial', color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40' },
  inactive: { label: 'Inativa', color: 'bg-slate-100 dark:bg-slate-800 text-[#59658F] dark:text-slate-300 border border-[#E5E7EF] dark:border-slate-700' },
  blocked: { label: 'Bloqueada', color: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40 font-semibold' },
};

const subscriptionStatusConfig = {
  TRIAL: { label: 'TRIAL', color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40' },
  ACTIVE: { label: 'ACTIVE', color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40' },
  MANUAL_ACTIVE: { label: 'ATIVO · Cortesia', color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 font-semibold' },
  PENDING_PAYMENT: { label: 'PENDENTE · Pagamento', color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 font-semibold' },
  OVERDUE: { label: 'OVERDUE · Inadimplente', color: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40 font-bold' },
  PAST_DUE: { label: 'PAST_DUE · Atrasada', color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 font-bold' },
  CANCELED: { label: 'CANCELED · Cancelada', color: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40' },
  BLOCKED: { label: 'BLOCKED', color: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40 font-bold' },
};

function resolveSubscriptionStatus(company) {
  const subStatus = String(company?.subscription_status || '').trim().toLowerCase();
  const billStatus = String(company?.billing_status || '').trim().toUpperCase();
  const rawStatus = String(company?.status || '').trim().toLowerCase();

  const hasCardOrSubscription = Boolean(
    (company?.card_last_digits && String(company.card_last_digits).trim() !== '') ||
      (company?.asaas_subscription_id && String(company.asaas_subscription_id).trim() !== '')
  );
  const isTrialExpired = Boolean(company?.trial_ends_at && new Date(company.trial_ends_at) < new Date());

  if (rawStatus === 'blocked' || billStatus === 'BLOCKED') return 'BLOCKED';
  if (subStatus === 'manual_active') return 'MANUAL_ACTIVE';
  if (subStatus === 'pending_payment' || billStatus === 'PENDING') return 'PENDING_PAYMENT';
  if (
    rawStatus === 'canceled' ||
    rawStatus === 'cancelled' ||
    (rawStatus === 'inactive' && subStatus !== 'pending_payment') ||
    subStatus === 'canceled' ||
    subStatus === 'cancelled' ||
    billStatus === 'CANCELED' ||
    billStatus === 'CANCELLED'
  ) {
    return 'CANCELED';
  }
  if (rawStatus === 'overdue' || subStatus === 'overdue' || billStatus === 'OVERDUE') return 'OVERDUE';
  if (rawStatus === 'past_due' || subStatus === 'past_due' || billStatus === 'PAST_DUE') return 'PAST_DUE';

  const isPaying =
    rawStatus === 'active' &&
    (subStatus === 'active' || billStatus === 'ACTIVE') &&
    hasCardOrSubscription;

  if (isPaying) return 'ACTIVE';

  if (isTrialExpired && !hasCardOrSubscription) {
    return 'OVERDUE';
  }

  return 'TRIAL';
}

export default function CompaniesTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
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
    placeholderData: (prev) => prev,
  });

  const items = useMemo(() => data?.items || [], [data?.items]);
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
        description: 'Ação registrada no log de auditoria com sucesso.',
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-companies'] });
      queryClient.invalidateQueries({ queryKey: ['master-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['master-audit-log'] });
      queryClient.invalidateQueries({ queryKey: ['system-alerts'] });
      toast({
        title: 'Empresa excluída',
        description: 'A empresa foi removida do ecossistema e registrada no log de auditoria.',
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

  const impersonatePendingId = impersonate.isPending ? impersonate.variables?.id ?? '__any__' : null;
  const togglePendingId = toggleStatus.isPending ? toggleStatus.variables?.id ?? '__any__' : null;
  const deletePendingId = deleteCompany.isPending ? deleteCompany.variables?.id ?? '__any__' : null;

  const { reset: resetImpersonate } = impersonate;
  const { reset: resetToggleStatus } = toggleStatus;
  const { reset: resetDeleteCompany } = deleteCompany;

  // Limpa alvos de confirmação, estados pendentes de mutation e bloqueios de DOM em cada transição de rota
  useEffect(() => {
    setConfirmTarget(null);
    setDeleteTarget(null);
    resetImpersonate();
    resetToggleStatus();
    resetDeleteCompany();
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';

    return () => {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    };
  }, [location.pathname, resetImpersonate, resetToggleStatus, resetDeleteCompany]);

  const actionsRef = useRef({});
  actionsRef.current = {
    navigate,
    impersonateMutate: impersonate.mutate,
    toggleStatusMutate: toggleStatus.mutate,
    setConfirmTarget,
    setDeleteTarget,
  };

  // Definição de Colunas TanStack Table (referência estável evita desmontagem dos botões durante re-renders)
  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Empresa / Tenant',
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-[#DBEAFE] dark:border-blue-800/40 flex items-center justify-center font-bold text-xs flex-shrink-0">
                <Building className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-[#171827] dark:text-white truncate">
                  {c.name}
                </div>
                {c.owner_email && (
                  <div className="text-xs text-[#55596A] dark:text-[#8F9BBF] truncate font-medium">
                    {c.owner_email}
                  </div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'slug',
        header: 'Slug / Domínio Público',
        cell: ({ row }) => {
          const c = row.original;
          return c.slug ? (
            <a
              href={`/agendar/${c.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#2563EB] dark:text-blue-400 hover:underline font-semibold font-mono"
            >
              <Globe className="w-3.5 h-3.5 text-[#59658F]" strokeWidth={1.75} />
              <span>/agendar/{c.slug}</span>
            </a>
          ) : (
            <span className="text-xs text-[#55596A] dark:text-[#8F9BBF]">—</span>
          );
        },
      },
      {
        id: 'plan',
        header: 'Plano & Preço',
        cell: ({ row }) => {
          const c = row.original;
          const pricing =
            c.subscription_pricing ||
            calculateSubscriptionPrice({
              planName: c.plan_name,
              basePrice: c.plan_price,
              activeUnitsCount: c.active_units_count,
              extraBranchesCount: c.extra_branches_count,
            });

          return (
            <div className="flex flex-col gap-0.5">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 w-fit ${
                  pricing.isExclusivo
                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40'
                    : 'bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border-[#DBEAFE] dark:border-blue-800/40'
                }`}
              >
                {c.plan_name || 'Starter'}
              </span>
              <span className="text-xs font-bold text-[#171827] dark:text-white tabular-nums mt-0.5">
                {pricing.formattedTotalPrice}/mês
              </span>
              {pricing.isExclusivo && pricing.extraBranches > 0 && (
                <span className="text-[10px] text-[#55596A] dark:text-[#8F9BBF] font-normal leading-tight tabular-nums">
                  +{pricing.extraBranches} filial(is)
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'billing',
        header: 'Status de Cobrança',
        cell: ({ row }) => {
          const c = row.original;
          const subStatusKey = resolveSubscriptionStatus(c);
          const subCfg = subscriptionStatusConfig[subStatusKey] || subscriptionStatusConfig.ACTIVE;

          return (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${subCfg.color}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
              {subCfg.label}
            </span>
          );
        },
      },
      {
        accessorKey: 'onboarding_completed',
        header: 'Onboarding',
        cell: ({ row }) => {
          const c = row.original;
          return c.onboarding_completed ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle className="w-4 h-4 text-emerald-500" strokeWidth={1.75} />
              <span>Concluído</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold tabular-nums">
              <Clock className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
              <span>Etapa {c.onboarding_step || 1}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Acesso',
        cell: ({ row }) => {
          const c = row.original;
          const cfg = statusConfig[c.status] || statusConfig.active;
          return (
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center ${cfg.color}`}>
              {cfg.label}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Ações Corporativas',
        cell: ({ row }) => {
          const c = row.original;
          const isBlockedOrInactive = c.status === 'blocked' || c.status === 'inactive';
          return (
            <div className="relative z-10 flex items-center gap-1.5 flex-wrap">
              {/* Botão Detalhes */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!c?.id) return;
                  actionsRef.current.navigate(`/master/barbearias/${c.id}`);
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg font-bold bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 hover:bg-[#DBEAFE] border border-[#DBEAFE] dark:border-blue-800/40 inline-flex items-center gap-1 transition-colors cursor-pointer active:scale-[0.98] touch-manipulation select-none"
                title="Painel e auditoria desta barbearia"
              >
                <ExternalLink className="w-3.5 h-3.5 pointer-events-none" strokeWidth={1.75} />
                <span className="pointer-events-none">Detalhes</span>
              </button>

              {/* Botão Impersonar / Visualizar */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!c?.id) return;
                  actionsRef.current.impersonateMutate(c);
                }}
                disabled={Boolean(impersonatePendingId)}
                className="text-xs px-2.5 py-1.5 rounded-lg font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800/40 inline-flex items-center gap-1 disabled:opacity-50 transition-colors cursor-pointer active:scale-[0.98] touch-manipulation select-none"
                title="Acessar com permissão assistida (15min)"
              >
                {impersonatePendingId === c.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin pointer-events-none" strokeWidth={1.75} />
                ) : (
                  <Eye className="w-3.5 h-3.5 pointer-events-none" strokeWidth={1.75} />
                )}
                <span className="pointer-events-none">Acessar</span>
              </button>

              {/* Botão Bloquear / Ativar */}
              <button
                type="button"
                disabled={Boolean(togglePendingId)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!c?.id) return;
                  if (!isBlockedOrInactive) {
                    actionsRef.current.setConfirmTarget(c);
                  } else {
                    actionsRef.current.toggleStatusMutate({ id: c.id, nextStatus: 'active' });
                  }
                }}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-bold disabled:opacity-50 inline-flex items-center gap-1 transition-colors border cursor-pointer active:scale-[0.98] touch-manipulation select-none ${
                  !isBlockedOrInactive
                    ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 border-red-200 dark:border-red-800/40'
                    : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border-emerald-200 dark:border-emerald-800/40'
                }`}
              >
                {togglePendingId === c.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin pointer-events-none" strokeWidth={1.75} />
                ) : !isBlockedOrInactive ? (
                  <Lock className="w-3 h-3 pointer-events-none" strokeWidth={1.75} />
                ) : (
                  <Unlock className="w-3 h-3 pointer-events-none" strokeWidth={1.75} />
                )}
                <span className="pointer-events-none">{!isBlockedOrInactive ? 'Bloquear' : 'Ativar'}</span>
              </button>

              {/* Botão Apagar / Excluir */}
              <button
                type="button"
                disabled={Boolean(deletePendingId)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!c?.id) return;
                  actionsRef.current.setDeleteTarget(c);
                }}
                aria-label={`Apagar ${c.name || 'empresa'}`}
                title="Exclusão permanente (requer confirmação de segurança)"
                className="text-xs px-2 py-1.5 rounded-lg font-bold bg-slate-100 dark:bg-slate-800 text-[#55596A] dark:text-slate-300 hover:text-red-600 hover:bg-red-50 border border-[#E5E7EF] dark:border-slate-700 inline-flex items-center justify-center gap-1 disabled:opacity-50 transition-colors cursor-pointer active:scale-[0.98] touch-manipulation select-none"
              >
                {deletePendingId === c.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin pointer-events-none" strokeWidth={1.75} />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 pointer-events-none" strokeWidth={1.75} />
                )}
                <span className="pointer-events-none sr-only sm:not-sr-only">Apagar</span>
              </button>
            </div>
          );
        },
      },
    ],
    [impersonatePendingId, togglePendingId, deletePendingId]
  );

  // Instância do TanStack Table
  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row, idx) => String(row?.id || idx),
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="bg-[#FFFFFF] dark:bg-[#171827] rounded-2xl border border-[#E5E7EF] dark:border-[#232538] overflow-hidden shadow-sm min-w-0">
      {/* Header da Tabela com Barra de Pesquisa */}
      <div className="p-4 sm:p-5 border-b border-[#E5E7EF] dark:border-[#232538] flex items-center justify-between gap-3 flex-wrap bg-[#FFFFFF] dark:bg-[#171827]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#59658F]/10 text-[#59658F] dark:text-[#B5D7E8] flex items-center justify-center font-bold">
            <Building2 className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="font-extrabold text-[#171827] dark:text-white text-base tracking-tight">
              Parque de Barbearias Cadastradas
            </h2>
            <p className="text-[11px] text-[#55596A] dark:text-[#8F9BBF] font-medium leading-none mt-0.5">
              Gestão de tenants, planos, links públicos e permissões de acesso
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#59658F]" strokeWidth={1.75} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome, e-mail ou slug…"
            className="pl-9 pr-3 py-2 border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-xs w-full sm:w-64 bg-[#F8FAFC] dark:bg-[#131422] text-[#171827] dark:text-white placeholder:text-[#55596A]/50 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 transition-all font-medium"
          />
        </div>
      </div>

      {/* Visualização em Cards Responsivos para Mobile e Tablet (< lg) */}
      <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:gap-4 md:p-4">
        {isLoading && (
          <div className="col-span-full p-8 text-center text-xs text-[#55596A] dark:text-[#8F9BBF] font-semibold flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" strokeWidth={1.75} />
            <span>Carregando barbearias…</span>
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="col-span-full p-8 text-center text-xs text-[#55596A] dark:text-[#8F9BBF]">
            Nenhuma barbearia encontrada.
          </div>
        )}

        {!isLoading && items.map((c) => {
          const subStatusKey = resolveSubscriptionStatus(c);
          const subCfg = subscriptionStatusConfig[subStatusKey] || subscriptionStatusConfig.ACTIVE;
          const cfg = statusConfig[c.status] || statusConfig.active;
          const pricing =
            c.subscription_pricing ||
            calculateSubscriptionPrice({
              planName: c.plan_name,
              basePrice: c.plan_price,
              activeUnitsCount: c.active_units_count,
              extraBranchesCount: c.extra_branches_count,
            });

          return (
            <div key={c.id} className="p-4 space-y-3 bg-[#FFFFFF] dark:bg-[#171827] md:rounded-xl md:border md:border-[#E5E7EF] md:dark:border-[#232538]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-[#DBEAFE] dark:border-blue-800/40 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    <Building className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-[#171827] dark:text-white truncate">
                      {c.name}
                    </div>
                    {c.owner_email && (
                      <div className="text-xs text-[#55596A] dark:text-[#8F9BBF] truncate font-medium">
                        {c.owner_email}
                      </div>
                    )}
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-[#F8FAFC] dark:bg-[#131422] p-2.5 rounded-xl border border-[#E5E7EF] dark:border-[#232538]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#55596A] dark:text-[#8F9BBF] block">Plano & Preço</span>
                  <span className="font-bold text-[#171827] dark:text-white tabular-nums">{pricing.formattedTotalPrice}/mês</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#55596A] dark:text-[#8F9BBF] block">Cobrança</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${subCfg.color}`}>
                    {subCfg.label}
                  </span>
                </div>
              </div>

              {c.slug && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Globe className="w-3.5 h-3.5 text-[#59658F] shrink-0" strokeWidth={1.75} />
                  <a
                    href={`/agendar/${c.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#2563EB] dark:text-blue-400 hover:underline font-mono truncate"
                  >
                    /agendar/{c.slug}
                  </a>
                </div>
              )}

              {/* Botões de Ação Móvel */}
              {(() => {
                const isBlockedOrInactive = c.status === 'blocked' || c.status === 'inactive';
                return (
                  <div className="relative z-10 grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!c?.id) return;
                        navigate(`/master/barbearias/${c.id}`);
                      }}
                      className="text-xs py-2.5 px-3 rounded-lg font-bold bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-[#DBEAFE] dark:border-blue-800/40 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer touch-manipulation select-none"
                    >
                      <ExternalLink className="w-3.5 h-3.5 pointer-events-none" strokeWidth={1.75} />
                      <span className="pointer-events-none">Detalhes</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!c?.id) return;
                        impersonate.mutate(c);
                      }}
                      disabled={impersonate.isPending}
                      className="text-xs py-2.5 px-3 rounded-lg font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer touch-manipulation select-none"
                    >
                      {impersonatePendingId === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin pointer-events-none" strokeWidth={1.75} />
                      ) : (
                        <Eye className="w-3.5 h-3.5 pointer-events-none" strokeWidth={1.75} />
                      )}
                      <span className="pointer-events-none">Acessar</span>
                    </button>
                    <button
                      type="button"
                      disabled={toggleStatus.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!c?.id) return;
                        if (!isBlockedOrInactive) setConfirmTarget(c);
                        else toggleStatus.mutate({ id: c.id, nextStatus: 'active' });
                      }}
                      className={`text-xs py-2.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 border disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer touch-manipulation select-none ${
                        !isBlockedOrInactive
                          ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/40'
                          : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40'
                      }`}
                    >
                      {togglePendingId === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin pointer-events-none" strokeWidth={1.75} />
                      ) : !isBlockedOrInactive ? (
                        <Lock className="w-3.5 h-3.5 pointer-events-none" strokeWidth={1.75} />
                      ) : (
                        <Unlock className="w-3.5 h-3.5 pointer-events-none" strokeWidth={1.75} />
                      )}
                      <span className="pointer-events-none">{!isBlockedOrInactive ? 'Bloquear' : 'Ativar'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={deleteCompany.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!c?.id) return;
                        setDeleteTarget(c);
                      }}
                      aria-label={`Apagar ${c.name || 'empresa'}`}
                      className="text-xs py-2.5 px-3 rounded-lg font-bold bg-slate-100 dark:bg-slate-800 text-[#55596A] dark:text-slate-300 hover:text-red-600 border border-[#E5E7EF] dark:border-slate-700 flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer touch-manipulation select-none"
                    >
                      {deletePendingId === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin pointer-events-none" strokeWidth={1.75} />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 pointer-events-none" strokeWidth={1.75} />
                      )}
                      <span className="pointer-events-none">Apagar</span>
                    </button>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Tabela TanStack em Telas Grandes (lg+) */}
      <div
        className="hidden lg:block overflow-x-auto overscroll-x-contain"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
      >
        <table className="w-full min-w-[940px] text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-[#E5E7EF] dark:border-[#232538] bg-[#F1F2F7]/60 dark:bg-[#131422]"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-[11px] font-bold text-[#55596A] dark:text-[#8F9BBF] uppercase tracking-wider"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[#E5E7EF]/70 dark:divide-[#232538]/70">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-[#F8FAFC] dark:hover:bg-white/[0.02] transition-colors duration-150"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3.5 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}

            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#59658F] mb-2">
                      <Building2 className="w-6 h-6" strokeWidth={1.75} />
                    </div>
                    <div className="font-bold text-sm text-[#171827] dark:text-white">
                      Nenhuma barbearia encontrada
                    </div>
                    <div className="text-xs text-[#55596A] dark:text-[#8F9BBF] mt-1">
                      {search
                        ? 'Nenhum resultado corresponde aos termos da pesquisa.'
                        : 'Ainda não há empresas cadastradas no sistema.'}
                    </div>
                  </div>
                </td>
              </tr>
            )}

            {isLoading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs text-[#55596A] dark:text-[#8F9BBF] font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" strokeWidth={1.75} />
                    <span>Carregando dados das barbearias…</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação Executiva */}
      <div className="px-4 py-3 border-t border-[#E5E7EF] dark:border-[#232538] flex items-center justify-between text-xs bg-[#F8FAFC] dark:bg-[#131422]">
        <div className="flex items-center gap-2 text-[#55596A] dark:text-[#8F9BBF] font-semibold tabular-nums">
          <span>
            Total: <strong className="text-[#171827] dark:text-white">{total}</strong>{' '}
            {total === 1 ? 'barbearia cadastrada' : 'barbearias cadastradas'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-1.5 rounded-lg border border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827] disabled:opacity-40 hover:bg-[#F1F2F7] dark:hover:bg-[#232538] transition-colors text-[#171827] dark:text-white touch-manipulation cursor-pointer"
            aria-label="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <span className="text-[#55596A] dark:text-[#8F9BBF] font-bold tabular-nums px-1">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg border border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827] disabled:opacity-40 hover:bg-[#F1F2F7] dark:hover:bg-[#232538] transition-colors text-[#171827] dark:text-white touch-manipulation cursor-pointer"
            aria-label="Próxima página"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Diálogos de Segurança Destrutiva */}
      <ConfirmDestructiveDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => confirmTarget && toggleStatus.mutate({ id: confirmTarget.id, nextStatus: 'blocked' })}
        title={`Bloquear "${confirmTarget?.name || ''}"?`}
        description="A empresa perde imediatamente o acesso à plataforma. A ação é registrada com assinatura criptográfica no log de auditoria."
        expectedText={confirmTarget?.name || ''}
        confirmLabel="Bloquear empresa"
        isLoading={toggleStatus.isPending}
      />

      <ConfirmDestructiveDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteCompany.mutate(deleteTarget)}
        title={`EXCLUIR "${deleteTarget?.name || ''}" PERMANENTEMENTE?`}
        description="Esta ação é IRREVERSÍVEL. Serão apagados em cascata todos os agendamentos, clientes, profissionais, movimentações financeiras e equipes vinculadas ao tenant."
        expectedText={deleteTarget?.name || ''}
        confirmLabel="Excluir tudo permanentemente"
        isLoading={deleteCompany.isPending}
      />
    </div>
  );
}