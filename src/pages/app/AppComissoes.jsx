import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useState } from 'react';
import { DollarSign, Check, Percent, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EmptyState from '@/components/EmptyState';
import { SkeletonPage } from '@/components/Skeletons';

export default function AppComissoes() {
  const { companyId, isLoading: loadingCompany } = useCompany();
  const [period, setPeriod] = useState('this_month');
  const [filterPro, setFilterPro] = useState('all');
  const queryClient = useQueryClient();

  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ['commissions', companyId],
    queryFn: () => base44.entities.Commission.filter({ company_id: companyId }, '-earned_at', 1000),
    enabled: !!companyId,
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals', companyId],
    queryFn: () => base44.entities.Professional.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const payMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map(id => base44.entities.Commission.update(id, { status: 'pago' }))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commissions', companyId] }),
  });

  const now = new Date();
  const inPeriod = (c) => {
    const d = new Date(c.earned_at);
    if (period === 'this_month') return d >= startOfMonth(now) && d <= endOfMonth(now);
    if (period === 'last_month') { const lm = subMonths(now, 1); return d >= startOfMonth(lm) && d <= endOfMonth(lm); }
    return true;
  };

  const filtered = commissions.filter(c => inPeriod(c) && (filterPro === 'all' || c.professional_id === filterPro));

  // Resumo por profissional
  const byPro = {};
  filtered.forEach(c => {
    if (!byPro[c.professional_id]) byPro[c.professional_id] = { id: c.professional_id, name: c.professional_name, total: 0, pendente: 0, count: 0, ids_pendentes: [] };
    const row = byPro[c.professional_id];
    row.total += c.amount || 0;
    row.count += 1;
    if (c.status === 'pendente') {
      row.pendente += c.amount || 0;
      row.ids_pendentes.push(c.id);
    }
  });
  const summary = Object.values(byPro).sort((a, b) => b.total - a.total);
  const grandTotal = filtered.reduce((s, c) => s + (c.amount || 0), 0);
  const grandPending = filtered.filter(c => c.status === 'pendente').reduce((s, c) => s + (c.amount || 0), 0);

  if (loadingCompany || isLoading) {
    return <AppLayout><SkeletonPage /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-[#0F172A]">Comissões</h1>
            <p className="text-gray-500 text-sm mt-1">Cálculo automático ao concluir atendimentos</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterPro} onChange={e => setFilterPro(e.target.value)} className="px-3 py-2 border border-black/10 rounded-lg text-sm bg-white">
              <option value="all">Todos os profissionais</option>
              {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-2 border border-black/10 rounded-lg text-sm bg-white">
              <option value="this_month">Este mês</option>
              <option value="last_month">Mês passado</option>
              <option value="all">Todo o período</option>
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-black/8 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-[#2563EB]/10 rounded-xl flex items-center justify-center"><DollarSign className="w-4 h-4 text-[#2563EB]" /></div>
              <span className="text-sm font-medium text-gray-500">Total apurado</span>
            </div>
            <div className="text-2xl font-black text-[#0F172A]">R$ {grandTotal.toFixed(2)}</div>
            <div className="text-xs text-gray-400 mt-1">{filtered.length} atendimentos</div>
          </div>
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center"><Percent className="w-4 h-4 text-amber-600" /></div>
              <span className="text-sm font-medium text-amber-700">A pagar</span>
            </div>
            <div className="text-2xl font-black text-amber-900">R$ {grandPending.toFixed(2)}</div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/8">
            <EmptyState
              icon={DollarSign}
              title="Nenhuma comissão no período"
              description="Comissões são geradas automaticamente quando um agendamento é marcado como concluído. Configure a comissão de cada profissional na tela de Profissionais."
            />
          </div>
        ) : (
          <>
            {/* Resumo por profissional */}
            <div className="bg-white rounded-2xl border border-black/8 overflow-hidden mb-6">
              <div className="px-5 py-3 border-b border-black/5 text-xs font-bold uppercase tracking-wide text-gray-500">Por profissional</div>
              <div className="divide-y divide-black/5">
                {summary.map(row => (
                  <div key={row.id} className="flex items-center gap-4 p-4 flex-wrap">
                    <div className="w-9 h-9 bg-[#2563EB]/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-[#2563EB]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[#0F172A] truncate">{row.name || '–'}</div>
                      <div className="text-xs text-gray-400">{row.count} atendimentos</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-[#0F172A]">R$ {row.total.toFixed(2)}</div>
                      {row.pendente > 0 && <div className="text-xs text-amber-600 font-semibold">R$ {row.pendente.toFixed(2)} pendente</div>}
                    </div>
                    {row.ids_pendentes.length > 0 && (
                      <button onClick={() => { if (confirm(`Marcar ${row.ids_pendentes.length} comissões de ${row.name} como pagas?`)) payMutation.mutate(row.ids_pendentes); }}
                        className="bg-[#2563EB] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#1d4ed8] flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />Marcar como pago
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Detalhe */}
            <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
              <div className="px-5 py-3 border-b border-black/5 text-xs font-bold uppercase tracking-wide text-gray-500">Detalhamento</div>
              <div className="divide-y divide-black/5 max-h-[500px] overflow-y-auto">
                {filtered.map(c => (
                  <div key={c.id} className="flex items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-[#0F172A] truncate">{c.service_name || '–'}</div>
                      <div className="text-xs text-gray-400">
                        {c.professional_name} · {format(new Date(c.earned_at), "d MMM yyyy", { locale: ptBR })}
                        {' · '}{c.commission_type === 'percent' ? `${c.commission_value}% de R$ ${c.service_price?.toFixed(2)}` : `valor fixo`}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-[#0F172A]">R$ {c.amount?.toFixed(2)}</div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${c.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {c.status === 'pago' ? 'Pago' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}