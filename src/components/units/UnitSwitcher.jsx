// UnitSwitcher — dropdown de unidade ativa.
// Aparece SOMENTE quando há 2+ unidades. Inclui opção "Todas as unidades"
// para visão consolidada (dashboard/financeiro/relatórios agregados).

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, Check, Layers } from 'lucide-react';
import { useActiveUnit } from '@/hooks/useActiveUnit';

export default function UnitSwitcher() {
  const { activeUnitId, setActiveUnitId, units, isMultiUnit, isAllUnits } = useActiveUnit();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!isMultiUnit) return null;

  const active = units.find(u => u.id === activeUnitId);
  const labelText = isAllUnits ? 'Todas as unidades' : (active?.name || 'Selecionar unidade');
  const LabelIcon = isAllUnits ? Layers : Building2;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors shadow-[var(--shadow-xs)] ${
          isAllUnits
            ? 'bg-[#EFF6FF] border border-[#DBEAFE] text-[#2563EB] hover:bg-[#DBEAFE]'
            : 'bg-white border border-black/10 text-[#111827] hover:border-[#2563EB]/40'
        }`}
      >
        <LabelIcon className="w-4 h-4 text-[#2563EB]" />
        <span className="max-w-[160px] truncate">{labelText}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-black/5 shadow-[var(--shadow-lg)] py-2 z-50 animate-fade-in">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Visualização
          </div>
          {/* Opção: Todas as unidades */}
          <button
            onClick={() => { setActiveUnitId(null); setOpen(false); }}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-[#F7F8FB] text-left ${isAllUnits ? 'text-[#2563EB] font-semibold' : 'text-[#111827]'}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Layers className={`w-4 h-4 flex-shrink-0 ${isAllUnits ? 'text-[#2563EB]' : 'text-gray-400'}`} />
              <span className="truncate">Todas as unidades</span>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#2563EB] flex-shrink-0">
                Consolidado
              </span>
            </div>
            {isAllUnits && <Check className="w-4 h-4 text-[#2563EB] flex-shrink-0" />}
          </button>

          <div className="my-1 border-t border-black/5" />

          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Unidades
          </div>
          {units.map(u => (
            <button
              key={u.id}
              onClick={() => { setActiveUnitId(u.id); setOpen(false); }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-[#F7F8FB] text-left ${u.id === activeUnitId ? 'text-[#2563EB] font-semibold' : 'text-[#111827]'}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className={`w-4 h-4 flex-shrink-0 ${u.id === activeUnitId ? 'text-[#2563EB]' : 'text-gray-400'}`} />
                <span className="truncate">{u.name}</span>
                {u.is_default && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0">
                    Matriz
                  </span>
                )}
              </div>
              {u.id === activeUnitId && <Check className="w-4 h-4 text-[#2563EB] flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}