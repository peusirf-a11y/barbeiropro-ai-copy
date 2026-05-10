// Aba "Segmentos" — atalhos visuais para cada filtro do banco de clientes.
// Cada card linka para /app/clientes?filter=<key>.

import { Link } from 'react-router-dom';
import { ArrowRight, Users } from 'lucide-react';
import { LIFECYCLE_TOKENS } from '@/lib/customerLifecycle';

export default function CRMSegmentsTab({ customers }) {
  const counts = customers.reduce((acc, c) => {
    const lc = c.lifecycle_status || 'primeira_visita';
    acc[lc] = (acc[lc] || 0) + 1;
    if (c.status === 'vip') acc.vip = (acc.vip || 0) + 1;
    return acc;
  }, {});

  const SEGMENTS = [
    { key: 'vip',             token: { label: 'Clientes VIP',   icon: '👑', dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 border-amber-200' }, hint: 'Seus clientes premium ativos.' },
    { key: 'fiel',            token: LIFECYCLE_TOKENS.fiel,            hint: 'Recorrentes que voltam sempre.' },
    { key: 'primeira_visita', token: LIFECYCLE_TOKENS.primeira_visita, hint: 'Acabaram de chegar. Encantar agora.' },
    { key: 'em_risco',        token: LIFECYCLE_TOKENS.em_risco,        hint: 'Sumiram há ~30 dias. Reengajar.' },
    { key: 'inativo',         token: LIFECYCLE_TOKENS.inativo,         hint: 'Sem visita há ~60 dias.' },
    { key: 'perdido',         token: LIFECYCLE_TOKENS.perdido,         hint: '+90 dias. Última cartada.' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-[#EFF6FF] to-white border border-[#DBEAFE] rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.25)]">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-[#111827]">Segmentos automáticos</h3>
            <p className="text-xs text-[#6B7280] mt-0.5">Clique em qualquer segmento para abrir a lista filtrada.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SEGMENTS.map(({ key, token, hint }) => {
          const count = counts[key] || 0;
          return (
            <Link
              key={key}
              to={`/app/clientes?filter=${key}`}
              className="bg-white border border-black/5 rounded-2xl p-5 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] transition-all duration-200 group block shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${token.badge}`}>
                  <span>{token.icon}</span>{token.label}
                </span>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="text-3xl font-black text-[#111827] tracking-tight">{count}</div>
              <p className="text-xs text-[#6B7280] mt-1">{hint}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}