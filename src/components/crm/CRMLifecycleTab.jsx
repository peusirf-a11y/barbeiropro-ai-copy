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
      <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-[var(--shadow-sm)]">
        <h3 className="font-bold text-[#111827] mb-1">Distribuição atual</h3>
        <p className="text-xs text-[#6B7280] mb-4">Quantos clientes em cada estágio do ciclo de vida.</p>
        <div className="space-y-2.5">
          {ORDER.map(key => {
            const t = LIFECYCLE_TOKENS[key];
            const n = counts[key] || 0;
            const pct = Math.round((n / total) * 100);
            return (
              <Link
                key={key}
                to={`/app/clientes?filter=${key}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border w-32 flex-shrink-0 ${t.badge}`}>
                  <span>{t.icon}</span>{t.label}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className={`${t.dot} h-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-12 text-right text-sm font-bold text-[#111827]">{n}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all" />
              </Link>
            );
          })}
        </div>
      </div>

      <CrmSettingsSection company={company} />
    </div>
  );
}