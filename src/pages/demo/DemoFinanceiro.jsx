/**
 * DemoFinanceiro — Réplica exata do AppFinanceiro com dados demo.
 * Mesmos KPIs, mesmo gráfico RevenueChart, mesma tabela de lançamentos.
 */
import DemoLayout from '@/components/layout/DemoLayout.jsx';
import { demoFinancial } from '@/lib/demoData';
import { TrendingUp, TrendingDown, DollarSign, Plus, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { toast } from 'sonner';
import RevenueChart from '@/components/dashboard/RevenueChart';
import KpiCard from '@/components/dashboard/KpiCard';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';

const PAYMENT_LABELS = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_credito: 'Cartão Crédito',
  cartao_debito: 'Cartão Débito',
  link_pagamento: 'Link Pagamento',
};

export default function DemoFinanceiro() {
  const [typeFilter, setTypeFilter] = useState('all');

  const demo = () =>
    toast.info('Ação disponível na conta real. Crie sua conta grátis!', { duration: 2500 });

  const entradas = demoFinancial.filter(f => f.type === 'entrada');
  const saidas = demoFinancial.filter(f => f.type === 'saida');
  const totalEntradas = entradas.reduce((s, f) => s + f.amount, 0);
  const totalSaidas = saidas.reduce((s, f) => s + f.amount, 0);
  const saldo = totalEntradas - totalSaidas;

  const filtered = typeFilter === 'all'
    ? demoFinancial
    : demoFinancial.filter(f => f.type === typeFilter);

  return (
    <DemoLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <AppPageHeader
          title="Financeiro"
          subtitle="Visão do período atual"
          icon={DollarSign}
        >
          <PrimaryButton onClick={demo}>Lançamento manual</PrimaryButton>
        </AppPageHeader>

        {/* KPI Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <KpiCard label="Entradas" value={`R$ ${totalEntradas.toFixed(2).replace('.', ',')}`} icon={TrendingUp}   tone="green" sub="Receitas do período" />
          <KpiCard label="Saídas"   value={`R$ ${totalSaidas.toFixed(2).replace('.', ',')}`}  icon={TrendingDown} tone="red"   sub="Despesas do período" />
          <KpiCard label="Saldo"    value={`R$ ${saldo.toFixed(2).replace('.', ',')}`}          icon={DollarSign}  tone={saldo >= 0 ? 'green' : 'red'} sub="Resultado líquido" />
        </div>

        {/* Gráfico */}
        <div className="mb-6">
          <RevenueChart financial={demoFinancial} />
        </div>

        {/* Tabela de lançamentos */}
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="p-4 border-b border-black/5 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-bold text-[#1B1C1E]">Lançamentos recentes</h2>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              {['all', 'entrada', 'saida'].map(v => (
                <button
                  key={v}
                  onClick={() => setTypeFilter(v)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${typeFilter === v ? 'bg-[#2563EB] text-white border-transparent' : 'bg-white border-black/10 text-gray-600 hover:border-[#2563EB]'}`}
                >
                  {v === 'all' ? 'Todos' : v === 'entrada' ? 'Entradas' : 'Saídas'}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-black/5">
            {filtered.map(entry => (
              <div
                key={entry.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#FAFBFC] transition-colors cursor-pointer"
                onClick={demo}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${entry.type === 'entrada' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {entry.type === 'entrada'
                    ? <TrendingUp className="w-4 h-4 text-green-600" />
                    : <TrendingDown className="w-4 h-4 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-[#1B1C1E] truncate">{entry.description}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {entry.category}
                    {entry.payment_method && ` · ${PAYMENT_LABELS[entry.payment_method] || entry.payment_method}`}
                    {' · '}
                    {format(new Date(entry.date), "d MMM yyyy", { locale: ptBR })}
                  </div>
                </div>
                <div className={`text-sm font-bold flex-shrink-0 ${entry.type === 'entrada' ? 'text-green-600' : 'text-red-500'}`}>
                  {entry.type === 'entrada' ? '+' : '-'}R$ {entry.amount.toFixed(2).replace('.', ',')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DemoLayout>
  );
}