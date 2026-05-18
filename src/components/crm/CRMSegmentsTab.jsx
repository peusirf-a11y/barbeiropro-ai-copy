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
      <div className="bg-blue-400/[0.08] border border-blue-400/25 rounded-2xl p-5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15">
            <span className="absolute inset-0 rounded-xl bg-[#60A5FA]/30 blur-md opacity-60" aria-hidden="true" />
            <Users className="relative w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white">Segmentos automáticos</h3>
            <p className="text-xs text-white/60 mt-0.5">Clique em qualquer segmento para abrir a lista filtrada.</p>
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
              className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 hover:-translate-y-0.5 hover:border-blue-400/25 hover:bg-white/[0.04] transition-all duration-200 group block"
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${token.badge}`}>
                  <span>{token.icon}</span>{token.label}
                </span>
                <ArrowRight className="w-4 h-4 text-white/25 group-hover:text-[#93C5FD] group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="text-3xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">{count}</div>
              <p className="text-xs text-white/55 mt-1">{hint}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}