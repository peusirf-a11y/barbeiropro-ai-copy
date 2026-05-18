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
        <div className="bg-violet-400/[0.08] border border-violet-400/30 rounded-2xl p-5 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4 text-violet-300" />
            <h3 className="font-bold text-violet-200 uppercase text-xs tracking-wider">
              {vipsAtRisk.length} VIP{vipsAtRisk.length > 1 ? 's' : ''} precisa{vipsAtRisk.length > 1 ? 'm' : ''} de atenção pessoal
            </h3>
          </div>
          <div className="space-y-2">
            {vipsAtRisk.slice(0, 8).map(c => {
              const t = LIFECYCLE_TOKENS[c.lifecycle_status] || LIFECYCLE_TOKENS.primeira_visita;
              return (
                <div key={c.id} className="bg-white/[0.04] rounded-xl border border-white/10 px-3 py-2.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.4)] ring-1 ring-white/15">
                    {(c.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-white truncate">{c.name}</div>
                    <div className="text-[11px] text-white/55">{c.phone}</div>
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

      <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-bold text-white">Todos os VIPs ({vips.length})</h3>
          <Link to="/app/clientes?filter=vip" className="text-xs font-semibold text-[#93C5FD] hover:text-white hover:underline inline-flex items-center gap-1">
            Ver na lista de clientes <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {vips.length === 0 ? (
          <p className="text-sm text-white/55 text-center py-6">Nenhum VIP cadastrado ainda. Use o card acima para promover seus melhores clientes.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {vips.slice(0, 12).map(c => (
              <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-amber-400/[0.08] transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-xs ring-1 ring-white/15">
                  {(c.name || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">{c.name}</div>
                  <div className="text-[11px] text-white/55">{c.total_appointments || 0} atend.</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}