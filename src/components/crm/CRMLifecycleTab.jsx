// Aba "Lifecycle" — janelas (em dias) que definem em risco / inativo / perdido +
// breakdown atual dos clientes por status. Reaproveita CrmSettingsSection.

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import CrmSettingsSection from '@/components/configuracoes/CrmSettingsSection';
import { LIFECYCLE_TOKENS } from '@/lib/customerLifecycle';

const ORDER = ['primeira_visita', 'fiel', 'em_risco', 'inativo', 'perdido'];

export default function CRMLifecycleTab({ company, customers }) {
  const counts = customers.reduce((acc, c) => {
    const lc = c.lifecycle_status || 'primeira_visita';
    acc[lc] = (acc[lc] || 0) + 1;
    return acc;
  }, {});
  const total = customers.length || 1;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5">
        <h3 className="font-bold text-white mb-1">Distribuição atual</h3>
        <p className="text-xs text-white/55 mb-4">Quantos clientes em cada estágio do ciclo de vida.</p>
        <div className="space-y-2.5">
          {ORDER.map(key => {
            const t = LIFECYCLE_TOKENS[key];
            const n = counts[key] || 0;
            const pct = Math.round((n / total) * 100);
            return (
              <Link
                key={key}
                to={`/app/clientes?filter=${key}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.04] transition-colors group"
              >
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border w-32 flex-shrink-0 ${t.badge}`}>
                  <span>{t.icon}</span>{t.label}
                </span>
                <div className="flex-1 bg-white/[0.06] rounded-full h-2 overflow-hidden">
                  <div className={`${t.dot} h-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-12 text-right text-sm font-bold text-white">{n}</span>
                <ArrowRight className="w-3.5 h-3.5 text-white/25 group-hover:text-[#93C5FD] group-hover:translate-x-0.5 transition-all" />
              </Link>
            );
          })}
        </div>
      </div>

      <CrmSettingsSection company={company} />
    </div>
  );
}