// Ranking por profissional dentro do caixa aberto.
// Mostra faturamento, qtd atendimentos, ticket médio e métodos de pagamento.

import { Scissors } from 'lucide-react';
import { getPaymentMethodIcon } from '@/lib/cashRegister';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

export default function CaixaProfessionalBreakdown({ rows }) {
  if (!rows?.length) return null;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden mb-5">
      <div className="px-5 py-3 border-b border-white/8 bg-white/[0.02]">
        <div className="text-[11px] uppercase tracking-wider font-bold text-white/55">Performance por profissional</div>
      </div>
      <div className="divide-y divide-white/5">
        {rows.map((p, idx) => {
          const methodIcons = Object.keys(p.methods || {}).slice(0, 4);
          return (
            <div key={p.professional_id} className="flex items-center gap-3 p-4 hover:bg-white/[0.04] transition-colors">
              <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] ring-1 ring-white/15 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-[0_4px_12px_rgba(37,99,235,0.4)]">
                <span className="absolute inset-0 rounded-full bg-[#60A5FA]/30 blur-md opacity-60" aria-hidden="true" />
                <span className="relative">{idx + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Scissors className="w-3 h-3 text-white/45 flex-shrink-0" />
                  <span className="font-semibold text-sm text-white truncate">{p.professional_name}</span>
                </div>
                <div className="text-xs text-white/55 flex items-center gap-3 mt-0.5 flex-wrap">
                  <span>{p.appointments} atend.</span>
                  <span>Ticket {fmt(p.ticket_avg)}</span>
                  {methodIcons.length > 0 && (
                    <span className="flex gap-0.5">{methodIcons.map(m => <span key={m}>{getPaymentMethodIcon(m)}</span>)}</span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-black bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">{fmt(p.revenue)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}