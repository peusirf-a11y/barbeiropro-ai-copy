import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Plus, X, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SkeletonPage } from '@/components/Skeletons';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import KpiCard from '@/components/dashboard/KpiCard';
import FinancialExport from '@/components/financeiro/FinancialExport';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import { filterByUnit } from '@/lib/unitFilter';

const CATEGORIES_IN = ['Atendimento', 'Produto', 'Outros'];
const CATEGORIES_OUT = ['Aluguel', 'Produto/Insumos', 'Equipamento', 'Marketing', 'Folha de pagamento', 'Outros'];

export default function AppFinanceiro() {
  const { companyId, company, isLoading: loadingCompany } = useCompany();
  const { activeUnitId, isMultiUnit } = useActiveUnit();
  const [showForm, setShowForm] = useState(false);
  const [period, setPeriod] = useState('this_month'); // 'this_month' | 'last_month' | 'all'
  const [form, setForm] = useState({ type: 'entrada', description: '', amount: '', category: 'Atendimento', date: format(new Date(), 'yyyy-MM-dd'), status: 'confirmado' });
  const queryClient = useQueryClient();

  const { data: financial = [], isLoading } = useQuery({
    queryKey: ['financial', companyId],
    queryFn: () => base44.entities.FinancialEntry.filter({ company_id: companyId }, '-date', 300),
    enabled: !!companyId,
  });

  // Also pull from completed appointments to auto-calculate revenue
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', companyId],
    queryFn: () => base44.entities.Appointment.filter({ company_id: companyId, status: 'concluido' }),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FinancialEntry.create({ ...data, company_id: companyId, unit_id: activeUnitId || undefined, amount: +data.amount }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['financial', companyId] }); setShowForm(false); setForm({ type: 'entrada', description: '', amount: '', category: 'Atendimento', date: format(new Date(), 'yyyy-MM-dd'), status: 'confirmado' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FinancialEntry.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial', companyId] }),
  });

  const now = new Date();
  const filterFn = (entry) => {
    const d = new Date(entry.date);
    if (period === 'this_month') return d >= startOfMonth(now) && d <= endOfMonth(now);
    if (period === 'last_month') { const lm = subMonths(now, 1); return d >= startOfMonth(lm) && d <= endOfMonth(lm); }
    return true;
  };

  // Filtra por unidade ativa antes de aplicar período
  const financialScoped = filterByUnit(financial, activeUnitId, isMultiUnit);
  const apptsScoped = filterByUnit(appointments, activeUnitId, isMultiUnit);

  const filtered = financialScoped.filter(filterFn);
  const entradas = filtered.filter(f => f.type === 'entrada');
  const saidas = filtered.filter(f => f.type === 'saida');
  const totalIn = entradas.reduce((s, f) => s + (f.amount || 0), 0);
  const totalOut = saidas.reduce((s, f) => s + (f.amount || 0), 0);
  const saldo = totalIn - totalOut;

  // Appointment revenue (not yet registered as financial entry)
  const apptRevenue = apptsScoped.filter(filterFn.bind(null)).reduce((s, a) => s + (a.price || 0), 0);

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
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="px-3 py-2.5 border border-black/10 rounded-xl text-sm bg-white focus:outline-none shadow-[var(--shadow-xs)]">
            <option value="this_month">Este mês</option>
            <option value="last_month">Mês passado</option>
            <option value="all">Todo o período</option>
          </select>
          <FinancialExport companyId={companyId} companyName={company?.name} />
          <PrimaryButton onClick={() => setShowForm(true)}>Lançamento</PrimaryButton>
        </AppPageHeader>

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
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-[#1B1C1E]">Novo Lançamento</h3>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
              </div>
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
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none">
                    {(form.type === 'entrada' ? CATEGORIES_IN : CATEGORIES_OUT).map(c => <option key={c}>{c}</option>)}
                  </select>
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
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium">Cancelar</button>
                <button onClick={() => createMutation.mutate(form)} disabled={!form.amount || !form.date || createMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#2563EB]/90 disabled:opacity-50">
                  {createMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}