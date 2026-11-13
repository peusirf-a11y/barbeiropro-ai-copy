// Ranking por profissional dentro do caixa aberto
// Design System: Premium Business SaaS & Business Intelligence
import { Scissors } from 'lucide-react';
import { getPaymentMethodIcon } from '@/lib/cashRegister';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

export default function CaixaProfessionalBreakdown({ rows }) {
  if (!rows?.length) return null;

  return (
    <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] shadow-sm overflow-hidden mb-5">
      <div className="px-5 py-3.5 border-b border-[#E5E7EF] dark:border-[#232538] bg-[#F8FAFC] dark:bg-[#1C1E30] flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider font-bold text-[#59658F] dark:text-[#8F9BBF]">
          Performance por Profissional no Caixa
        </div>
        <span className="text-xs text-[#55596A] dark:text-[#8F9BBF] font-semibold">
          {rows.length} {rows.length === 1 ? 'profissional' : 'profissionais'}
        </span>
      </div>
      <div className="divide-y divide-[#E5E7EF] dark:divide-[#232538]">
        {rows.map((p, idx) => {
          const methodIcons = Object.keys(p.methods || {}).slice(0, 4);
          return (
            <div key={p.professional_id} className="flex items-center gap-3.5 p-4 hover:bg-[#F8FAFC] dark:hover:bg-[#1C1E30] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-[#DBEAFE] dark:border-blue-800/40 flex items-center justify-center font-black text-xs flex-shrink-0 tabular-nums">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-[#59658F] dark:text-[#8F9BBF] flex-shrink-0" strokeWidth={1.75} />
                  <span className="font-bold text-sm text-[#171827] dark:text-white truncate">{p.professional_name}</span>
                </div>
                <div className="text-xs text-[#55596A] dark:text-[#8F9BBF] flex items-center gap-3 mt-0.5 flex-wrap font-medium">
                  <span className="tabular-nums">{p.appointments} atendimentos</span>
                  <span>·</span>
                  <span>Ticket médio: <strong className="text-[#171827] dark:text-white tabular-nums font-semibold">{fmt(p.ticket_avg)}</strong></span>
                  {methodIcons.length > 0 && (
                    <span className="flex gap-1 ml-auto sm:ml-0">{methodIcons.map(m => <span key={m}>{getPaymentMethodIcon(m)}</span>)}</span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-base font-black text-[#171827] dark:text-white tabular-nums">{fmt(p.revenue)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}