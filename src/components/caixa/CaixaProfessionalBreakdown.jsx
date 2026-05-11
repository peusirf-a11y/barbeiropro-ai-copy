// Ranking por profissional dentro do caixa aberto.
// Mostra faturamento, qtd atendimentos, ticket médio e métodos de pagamento.

import { Scissors } from 'lucide-react';
import { getPaymentMethodIcon } from '@/lib/cashRegister';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

export default function CaixaProfessionalBreakdown({ rows }) {
  if (!rows?.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] overflow-hidden mb-5">
      <div className="px-5 py-3 border-b border-black/5 bg-[#FAFBFC]">
        <div className="text-[11px] uppercase tracking-wider font-bold text-[#6B7280]">Performance por profissional</div>
      </div>
      <div className="divide-y divide-black/5">
        {rows.map((p, idx) => {
          const methodIcons = Object.keys(p.methods || {}).slice(0, 4);
          return (
            <div key={p.professional_id} className="flex items-center gap-3 p-4 hover:bg-[#FAFBFC] transition-colors">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Scissors className="w-3 h-3 text-[#6B7280] flex-shrink-0" />
                  <span className="font-semibold text-sm text-[#111827] truncate">{p.professional_name}</span>
                </div>
                <div className="text-xs text-[#6B7280] flex items-center gap-3 mt-0.5 flex-wrap">
                  <span>{p.appointments} atend.</span>
                  <span>Ticket {fmt(p.ticket_avg)}</span>
                  {methodIcons.length > 0 && (
                    <span className="flex gap-0.5">{methodIcons.map(m => <span key={m}>{getPaymentMethodIcon(m)}</span>)}</span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-black text-[#111827]">{fmt(p.revenue)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}