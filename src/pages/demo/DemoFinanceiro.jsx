/**
 * DemoFinanceiro — Cópia EXATA do AppFinanceiro com dados demo.
 * Apenas AppLayout → DemoLayout e dados reais → demoData.
 */
import DemoLayout from '@/components/layout/DemoLayout.jsx';
import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import KpiCard from '@/components/dashboard/KpiCard';
import FilterSelect from '@/components/ui/filter-select';
import StandardModal from '@/components/ui/standard-modal';
import MobileSelect from '@/components/ui/mobile-select';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { demoFinancial, demoAppointments } from '@/lib/demoData';
import { toast } from 'sonner';

const CATEGORIES_IN = ['Atendimento', 'Produto', 'Outros'];
const CATEGORIES_OUT = ['Aluguel', 'Produto/Insumos', 'Equipamento', 'Marketing', 'Folha de pagamento', 'Outros'];

export default function DemoFinanceiro() {
  const [financial, setFinancial] = useState(demoFinancial);
  const [period, setPeriod] = useState('this_month');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'entrada', description: '', amount: '', category: 'Atendimento', date: format(new Date(), 'yyyy-MM-dd'), status: 'confirmado' });

  const now = new Date();

  const filterByPeriod = (item, dateField = 'date') => {
    const d = new Date(item[dateField] + 'T00:00:00');
    if (period === 'this_month') return d >= startOfMonth(now) && d <= endOfMonth(now);
    if (period === 'last_month') { const lm = subMonths(now, 1); return d >= startOfMonth(lm) && d <= endOfMonth(lm); }
    return true;
  };

  const filtered = financial.filter(f => filterByPeriod(f));
  const entradas = filtered.filter(f => f.type === 'entrada');
  const saidas = filtered.filter(f => f.type === 'saida');
  const totalIn = entradas.reduce((s, f) => s + (f.amount || 0), 0);
  const totalOut = saidas.reduce((s, f) => s + (f.amount || 0), 0);
  const saldo = totalIn - totalOut;

  const apptRevenue = demoAppointments
    .filter(a => a.status === 'concluido')
    .reduce((s, a) => s + (a.price || 0), 0);

  const handleSave = () => {
    if (!form.amount || !form.date) return;
    setFinancial(prev => [...prev, {
      ...form,
      id: `f_demo_${Date.now()}`,
      amount: +form.amount,
      company_id: 'demo-company',
      origin: 'manual',
    }]);
    toast.success('Lançamento criado (modo demo)');
    setShowForm(false);
    setForm({ type: 'entrada', description: '', amount: '', category: 'Atendimento', date: format(new Date(), 'yyyy-MM-dd'), status: 'confirmado' });
  };

  const handleDelete = (id) => {
    if (confirm('Excluir lançamento?')) {
      setFinancial(prev => prev.filter(f => f.id !== id));
      toast.success('Lançamento excluído (modo demo)');
    }
  };

  return (
    <DemoLayout>
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
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs p-1 transition-opacity"
                  >
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
              <button onClick={handleSave} disabled={!form.amount || !form.date}
                className="flex-1 min-h-[48px] px-4 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] active:scale-[0.98] disabled:opacity-50 transition-all">
                Salvar
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
    </DemoLayout>
  );
}