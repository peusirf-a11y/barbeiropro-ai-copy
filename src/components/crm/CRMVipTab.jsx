// Aba "VIP" — sugestões automáticas + lista de VIPs ativos.

import { Link } from 'react-router-dom';
import { Crown, ArrowRight } from 'lucide-react';
import VipCandidatesCard from '@/components/clientes/VipCandidatesCard';
import { LIFECYCLE_TOKENS } from '@/lib/customerLifecycle';

export default function CRMVipTab({ companyId, customers }) {
  const vips = customers.filter(c => c.status === 'vip');
  const vipsAtRisk = vips.filter(c => ['em_risco', 'inativo', 'perdido'].includes(c.lifecycle_status));

  return (
    <div className="space-y-6">
      <VipCandidatesCard companyId={companyId} />

      {vipsAtRisk.length > 0 && (
        <div className="bg-purple-50/40 border border-purple-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4 text-purple-700" />
            <h3 className="font-bold text-purple-900 uppercase text-xs tracking-wider">
              {vipsAtRisk.length} VIP{vipsAtRisk.length > 1 ? 's' : ''} precisa{vipsAtRisk.length > 1 ? 'm' : ''} de atenção pessoal
            </h3>
          </div>
          <div className="space-y-2">
            {vipsAtRisk.slice(0, 8).map(c => {
              const t = LIFECYCLE_TOKENS[c.lifecycle_status] || LIFECYCLE_TOKENS.primeira_visita;
              return (
                <div key={c.id} className="bg-white rounded-xl border border-purple-100 px-3 py-2.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {(c.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-[#111827] truncate">{c.name}</div>
                    <div className="text-[11px] text-[#6B7280]">{c.phone}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${t.badge} flex-shrink-0`}>
                    <span>{t.icon}</span>{t.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-bold text-[#111827]">Todos os VIPs ({vips.length})</h3>
          <Link to="/app/clientes?filter=vip" className="text-xs font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1">
            Ver na lista de clientes <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {vips.length === 0 ? (
          <p className="text-sm text-[#6B7280] text-center py-6">Nenhum VIP cadastrado ainda. Use o card acima para promover seus melhores clientes.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {vips.slice(0, 12).map(c => (
              <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-amber-50/60 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-xs">
                  {(c.name || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[#111827] truncate">{c.name}</div>
                  <div className="text-[11px] text-[#6B7280]">{c.total_appointments || 0} atend.</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}