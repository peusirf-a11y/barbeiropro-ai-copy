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
import { Wallet, Unlock, TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine, BarChart2, Shield } from 'lucide-react';
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
  ENTRY_KINDS,
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

  // Filtros da timeline
  const [filters, setFilters] = useState({});

  // ── Caixas (escopo por unidade) — via BFF listCashRegisters (tenant-safe)
  const { data: registersRaw = [], isLoading } = useQuery({
    queryKey: ['cash-registers', companyId, activeUnitId],
    queryFn: async () => {
      const res = await base44.functions.invoke('listCashRegisters', {
        active_unit_id: activeUnitId || undefined,
        limit: 50,
      });
      return res?.data?.registers || [];
    },
    enabled: !!companyId,
  });
  // BFF listCashRegisters já aplica unit scoping server-side
  const registers = registersRaw;
  const openCash = registers.find(r => r.status === 'aberto' || r.status === 'fechando');

  // ── Lançamentos do caixa aberto — via BFF listFinancialEntries (tenant-safe)
  const { data: allEntries = [] } = useQuery({
    queryKey: ['cash-entries', companyId, openCash?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('listFinancialEntries', {
        cash_register_id: openCash.id,
        limit: 500,
        sort: '-created_date',
      });
      return res?.data?.entries || [];
    },
    enabled: !!companyId && !!openCash?.id,
  });

  // ── Profissionais e clientes (para enriquecer listagem e DRE) — via BFF
  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals-caixa', companyId, activeUnitId],
    queryFn: async () => {
      const res = await base44.functions.invoke('listProfessionals', {
        active_unit_id: activeUnitId || undefined,
        active_only: true,
      });
      return res?.data?.professionals || [];
    },
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
      // BFF: listCustomers (tenant-safe)
      const res = await base44.functions.invoke('listCustomers', { limit: 500 });
      return res?.data?.customers || [];
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
    mutationFn: async (data) => {
      const res = await base44.functions.invoke('mutateCashRegister', {
        action: 'open',
        unit_id: activeUnitId || undefined,
        initial_amount: +data.initial_amount || 0,
        notes: data.notes,
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || 'Falha ao abrir caixa');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-registers', companyId, activeUnitId] });
      setShowOpen(false);
      setOpenForm({ initial_amount: '', notes: '' });
    },
    onError: (err) => alert(err.message || 'Erro ao abrir caixa'),
  });

  const closeMutation = useMutation({
    mutationFn: async (data) => {
      const res = await base44.functions.invoke('closeCashRegister', {
        register_id: openCash.id,
        final_amount: +data.final_amount || 0,
        notes: data.notes,
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || 'Falha ao fechar caixa');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-registers', companyId, activeUnitId] });
      setShowClose(false);
      setCloseForm({ final_amount: '', notes: '' });
    },
    onError: (err) => alert(err.message || 'Erro ao fechar caixa'),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-entries', companyId, openCash?.id] });
      setShowEntry(false);
      setEntryForm(emptyEntryForm);
    },
    onError: (err) => alert(err.message || 'Erro ao salvar lançamento'),
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
    onError: (err) => alert(err.message || 'Erro ao editar lançamento'),
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
    onError: (err) => alert(err.message || 'Erro ao excluir lançamento'),
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
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-black/10 text-sm font-semibold text-[#111827] hover:border-[#2563EB] hover:text-[#2563EB]"
              >
                <Shield className="w-4 h-4" />Auditoria
              </Link>
            )}
            {can('view_reports') && (
              <Link
                to="/app/caixa/relatorios"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-black/10 text-sm font-semibold text-[#111827] hover:border-[#2563EB] hover:text-[#2563EB]"
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
          <div className="bg-white rounded-2xl border border-black/8">
            <EmptyState
              icon={Wallet}
              title="Caixa fechado"
              description={can('open_register')
                ? 'Abra o caixa para começar a registrar entradas, saídas, sangrias e suprimentos do dia.'
                : 'O caixa está fechado. Peça para um responsável (admin ou financeiro) abrir.'}
              action={can('open_register') ? (
                <button onClick={() => setShowOpen(true)} className="bg-[#2563EB] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#1d4ed8] inline-flex items-center gap-2">
                  <Unlock className="w-4 h-4" />Abrir caixa
                </button>
              ) : null}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <KpiCard label="Saldo inicial"   value={fmt(totals.initial)}        icon={Wallet}           tone="blue" />
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
              onClose={can('close_register') ? () => setShowClose(true) : null}
            />

            <CaixaDreCard dre={dre} />

            {dre.by_professional?.length > 0 && (
              <CaixaProfessionalBreakdown rows={dre.by_professional} />
            )}

            <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
              <div className="px-5 py-3 border-b border-black/5 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] bg-[#FAFBFC] flex items-center justify-between">
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
          <div className="mt-6 bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
            <div className="px-5 py-3 border-b border-black/5 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] bg-[#FAFBFC]">Histórico</div>
            <div className="divide-y divide-black/5">
              {registers.filter(r => r.status === 'fechado').slice(0, 10).map(r => (
                <div key={r.id} className="flex items-center justify-between p-4 gap-3 flex-wrap hover:bg-[#FAFBFC] transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-[#111827]">
                      {format(new Date(r.opened_at), "d MMM yyyy", { locale: ptBR })}
                    </div>
                    <div className="text-xs text-[#6B7280]">
                      {format(new Date(r.opened_at), "HH:mm")} → {r.closed_at ? format(new Date(r.closed_at), "HH:mm") : '–'} · por {r.closed_by || '–'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#111827]">{fmt(r.final_amount)}</div>
                    {typeof r.difference === 'number' && r.difference !== 0 && (
                      <div className={`text-xs font-semibold ${r.difference > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
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
          onConfirm={() => openMutation.mutate(openForm)}
          loading={openMutation.isPending}
        />

        <CloseCashModal
          open={showClose}
          onClose={() => setShowClose(false)}
          totals={totals}
          form={closeForm}
          setForm={setCloseForm}
          onConfirm={() => closeMutation.mutate(closeForm)}
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