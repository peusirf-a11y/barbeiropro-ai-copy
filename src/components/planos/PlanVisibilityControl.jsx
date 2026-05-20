// Sub-componente de UI reutilizável para configurar visibilidade num form de plano.
// Usado por PlansManager (Plan SaaS) e PlanFormModal (CustomerPlan).
//
// Não conhece a entity — apenas dispara onChange({ visibility, allowed_ids }).
// Geração de invite token fica em outro componente (PlanInviteGenerator), porque
// só faz sentido depois do plano salvo (precisa de plan_id).

import { useState } from 'react';
import { Globe, Lock, Link2, ChevronDown } from 'lucide-react';

const OPTIONS = [
  { key: 'public',      label: 'Público',      icon: Globe, desc: 'Aparece na landing, onboarding e listas de upgrade.' },
  { key: 'private',     label: 'Privado',      icon: Lock,  desc: 'Oculto. Só liberado para IDs explicitamente autorizados.' },
  { key: 'invite_only', label: 'Por convite',  icon: Link2, desc: 'Oculto. Liberado via URL privada (token).' },
];

export default function PlanVisibilityControl({
  value = 'public',
  onChange,
  className = '',
  // Dark = customerplan form (glass dark); Light = master plans manager.
  variant = 'dark',
}) {
  const [open, setOpen] = useState(false);
  const isDark = variant === 'dark';
  const current = OPTIONS.find(o => o.key === value) || OPTIONS[0];
  const Icon = current.icon;

  const styles = isDark
    ? {
        wrap: 'border-white/8 bg-white/[0.025]',
        label: 'text-white/60',
        button: 'bg-white/[0.04] border-white/10 text-white',
        desc: 'text-white/40',
        item: 'hover:bg-white/[0.06] text-white',
        itemActive: 'bg-blue-500/15 text-[#93C5FD]',
      }
    : {
        wrap: 'border-border bg-muted/30',
        label: 'text-muted-foreground',
        button: 'bg-background border-border text-foreground',
        desc: 'text-muted-foreground',
        item: 'hover:bg-muted text-foreground',
        itemActive: 'bg-blue-500/15 text-[#2563EB]',
      };

  return (
    <div className={`${className} border rounded-xl p-3 ${styles.wrap}`}>
      <label className={`text-xs font-semibold block mb-2 ${styles.label}`}>Visibilidade</label>
      <div className="relative">
        <button type="button" onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 border rounded-lg text-sm ${styles.button}`}>
          <span className="flex items-center gap-2">
            <Icon className="w-4 h-4" />
            <span className="font-medium">{current.label}</span>
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className={`absolute z-20 mt-1 left-0 right-0 border rounded-lg overflow-hidden shadow-lg ${styles.button}`}>
            {OPTIONS.map(opt => {
              const OptIcon = opt.icon;
              const active = opt.key === value;
              return (
                <button key={opt.key} type="button"
                  onClick={() => { onChange?.(opt.key); setOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors ${active ? styles.itemActive : styles.item}`}>
                  <OptIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className={`text-[11px] mt-0.5 ${styles.desc}`}>{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p className={`text-[11px] mt-2 ${styles.desc}`}>{current.desc}</p>
    </div>
  );
}