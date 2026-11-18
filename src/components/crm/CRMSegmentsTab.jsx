// Segmentos automáticos — atalhos visuais para filtros de clientes.
// Sem duplicação de configurações de mensagens (que pertencem exclusivamente a /app/automacoes).

import { Link } from 'react-router-dom';
import { ArrowRight, Users, MessageSquare } from 'lucide-react';
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
    { key: 'em_risco',        token: LIFECYCLE_TOKENS.em_risco,        hint: 'Sumiram recentemente. Reengajar.' },
    { key: 'inativo',         token: LIFECYCLE_TOKENS.inativo,         hint: 'Sem visita no período definido.' },
    { key: 'perdido',         token: LIFECYCLE_TOKENS.perdido,         hint: 'Inativos há longo prazo.' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-400/[0.08] border border-blue-200 dark:border-blue-400/25 rounded-2xl p-5 backdrop-blur-md flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center shadow-sm ring-1 ring-white/15">
            <Users className="relative w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Segmentos automáticos</h3>
            <p className="text-xs text-slate-600 dark:text-white/60 mt-0.5">Clique em qualquer segmento para abrir a lista filtrada.</p>
          </div>
        </div>
        <Link
          to="/app/automacoes"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.12] border border-slate-200 dark:border-white/15 text-xs font-semibold text-[#2563EB] dark:text-[#93C5FD] transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Configurar Campanhas WhatsApp
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SEGMENTS.map(({ key, token, hint }) => {
          const count = counts[key] || 0;
          return (
            <Link
              key={key}
              to={`/app/clientes?filter=${key}`}
              className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.025] backdrop-blur-md p-5 hover:-translate-y-0.5 hover:border-blue-300 dark:hover:border-blue-400/25 transition-all duration-200 group block shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${token.badge}`}>
                  <span>{token.icon}</span>{token.label}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 dark:text-white/25 group-hover:text-[#2563EB] dark:group-hover:text-[#93C5FD] group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{count}</div>
              <p className="text-xs text-slate-500 dark:text-white/55 mt-1">{hint}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}