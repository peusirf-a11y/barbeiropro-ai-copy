// Tabela comparativa de performance por unidade.
// Aparece apenas quando o usuário está em modo "Todas as unidades" e há 2+ unidades.
// Calcula KPIs (agendamentos, concluídos, receita, ticket médio, taxa de cancelamento)
// para cada unidade no período já filtrado.

import { Building2, Trophy } from 'lucide-react';

function calcUnitMetrics(unitId, appointments, financial) {
  const unitAppts = appointments.filter(a => (a.unit_id || null) === (unitId || null));
  const unitFinancial = financial.filter(f => (f.unit_id || null) === (unitId || null));
  const completed = unitAppts.filter(a => a.status === 'concluido');
  const cancelled = unitAppts.filter(a => a.status === 'cancelado');

  const finRevenue = unitFinancial.filter(f => f.type === 'entrada').reduce((s, f) => s + (f.amount || 0), 0);
  const apptRevenue = completed.reduce((s, a) => s + (a.price || 0), 0);
  const revenue = finRevenue || apptRevenue;
  const avgTicket = completed.length > 0 ? revenue / completed.length : 0;
  const cancelRate = unitAppts.length > 0 ? (cancelled.length / unitAppts.length) * 100 : 0;

  return {
    appts: unitAppts.length,
    completed: completed.length,
    revenue,
    avgTicket,
    cancelRate,
  };
}

export default function UnitBreakdownTable({ units, appointments, financial }) {
  if (!units || units.length < 2) return null;

  const rows = units.map(u => ({
    id: u.id,
    name: u.name,
    is_default: u.is_default,
    ...calcUnitMetrics(u.id, appointments, financial),
  }));

  // Ranking pelo maior faturamento
  const maxRevenue = Math.max(...rows.map(r => r.revenue), 0);
  const topId = rows.find(r => r.revenue === maxRevenue && maxRevenue > 0)?.id;

  // Totais consolidados
  const totals = rows.reduce((acc, r) => ({
    appts: acc.appts + r.appts,
    completed: acc.completed + r.completed,
    revenue: acc.revenue + r.revenue,
  }), { appts: 0, completed: 0, revenue: 0 });
  const totalsTicket = totals.completed > 0 ? totals.revenue / totals.completed : 0;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 sm:p-6 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-4 h-4 text-[#93C5FD]" />
        <h2 className="font-bold text-white">Comparativo por unidade</h2>
      </div>
      <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-white/55 border-b border-white/8">
              <th className="pb-2 pr-3">Unidade</th>
              <th className="pb-2 px-3 text-right">Agendamentos</th>
              <th className="pb-2 px-3 text-right">Concluídos</th>
              <th className="pb-2 px-3 text-right">Receita</th>
              <th className="pb-2 px-3 text-right">Ticket médio</th>
              <th className="pb-2 pl-3 text-right">Cancel.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-white/[0.04] transition-colors">
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.id === topId && <Trophy className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />}
                    <span className="font-semibold text-white truncate">{r.name}</span>
                    {r.is_default && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/65 bg-white/[0.06] border border-white/10 px-1.5 py-0.5 rounded flex-shrink-0">Matriz</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3 text-right text-white font-medium">{r.appts}</td>
                <td className="py-3 px-3 text-right text-emerald-300 font-semibold">{r.completed}</td>
                <td className="py-3 px-3 text-right text-white font-bold">R${r.revenue.toFixed(0)}</td>
                <td className="py-3 px-3 text-right text-white/65">R${r.avgTicket.toFixed(0)}</td>
                <td className="py-3 pl-3 text-right">
                  <span className={`text-xs font-semibold ${r.cancelRate >= 20 ? 'text-rose-300' : r.cancelRate >= 10 ? 'text-amber-300' : 'text-white/55'}`}>
                    {r.cancelRate.toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-white/10 bg-white/[0.02]">
              <td className="py-3 pr-3 font-bold text-white">Total consolidado</td>
              <td className="py-3 px-3 text-right font-bold text-white">{totals.appts}</td>
              <td className="py-3 px-3 text-right font-bold text-emerald-300">{totals.completed}</td>
              <td className="py-3 px-3 text-right font-bold text-white">R${totals.revenue.toFixed(0)}</td>
              <td className="py-3 px-3 text-right font-bold text-white/65">R${totalsTicket.toFixed(0)}</td>
              <td className="py-3 pl-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}