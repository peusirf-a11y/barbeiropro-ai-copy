// Editor de permissões granulares do Caixa para um TeamMember.
// Cada capability tem 3 estados: HERDADO (do role) · LIBERADO · BLOQUEADO.
//
// Usado no modal de "Permissões" da página Equipe.
import { Check, X, ArrowUpRight } from 'lucide-react';
import { CASH_CAPS, CASH_CAP_LABELS, getRoleDefaults } from '@/lib/cashPermissions';

export default function CashPermissionsEditor({ role, value = {}, onChange }) {
  const defaults = getRoleDefaults(role);

  const cycle = (cap) => {
    const current = value[cap];
    let next;
    if (current === true)       next = false;
    else if (current === false) next = undefined; // herda
    else                         next = true;
    const out = { ...value };
    if (next === undefined) delete out[cap];
    else out[cap] = next;
    onChange(out);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-[#6B7280] mb-2">
        Permissões herdam do papel <b>{role}</b>. Clique para sobrescrever individualmente.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {CASH_CAPS.map(cap => {
          const v = value[cap];
          const inherited = defaults[cap];
          const state = v === true ? 'on' : v === false ? 'off' : 'inherit';
          const wrap = state === 'on'
            ? 'bg-emerald-50 border-emerald-300'
            : state === 'off'
            ? 'bg-red-50 border-red-300'
            : 'bg-[#FAFBFC] border-black/10';

          return (
            <button
              key={cap}
              type="button"
              onClick={() => cycle(cap)}
              className={`text-left rounded-xl p-2.5 border transition-all ${wrap}`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-sm text-[#111827]">
                {state === 'on' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                {state === 'off' && <X className="w-3.5 h-3.5 text-red-600" />}
                {state === 'inherit' && <ArrowUpRight className="w-3.5 h-3.5 text-[#6B7280]" />}
                {CASH_CAP_LABELS[cap]}
              </div>
              <div className="text-[10px] mt-0.5 font-medium">
                {state === 'on'      && <span className="text-emerald-700">✓ Liberado</span>}
                {state === 'off'     && <span className="text-red-700">✗ Bloqueado</span>}
                {state === 'inherit' && (
                  <span className="text-[#6B7280]">
                    ↳ Herdado ({inherited ? 'liberado' : 'bloqueado'})
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="text-[11px] text-[#6B7280] flex items-center gap-3 flex-wrap pt-2 border-t border-black/5">
        <span className="inline-flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />Herdado</span>
        <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="w-3 h-3" />Liberado</span>
        <span className="inline-flex items-center gap-1 text-red-700"><X className="w-3 h-3" />Bloqueado</span>
      </div>
    </div>
  );
}