import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Plus, X, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SkeletonPage } from '@/components/Skeletons';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import KpiCard from '@/components/dashboard/KpiCard';
import FinancialExport from '@/components/financeiro/FinancialExport';
import { useActiveUnit } from '@/hooks/useActiveUnit';

import AllUnitsNotice from '@/components/units/AllUnitsNotice';
import FilterSelect from '@/components/ui/filter-select';
import StandardModal from '@/components/ui/standard-modal';
import MobileSelect from '@/components/ui/mobile-select';
import { periodToRange, dateRangeFilter } from '@/lib/dateRangeQueries';

const CATEGORIES_IN = ['Atendimento', 'Produto', 'Outros'];
const CATEGORIES_OUT = ['Aluguel', 'Produto/Insumos', 'Equipamento', 'Marketing', 'Folha de pagamento', 'Outros'];

export default function AppFinanceiro() {
  const { companyId, company, isLoading: loadingCompany } = useCompany();
  const { activeUnitId, isMultiUnit, isAllUnits } = useActiveUnit();
  const [showForm, setShowForm] = useState(false);
  const [period, setPeriod] = useState('this_month'); // 'this_month' | 'last_month' | 'all'
  const [form, setForm] = useState({ type: 'entrada', description: '', amount: '', category: 'Atendimento', date: format(new Date(), 'yyyy-MM-dd'), status: 'confirmado' });
  const queryClient = useQueryClient();

  // A3: range é calculado no FRONTEND e passado como filtro no BACKEND.
  // Antes: `filter({company_id}, '-date', 300)` truncava silenciosamente em meses
  // com >300 lançamentos. Agora pegamos TUDO do período (limite alto: 5000).
  // Período "all" mantém comportamento antigo (sem range) — só para visão histórica.
  const range = periodToRange(period);
  const rangeFilter = dateRangeFilter('date', range, 'date');

  const { data: financial = [], isLoading } = useQuery({
    // queryKey inclui period: ao trocar período, refetcha com o range correto.
    queryKey: ['financial', companyId, activeUnitId, period],
    queryFn: async () => {
      const res = await base44.functions.invoke('listFinancialEntries', {
        active_unit_id: activeUnitId || undefined,
        from: range?.from ? range.from.toISOString().slice(0, 10) : undefined,
        to: range?.to ? range.to.toISOString().slice(0, 10) : undefined,
        limit: 5000,
      });
      return res?.data?.entries || [];
    },
    enabled: !!companyId,
    retry: 1,
  });

  // Receita de atendimentos concluídos no período. BFF Fase 4:
  // listAppointments filtra status=concluido + janela temporal no servidor.
  // Nota: o filtro é em scheduled_at (não completed_at — listAppointments usa
  // scheduled_at como eixo temporal). Para fins de KPI mensal, é equivalente
  // o suficiente (atendimento concluído tem scheduled_at próximo do completed_at).
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments-concluidos', companyId, activeUnitId, period],
    queryFn: async () => {
      const res = await base44.functions.invoke('listAppointments', {
        active_unit_id: activeUnitId,
        status: 'concluido',
        from: range?.from ? range.from.toISOString() : undefined,
        to: range?.to ? range.to.toISOString() : undefined,
        limit: 2000,
      });
      return res?.data?.appointments || [];
    },
    enabled: !!companyId,
  });

  // BFF Fase 7: create e delete via mutateFinancialEntry.
  // Servidor decide company_id e força origin='manual'. Delete usa soft-delete
  // (mantém audit trail). Reason genérica aqui — operador só clica "x".
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await base44.functions.invoke('mutateFinancialEntry', {
        action: 'create',
        data: {
          entry_kind: data.type === 'saida' ? 'saida' : 'entrada',
          description: data.description,
          category: data.category,
          amount: +data.amount,
          date: data.date,
          status: data.status,
          unit_id: activeUnitId || undefined,
        },
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || 'Falha ao salvar');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial'] });
      setShowForm(false);
      setForm({ type: 'entrada', description: '', amount: '', category: 'Atendimento', date: format(new Date(), 'yyyy-MM-dd'), status: 'confirmado' });
    },
    onError: (err) => alert(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await base44.functions.invoke('mutateFinancialEntry', {
        action: 'delete',
        entry_id: id,
        reason: 'Excluído pelo operador (Financeiro)',
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || 'Falha ao excluir');
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial'] }),
    onError: (err) => alert(err.message),
  });

  // BFF já filtrou por unit server-side — sem dupla filtragem no frontend.
  const financialScoped = financial;
  const apptsScoped = appointments; // BFF já filtrou

  const filtered = financialScoped;
  const entradas = filtered.filter(f => f.type === 'entrada');
  const saidas = filtered.filter(f => f.type === 'saida');
  const totalIn = entradas.reduce((s, f) => s + (f.amount || 0), 0);
  const totalOut = saidas.reduce((s, f) => s + (f.amount || 0), 0);
  const saldo = totalIn - totalOut;

  // Receita de atendimentos concluídos no período (já filtrado por completed_at no backend)
  const apptRevenue = apptsScoped.reduce((s, a) => s + (a.price || 0), 0);

  if (loadingCompany || isLoading) {
    return <AppLayout><SkeletonPage /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <AppPageHeader
          title="Financeiro"
          subtitle="Controle de entradas e saídas"
          icon={DollarSign}
        >
          <FilterSelect value={period} onChange={setPeriod} aria-label="Período">
            <option value="this_month">Este mês</option>
            <option value="last_month">Mês passado</option>
            <option value="all">Todo o período</option>
          </FilterSelect>
          <FinancialExport companyId={companyId} companyName={company?.name} />
          {!isAllUnits && <PrimaryButton onClick={() => setShowForm(true)}>Lançamento</PrimaryButton>}
        </AppPageHeader>

        {isAllUnits && (
          <AllUnitsNotice message="Visão financeira consolidada de todas as unidades. Para criar um novo lançamento, selecione uma unidade específica." />
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <KpiCard
            label="Entradas"
            value={`R$ ${totalIn.toFixed(2).replace('.', ',')}`}
            sub={`${entradas.length} lançamentos`}
            icon={TrendingUp}
            tone="green"
          />
          <KpiCard
            label="Saídas"
            value={`R$ ${totalOut.toFixed(2).replace('.', ',')}`}
            sub={`${saidas.length} lançamentos`}
            icon={TrendingDown}
            tone="red"
          />
          <KpiCard
            label="Saldo"
            value={`R$ ${saldo.toFixed(2).replace('.', ',')}`}
            sub={saldo >= 0 ? 'Resultado positivo' : 'Resultado negativo'}
            icon={DollarSign}
            tone={saldo >= 0 ? 'blue' : 'red'}
          />
        </div>

        {/* Appointments revenue hint */}
        {apptRevenue > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-800">Receita de atendimentos concluídos: R${apptRevenue.toFixed(2)}</p>
              <p className="text-xs text-blue-600">Valor calculado a partir dos agendamentos com status "concluído" no período</p>
            </div>
          </div>
        )}

        {/* Entries list */}
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="p-5 border-b border-black/5">
            <h2 className="font-bold text-[#111827]">Lançamentos</h2>
          </div>
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-[#6B7280]">
              <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum lançamento no período selecionado</p>
            </div>
          ) : (
            <div className="divide-y divide-black/5 max-h-[500px] overflow-y-auto">
              {filtered.map(entry => (
                <div key={entry.id} className="flex items-center gap-4 p-4 hover:bg-[#FAFBFC] transition-colors group">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${entry.type === 'entrada' ? 'bg-emerald-50 ring-1 ring-emerald-100' : 'bg-red-50 ring-1 ring-red-100'}`}>
                    {entry.type === 'entrada' ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[#111827] truncate">{entry.description || entry.category}</div>
                    <div className="text-xs text-[#6B7280]">{entry.category} · {entry.date ? format(new Date(entry.date + 'T00:00:00'), "d MMM yyyy", { locale: ptBR }) : '–'}</div>
                  </div>
                  <div className={`text-sm font-bold ${entry.type === 'entrada' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {entry.type === 'entrada' ? '+' : '-'}R${entry.amount?.toFixed(2)}
                  </div>
                  <button onClick={() => { if (confirm('Excluir lançamento?')) deleteMutation.mutate(entry.id); }}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs p-1 transition-opacity">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form modal */}
        <StandardModal
          open={showForm}
          onClose={() => setShowForm(false)}
          title="Novo Lançamento"
          footer={
            <>
              <button onClick={() => setShowForm(false)} className="flex-1 min-h-[48px] px-4 border border-black/10 rounded-xl text-sm font-medium hover:bg-gray-50 active:bg-gray-100">Cancelar</button>
              <button onClick={() => createMutation.mutate(form)} disabled={!form.amount || !form.date || createMutation.isPending}
                className="flex-1 min-h-[48px] px-4 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] active:scale-[0.98] disabled:opacity-50 transition-all">
                {createMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Tipo</label>
              <div className="flex gap-3">
                {[{ v: 'entrada', l: 'Entrada' }, { v: 'saida', l: 'Saída' }].map(t => (
                  <button key={t.v} onClick={() => setForm(p => ({ ...p, type: t.v, category: t.v === 'entrada' ? 'Atendimento' : 'Aluguel' }))}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all ${form.type === t.v ? (t.v === 'entrada' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600') : 'border-black/10 text-gray-600'}`}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Categoria</label>
              <MobileSelect value={form.category} onChange={v => setForm(p => ({ ...p, category: v }))}
                className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none">
                {(form.type === 'entrada' ? CATEGORIES_IN : CATEGORIES_OUT).map(c => <option key={c}>{c}</option>)}
              </MobileSelect>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Descrição</label>
              <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Ex: Corte Clássico - João Silva"
                className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Valor (R$) *</label>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Data *</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
              </div>
            </div>
          </div>
        </StandardModal>
      </div>
    </AppLayout>
  );
}