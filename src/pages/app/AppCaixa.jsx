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
import { Wallet, Unlock, TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';
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

  // ── Caixas (escopo por unidade)
  const { data: registersRaw = [], isLoading } = useQuery({
    queryKey: ['cash-registers', companyId, activeUnitId],
    queryFn: () => base44.entities.CashRegister.filter({ company_id: companyId }, '-opened_at', 30),
    enabled: !!companyId,
  });
  const registers = filterByUnit(registersRaw, activeUnitId, isMultiUnit);
  const openCash = registers.find(r => r.status === 'aberto');

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
    mutationFn: (data) => base44.entities.CashRegister.create({
      company_id: companyId,
      unit_id: activeUnitId || undefined,
      opened_at: new Date().toISOString(),
      initial_amount: +data.initial_amount || 0,
      opened_by: user?.email,
      notes: data.notes,
      status: 'aberto',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-registers', companyId, activeUnitId] });
      setShowOpen(false);
      setOpenForm({ initial_amount: '', notes: '' });
    },
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

  const entryCreateMutation = useMutation({
    mutationFn: (data) => {
      const kindMeta = ENTRY_KINDS.find(k => k.value === data.entry_kind) || ENTRY_KINDS[0];
      const supportsPayment = data.entry_kind === 'entrada' || data.entry_kind === 'saida';
      return base44.entities.FinancialEntry.create({
        company_id: companyId,
        unit_id: activeUnitId || undefined,
        cash_register_id: openCash?.id,
        type: kindMeta.contabilType,
        entry_kind: data.entry_kind,
        origin: 'manual',
        payment_method: supportsPayment ? data.payment_method : undefined,
        description: data.description,
        category: data.entry_kind === 'sangria' ? 'Sangria'
                : data.entry_kind === 'suprimento' ? 'Suprimento'
                : (kindMeta.contabilType === 'entrada' ? 'Atendimento' : 'Outros'),
        amount: +data.amount,
        justification: data.justification || undefined,
        date: format(new Date(), 'yyyy-MM-dd'),
        status: 'confirmado',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-entries', companyId, openCash?.id] });
      setShowEntry(false);
      setEntryForm(emptyEntryForm);
    },
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
          <Link
            to="/app/caixa/relatorios"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-black/10 text-sm font-semibold text-[#111827] hover:border-[#2563EB] hover:text-[#2563EB]"
          >
            <BarChart2 className="w-4 h-4" />Ver relatórios
          </Link>
        </AppPageHeader>

        {isAllUnits && (
          <AllUnitsNotice message="Histórico consolidado de caixas de todas as unidades. Para abrir/fechar um caixa, selecione uma unidade específica." />
        )}

        {isAllUnits ? null : !openCash ? (
          <div className="bg-white rounded-2xl border border-black/8">
            <EmptyState
              icon={Wallet}
              title="Caixa fechado"
              description="Abra o caixa para começar a registrar entradas, saídas, sangrias e suprimentos do dia."
              action={
                <button onClick={() => setShowOpen(true)} className="bg-[#2563EB] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#1d4ed8] inline-flex items-center gap-2">
                  <Unlock className="w-4 h-4" />Abrir caixa
                </button>
              }
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
              onNewEntry={() => openCreateEntry('entrada')}
              onSangria={() => openCreateEntry('sangria')}
              onSuprimento={() => openCreateEntry('suprimento')}
              onClose={() => setShowClose(true)}
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
                onEdit={openEditEntry}
                onDelete={openDeleteEntry}
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