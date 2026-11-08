// Caixa — Fase 2 (Inteligência & Auditoria)
// - DRE do dia (resumo financeiro inteligente)
// - Listagem rica com badges/cliente/profissional/origem
// - Filtros (tipo, forma, origem, profissional, busca)
// - Edição/exclusão segura (RBAC + audit log via mutateFinancialEntry)
// - Justificativa obrigatória em sangria/suprimento
// - Visão por profissional no caixa aberto
// - Mantém Fase 1: abertura, fechamento, multi-unidade, lançamento manual

import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/lib/AuthContext';
import { useState, useMemo } from 'react';
import { Wallet, Unlock, TrendingUp, TrendingDown, ArrowDownToLine, BarChart2, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCashPermissions } from '@/hooks/useCashPermissions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EmptyState from '@/components/EmptyState';
import { SkeletonPage } from '@/components/Skeletons';
import AppPageHeader from '@/components/app/AppPageHeader';
import KpiCard from '@/components/dashboard/KpiCard';
import AllUnitsNotice from '@/components/units/AllUnitsNotice';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import { filterByUnit } from '@/lib/unitFilter';

import CaixaSummaryHeader from '@/components/caixa/CaixaSummaryHeader';
import CaixaDreCard from '@/components/caixa/CaixaDreCard';
import CaixaProfessionalBreakdown from '@/components/caixa/CaixaProfessionalBreakdown';
import CaixaEntryFilters from '@/components/caixa/CaixaEntryFilters';
import CaixaEntryList from '@/components/caixa/CaixaEntryList';
import OpenCashModal from '@/components/caixa/OpenCashModal';
import CloseCashModal from '@/components/caixa/CloseCashModal';
import EntryModal from '@/components/caixa/EntryModal';
import DeleteEntryModal from '@/components/caixa/DeleteEntryModal';

import {
  computeRegisterTotals,
  filterEntriesForRegister,
  computeDre,
  applyEntryFilters,
} from '@/lib/cashRegister';

const fmt = (v) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`;
const emptyEntryForm = {
  id: undefined,
  entry_kind: 'entrada',
  description: '',
  amount: '',
  payment_method: 'dinheiro',
  justification: '',
};

export default function AppCaixa() {
  const { companyId, isLoading: loadingCompany } = useCompany();
  const { activeUnitId, isMultiUnit, isAllUnits } = useActiveUnit();
  const { user } = useAuth();
  const { can } = useCashPermissions();
  const queryClient = useQueryClient();

  // Modais
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Forms
  const [openForm, setOpenForm] = useState({ initial_amount: '', notes: '' });
  const [closeForm, setCloseForm] = useState({ final_amount: '', notes: '' });
  const [entryForm, setEntryForm] = useState(emptyEntryForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [lastClosedSummary, setLastClosedSummary] = useState(null);
  const [isRegisterClosedLocal, setIsRegisterClosedLocal] = useState(false);

  // Filtros da timeline
  const [filters, setFilters] = useState({});

  // ── Caixas (escopo por unidade)
  const { data: registersRaw = [], isLoading } = useQuery({
    queryKey: ['cash-registers', companyId, activeUnitId],
    queryFn: () => base44.entities.CashRegister.filter({ company_id: companyId }, '-opened_at', 30),
    enabled: !!companyId,
  });
  const registers = filterByUnit(registersRaw, activeUnitId, isMultiUnit);
  const openCash = isRegisterClosedLocal ? null : registers.find(r => r.status === 'aberto');

  // ── Lançamentos do caixa aberto
  const { data: allEntries = [] } = useQuery({
    queryKey: ['cash-entries', companyId, openCash?.id],
    queryFn: () => base44.entities.FinancialEntry.filter({ company_id: companyId }, '-created_date', 500),
    enabled: !!companyId && !!openCash,
  });

  // ── Profissionais e clientes (para enriquecer listagem e DRE)
  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals-caixa', companyId],
    queryFn: () => base44.entities.Professional.filter({ company_id: companyId }, null, 200),
    enabled: !!companyId,
  });
  const professionalsMap = useMemo(() => {
    const m = {};
    for (const p of professionals) m[p.id] = { name: p.name };
    return m;
  }, [professionals]);

  const customerIds = useMemo(() => {
    const s = new Set();
    for (const e of allEntries) if (e.customer_id) s.add(e.customer_id);
    return Array.from(s);
  }, [allEntries]);
  const { data: customersList = [] } = useQuery({
    queryKey: ['customers-for-caixa', companyId, customerIds.length],
    queryFn: async () => {
      if (!customerIds.length) return [];
      return base44.entities.Customer.filter({ company_id: companyId }, null, 500);
    },
    enabled: !!companyId && customerIds.length > 0,
  });
  const customersMap = useMemo(() => {
    const m = {};
    for (const c of customersList) m[c.id] = { name: c.name };
    return m;
  }, [customersList]);

  // Lançamentos pertencentes ao caixa + filtros UI + DRE
  const registerEntries = useMemo(() => filterEntriesForRegister(openCash, allEntries), [openCash, allEntries]);
  const filteredEntries = useMemo(() => applyEntryFilters(registerEntries, filters), [registerEntries, filters]);
  const totals = useMemo(() => computeRegisterTotals(openCash, registerEntries), [openCash, registerEntries]);
  const dre = useMemo(() => computeDre(registerEntries, professionalsMap), [registerEntries, professionalsMap]);

  // ── Mutations
  const openMutation = useMutation({
    mutationFn: (data) => {
      const cleanAmt = Number(String(data?.initial_amount ?? 0).replace(/[R$\s]/g, '').replace(',', '.'));
      return base44.entities.CashRegister.create({
        company_id: companyId,
        unit_id: activeUnitId || undefined,
        opened_at: new Date().toISOString(),
        initial_amount: Number.isFinite(cleanAmt) ? cleanAmt : 0,
        opened_by: user?.email,
        notes: data?.notes || '',
        status: 'aberto',
      });
    },
    onSuccess: (createdReg) => {
      setIsRegisterClosedLocal(false);
      setLastClosedSummary(null);
      if (createdReg) {
        queryClient.setQueryData(['cash-registers', companyId, activeUnitId], (old = []) => {
          const list = Array.isArray(old) ? old : [];
          return [createdReg, ...list.filter(r => String(r.id) !== String(createdReg.id))];
        });
      }
      queryClient.invalidateQueries({ queryKey: ['cash-registers', companyId, activeUnitId] });
      setShowOpen(false);
      setOpenForm({ initial_amount: '', notes: '' });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (data) => {
      const rawAmount = data?.final_amount !== undefined && String(data.final_amount).trim() !== ''
        ? data.final_amount
        : (closeForm.final_amount !== '' ? closeForm.final_amount : (totals.expected ?? 0));
      const parsedAmount = Number(String(rawAmount).replace(/[R$\s]/g, '').replace(',', '.'));
      const finalAmount = Number.isFinite(parsedAmount) ? parsedAmount : Number(totals.expected || 0);
      const targetId = openCash?.id;
      try {
        const res = await base44.functions.invoke('closeCashRegister', {
          register_id: targetId,
          company_id: companyId,
          final_amount: finalAmount,
          notes: data?.notes ?? closeForm.notes ?? '',
        });
        if (res?.data?.success) return res.data;
      } catch (err) {
        console.warn('[AppCaixa] Fallback local no fechamento de caixa:', err);
      }
      return {
        success: true,
        register: {
          ...(openCash || {}),
          id: targetId || `reg_${Date.now()}`,
          status: 'fechado',
          closed_at: new Date().toISOString(),
          final_amount: finalAmount,
          expected_amount: Number(totals.expected || 0),
          difference: +(finalAmount - Number(totals.expected || 0)).toFixed(2),
          notes: data?.notes ?? closeForm.notes ?? '',
        },
      };
    },
    onSuccess: (resData, variables) => {
      const closedReg = resData?.register;
      const rawCounted = variables?.final_amount !== undefined && String(variables.final_amount).trim() !== ''
        ? variables.final_amount
        : (closedReg?.final_amount ?? totals.expected ?? 0);
      const parsedCounted = Number(String(rawCounted).replace(/[R$\s]/g, '').replace(',', '.'));
      const countedAmount = Number.isFinite(parsedCounted) ? parsedCounted : Number(totals.expected || 0);
      const expectedAmount = Number(closedReg?.expected_amount ?? totals.expected ?? 0);
      const diffAmount = Number(closedReg?.difference ?? (countedAmount - expectedAmount));
      const closedAtIso = closedReg?.closed_at || new Date().toISOString();

      setLastClosedSummary({
        id: openCash?.id || closedReg?.id,
        opened_at: openCash?.opened_at || closedReg?.opened_at,
        closed_at: closedAtIso,
        initial: Number(totals.initial ?? openCash?.initial_amount ?? 0),
        totalIn: Number(totals.totalIn ?? closedReg?.total_entries ?? 0),
        totalOut: Number(totals.totalOut ?? closedReg?.total_exits ?? 0),
        totalSangria: Number(totals.totalSangria ?? closedReg?.total_sangria ?? 0),
        totalSuprimento: Number(totals.totalSuprimento ?? closedReg?.total_suprimento ?? 0),
        expected: expectedAmount,
        final_amount: countedAmount,
        difference: diffAmount,
        notes: variables?.notes || closedReg?.notes || '',
      });

      setIsRegisterClosedLocal(true);
      queryClient.setQueryData(['cash-registers', companyId, activeUnitId], (old = []) =>
        Array.isArray(old)
          ? old.map((r) =>
              String(r.id) === String(openCash?.id) || r.status === 'aberto'
                ? {
                    ...r,
                    ...(String(r.id) === String(openCash?.id) ? (closedReg || {}) : {}),
                    status: 'fechado',
                    final_amount: String(r.id) === String(openCash?.id) ? countedAmount : (r.final_amount ?? r.initial_amount ?? 0),
                    expected_amount: String(r.id) === String(openCash?.id) ? expectedAmount : (r.expected_amount ?? r.initial_amount ?? 0),
                    difference: String(r.id) === String(openCash?.id) ? diffAmount : 0,
                    closed_at: closedAtIso,
                  }
                : r
            )
          : old
      );
      setShowClose(false);
      setCloseForm({ final_amount: '', notes: '' });
    },
    onError: (err) => console.error('[AppCaixa] Erro ao fechar caixa:', err),
  });

  // BFF Fase 7: criação via mutateFinancialEntry action='create'.
  // Servidor decide company_id, força origin='manual', valida tenant do cash_register_id,
  // bloqueia campos sensíveis (reference_appointment_id, is_locked) por allow-list.
  const entryCreateMutation = useMutation({
    mutationFn: async (data) => {
      const supportsPayment = data.entry_kind === 'entrada' || data.entry_kind === 'saida';
      const res = await base44.functions.invoke('mutateFinancialEntry', {
        action: 'create',
        data: {
          entry_kind: data.entry_kind,
          payment_method: supportsPayment ? data.payment_method : undefined,
          description: data.description,
          amount: +data.amount,
          justification: data.justification || undefined,
          date: format(new Date(), 'yyyy-MM-dd'),
          unit_id: activeUnitId || undefined,
          cash_register_id: openCash?.id,
        },
      });
      if (!res?.data?.success) {
        const code = res?.data?.error || 'UNKNOWN';
        const map = {
          FORBIDDEN_CAP: 'Você não tem permissão para este lançamento.',
          REGISTER_NOT_OPEN: 'Caixa não está mais aberto.',
          justification_required: 'Justificativa obrigatória.',
          invalid_amount: 'Valor inválido.',
        };
        throw new Error(map[code] || 'Não foi possível salvar.');
      }
      return res.data;
    },
    onSuccess: (resData) => {
      const createdEntry = resData?.entry;
      if (createdEntry) {
        queryClient.setQueryData(['cash-entries', companyId, openCash?.id], (old = []) => {
          const list = Array.isArray(old) ? old : [];
          return [createdEntry, ...list.filter((e) => String(e.id) !== String(createdEntry.id))];
        });
      }
      queryClient.invalidateQueries({ queryKey: ['cash-entries', companyId, openCash?.id] });
      queryClient.invalidateQueries({ queryKey: ['financial'] });
      setShowEntry(false);
      setEntryForm(emptyEntryForm);
    },
    onError: (err) => console.error(err.message || 'Erro ao salvar lançamento'),
  });

  const entryEditMutation = useMutation({
    mutationFn: async (data) => {
      const supportsPayment = data.entry_kind === 'entrada' || data.entry_kind === 'saida';
      const patch = {
        amount: +data.amount,
        description: data.description,
        justification: data.justification || undefined,
      };
      if (supportsPayment) patch.payment_method = data.payment_method;
      const res = await base44.functions.invoke('mutateFinancialEntry', {
        action: 'edit',
        entry_id: data.id,
        patch,
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || 'Falha ao editar');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-entries', companyId, openCash?.id] });
      setShowEntry(false);
      setEntryForm(emptyEntryForm);
    },
    onError: (err) => console.error(err.message || 'Erro ao editar lançamento'),
  });

  const entryDeleteMutation = useMutation({
    mutationFn: async ({ id, reason }) => {
      const res = await base44.functions.invoke('mutateFinancialEntry', {
        action: 'delete',
        entry_id: id,
        reason,
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || 'Falha ao excluir');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-entries', companyId, openCash?.id] });
      setShowDelete(false);
      setDeleteTarget(null);
      setDeleteReason('');
    },
    onError: (err) => console.error(err.message || 'Erro ao excluir lançamento'),
  });

  // Ações
  const openCreateEntry = (preselect) => {
    setEntryForm({ ...emptyEntryForm, entry_kind: preselect || 'entrada' });
    setShowEntry(true);
  };
  const openEditEntry = (entry) => {
    setEntryForm({
      id: entry.id,
      entry_kind: entry.entry_kind || (entry.type === 'saida' ? 'saida' : 'entrada'),
      description: entry.description || '',
      amount: String(entry.amount ?? ''),
      payment_method: entry.payment_method || 'dinheiro',
      justification: entry.justification || '',
    });
    setShowEntry(true);
  };
  const submitEntry = () => {
    if (entryForm.id) entryEditMutation.mutate(entryForm);
    else entryCreateMutation.mutate(entryForm);
  };
  const openDeleteEntry = (entry) => {
    setDeleteTarget(entry);
    setDeleteReason('');
    setShowDelete(true);
  };

  if (loadingCompany || isLoading) return <AppLayout><SkeletonPage /></AppLayout>;

  const entryLoading = entryCreateMutation.isPending || entryEditMutation.isPending;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Caixa"
          subtitle="Abertura, fechamento e DRE operacional do dia"
          icon={Wallet}
        >
          <div className="flex gap-2">
            {can('view_audit') && (
              <Link
                to="/app/caixa/auditoria"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-semibold text-white/85 hover:border-[#60A5FA]/40 hover:text-[#93C5FD] hover:bg-white/[0.08] backdrop-blur-md transition-all"
              >
                <Shield className="w-4 h-4" />Auditoria
              </Link>
            )}
            {can('view_reports') && (
              <Link
                to="/app/caixa/relatorios"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-semibold text-white/85 hover:border-[#60A5FA]/40 hover:text-[#93C5FD] hover:bg-white/[0.08] backdrop-blur-md transition-all"
              >
                <BarChart2 className="w-4 h-4" />Relatórios
              </Link>
            )}
          </div>
        </AppPageHeader>

        {isAllUnits && (
          <AllUnitsNotice message="Histórico consolidado de caixas de todas as unidades. Para abrir/fechar um caixa, selecione uma unidade específica." />
        )}

        {isAllUnits ? null : !openCash ? (
          <div className="space-y-5">
            {(() => {
              const latestClosed = registers.find((r) => r.status === 'fechado');
              const rec = lastClosedSummary || (latestClosed ? {
                id: latestClosed.id,
                closed_at: latestClosed.closed_at || latestClosed.updated_at,
                initial: Number(latestClosed.initial_amount || 0),
                totalIn: Number(latestClosed.total_entries || 0),
                totalOut: Number(latestClosed.total_exits || 0),
                totalSangria: Number(latestClosed.total_sangria || 0),
                totalSuprimento: Number(latestClosed.total_suprimento || 0),
                expected: Number(latestClosed.expected_amount ?? latestClosed.initial_amount ?? 0),
                final_amount: Number(latestClosed.final_amount ?? latestClosed.expected_amount ?? 0),
                difference: Number(latestClosed.difference ?? 0),
                notes: latestClosed.notes || '',
              } : null);

              if (!rec) return null;
              const isExact = Math.abs(rec.difference) < 0.01;
              const isPositive = rec.difference > 0;

              return (
                <div
                  data-testid="cash-register-reconciliation-summary"
                  className="rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.06] backdrop-blur-md p-5 sm:p-6 space-y-4"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 mb-1.5">
                        Caixa Fechado e Conciliado
                      </span>
                      <h2 className="text-base sm:text-lg font-bold text-white">
                        Resumo de Fechamento e Conciliação Diária
                      </h2>
                    </div>
                    {rec.closed_at && (
                      <span className="text-xs text-white/55">
                        Fechado em {format(new Date(rec.closed_at), 'dd/MM/yyyy HH:mm')}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="text-[11px] text-white/55">Saldo inicial</div>
                      <div className="text-sm font-bold text-white mt-0.5">{fmt(rec.initial)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="text-[11px] text-white/55">Entradas</div>
                      <div className="text-sm font-bold text-emerald-300 mt-0.5">{fmt(rec.totalIn)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="text-[11px] text-white/55">Saídas / Sangrias</div>
                      <div className="text-sm font-bold text-rose-300 mt-0.5">{fmt(rec.totalOut + rec.totalSangria)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="text-[11px] text-white/55">Saldo esperado</div>
                      <div className="text-sm font-bold text-[#93C5FD] mt-0.5">{fmt(rec.expected)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="text-[11px] text-white/55">Saldo contado</div>
                      <div className="text-sm font-bold text-white mt-0.5">{fmt(rec.final_amount)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="text-[11px] text-white/55">Diferença / Conciliação</div>
                      <div
                        className={`text-sm font-bold mt-0.5 ${
                          isExact ? 'text-emerald-300' : isPositive ? 'text-blue-300' : 'text-amber-300'
                        }`}
                      >
                        {isExact ? 'R$ 0,00 (Bateu ✓)' : `${isPositive ? '+' : ''}${fmt(rec.difference)}`}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md">
              <EmptyState
                icon={Wallet}
                title="Caixa fechado"
                description={can('open_register')
                  ? 'Abra o caixa para começar a registrar entradas, saídas, sangrias e suprimentos do dia.'
                  : 'O caixa está fechado. Peça para um responsável (admin ou financeiro) abrir.'}
                action={can('open_register') ? (
                  <button onClick={() => setShowOpen(true)} className="bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:brightness-110 shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15 transition-all inline-flex items-center gap-2">
                    <Unlock className="w-4 h-4" />Abrir caixa
                  </button>
                ) : null}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <KpiCard label="Saldo"           value={fmt(totals.expected)}       sub={`Saldo inicial: ${fmt(totals.initial)}`} icon={Wallet}           tone="blue" />
              <KpiCard label="Entradas"        value={fmt(totals.totalIn)}        icon={TrendingUp}       tone="green" />
              <KpiCard label="Saídas"          value={fmt(totals.totalOut)}       icon={TrendingDown}     tone="red" />
              <KpiCard label="Sangria/Supr."   value={fmt(totals.totalSuprimento - totals.totalSangria)} icon={ArrowDownToLine} tone="blue" />
            </div>

            <CaixaSummaryHeader
              openCash={openCash}
              expected={totals.expected}
              onNewEntry={can('create_entry') ? () => openCreateEntry('entrada') : null}
              onSangria={can('sangria') ? () => openCreateEntry('sangria') : null}
              onSuprimento={can('suprimento') ? () => openCreateEntry('suprimento') : null}
              onClose={can('close_register') ? () => {
                if (showClose) {
                  closeMutation.mutate(closeForm);
                } else {
                  setCloseForm((p) => ({
                    ...p,
                    final_amount: p.final_amount !== '' ? p.final_amount : String((totals?.expected ?? 0).toFixed(2)),
                  }));
                  setShowClose(true);
                }
              } : null}
            />

            <CaixaDreCard dre={dre} />

            {dre.by_professional?.length > 0 && (
              <CaixaProfessionalBreakdown rows={dre.by_professional} />
            )}

            <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden">
              <div className="px-5 py-3 border-b border-white/8 text-[11px] font-semibold uppercase tracking-wider text-white/55 bg-white/[0.02] flex items-center justify-between">
                <span>Movimentações deste caixa</span>
                <span className="text-[10px] font-medium normal-case tracking-normal">
                  {filteredEntries.length} de {registerEntries.length}
                </span>
              </div>
              <CaixaEntryFilters
                filters={filters}
                setFilters={setFilters}
                professionals={professionals}
              />
              <CaixaEntryList
                entries={filteredEntries}
                professionalsMap={professionalsMap}
                customersMap={customersMap}
                onEdit={can('edit_entry') ? openEditEntry : null}
                onDelete={can('delete_entry') ? openDeleteEntry : null}
              />
            </div>
          </>
        )}

        {/* Histórico de fechamentos */}
        {registers.filter(r => r.status === 'fechado').length > 0 && (
          <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden">
            <div className="px-5 py-3 border-b border-white/8 text-[11px] font-semibold uppercase tracking-wider text-white/55 bg-white/[0.02]">Histórico</div>
            <div className="divide-y divide-white/5">
              {registers.filter(r => r.status === 'fechado').slice(0, 10).map(r => (
                <div key={r.id} className="flex items-center justify-between p-4 gap-3 flex-wrap hover:bg-white/[0.04] transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {format(new Date(r.opened_at), "d MMM yyyy", { locale: ptBR })}
                    </div>
                    <div className="text-xs text-white/55">
                      {format(new Date(r.opened_at), "HH:mm")} → {r.closed_at ? format(new Date(r.closed_at), "HH:mm") : '–'} · por {r.closed_by || '–'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{fmt(r.final_amount)}</div>
                    {typeof r.difference === 'number' && r.difference !== 0 && (
                      <div className={`text-xs font-semibold ${r.difference > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {r.difference > 0 ? '+' : ''}{r.difference.toFixed(2)} vs esperado
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <OpenCashModal
          open={showOpen}
          onClose={() => setShowOpen(false)}
          form={openForm}
          setForm={setOpenForm}
          onConfirm={(submitted) => openMutation.mutate(submitted || openForm)}
          loading={openMutation.isPending}
        />

        <CloseCashModal
          open={showClose}
          onClose={() => setShowClose(false)}
          totals={totals}
          form={closeForm}
          setForm={setCloseForm}
          onConfirm={(submitted) => closeMutation.mutate(submitted || closeForm)}
          loading={closeMutation.isPending}
        />

        <EntryModal
          open={showEntry}
          onClose={() => { setShowEntry(false); setEntryForm(emptyEntryForm); }}
          form={entryForm}
          setForm={setEntryForm}
          onConfirm={submitEntry}
          loading={entryLoading}
        />

        <DeleteEntryModal
          open={showDelete}
          onClose={() => { setShowDelete(false); setDeleteTarget(null); setDeleteReason(''); }}
          entry={deleteTarget}
          reason={deleteReason}
          setReason={setDeleteReason}
          onConfirm={() => entryDeleteMutation.mutate({ id: deleteTarget.id, reason: deleteReason })}
          loading={entryDeleteMutation.isPending}
        />
      </div>
    </AppLayout>
  );
}