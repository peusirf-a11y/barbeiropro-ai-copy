import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AppFinanceiro() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'entrada', description: '', amount: '', category: 'Atendimento', date: format(new Date(), 'yyyy-MM-dd') });
  const queryClient = useQueryClient();

  const { data: financial = [] } = useQuery({
    queryKey: ['financial'],
    queryFn: () => base44.entities.FinancialEntry.list('-date', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FinancialEntry.create({ ...data, amount: +data.amount }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['financial'] }); setShowForm(false); setForm({ type: 'entrada', description: '', amount: '', category: 'Atendimento', date: format(new Date(), 'yyyy-MM-dd') }); },
  });

  const entradas = financial.filter(f => f.type === 'entrada');
  const saidas = financial.filter(f => f.type === 'saida');
  const totalEntradas = entradas.reduce((s, f) => s + f.amount, 0);
  const totalSaidas = saidas.reduce((s, f) => s + f.amount, 0);

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#1B1C1E]">Financeiro</h1>
            <p className="text-gray-500 text-sm mt-1">Controle de entradas e saídas</p>
          </div>
          <button onClick={() => setShowForm(true)} className="bg-[#1B3A4B] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#1B3A4B]/90 transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" />Lançamento
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-black/8 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Entradas</span>
            </div>
            <div className="text-3xl font-black text-[#1B1C1E]">R${totalEntradas.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-2xl border border-black/8 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <span className="text-sm font-medium text-gray-500">Saídas</span>
            </div>
            <div className="text-3xl font-black text-[#1B1C1E]">R${totalSaidas.toFixed(2)}</div>
          </div>
          <div className={`rounded-2xl border p-6 ${(totalEntradas - totalSaidas) >= 0 ? 'bg-[#1B3A4B] border-[#1B3A4B]' : 'bg-red-600 border-red-600'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-medium text-white/70">Saldo</span>
            </div>
            <div className="text-3xl font-black text-white">R${(totalEntradas - totalSaidas).toFixed(2)}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
          <div className="p-5 border-b border-black/8">
            <h2 className="font-bold text-[#1B1C1E]">Lançamentos</h2>
          </div>
          <div className="divide-y divide-black/5">
            {financial.map(entry => (
              <div key={entry.id} className="flex items-center gap-4 p-4 hover:bg-[#F8F7F3] transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${entry.type === 'entrada' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {entry.type === 'entrada' ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-[#1B1C1E]">{entry.description || entry.category}</div>
                  <div className="text-xs text-gray-400">{entry.category} · {entry.date ? format(new Date(entry.date), "d MMM yyyy", { locale: ptBR }) : '–'}</div>
                </div>
                <div className={`text-sm font-bold ${entry.type === 'entrada' ? 'text-green-600' : 'text-red-500'}`}>
                  {entry.type === 'entrada' ? '+' : '-'}R${entry.amount?.toFixed(2)}
                </div>
              </div>
            ))}
            {financial.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">Nenhum lançamento registrado</div>
            )}
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-[#1B1C1E]">Novo Lançamento</h3>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Tipo</label>
                  <div className="flex gap-3">
                    {[{ v: 'entrada', l: 'Entrada' }, { v: 'saida', l: 'Saída' }].map(t => (
                      <button key={t.v} onClick={() => setForm(p => ({ ...p, type: t.v }))}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all ${form.type === t.v ? (t.v === 'entrada' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600') : 'border-black/10 text-gray-600'}`}>
                        {t.l}
                      </button>
                    ))}
                  </div>
                </div>
                {[
                  { label: 'Descrição', key: 'description', type: 'text' },
                  { label: 'Categoria', key: 'category', type: 'text' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">{f.label}</label>
                    <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A4B]/20" />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Valor (R$)</label>
                    <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A4B]/20" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Data</label>
                    <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A4B]/20" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium">Cancelar</button>
                <button onClick={() => createMutation.mutate(form)} disabled={!form.amount}
                  className="flex-1 px-4 py-2.5 bg-[#1B3A4B] text-white rounded-lg text-sm font-semibold hover:bg-[#1B3A4B]/90 disabled:opacity-50">Salvar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}