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
        className={`flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all backdrop-blur-md shadow-sm ${
          isAllUnits
            ? 'bg-blue-500/20 border border-blue-400/40 text-blue-300 hover:bg-blue-500/30 ring-1 ring-blue-500/20'
            : 'bg-white/[0.06] border border-white/10 text-white hover:bg-white/[0.1] hover:border-blue-400/30'
        }`}
        title="Alternar unidade ativa"
      >
        <LabelIcon className={`w-4 h-4 flex-shrink-0 ${isAllUnits ? 'text-blue-400' : 'text-[#60A5FA]'}`} />
        <span className="max-w-[130px] sm:max-w-[180px] truncate">{labelText}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-[#0B1020] rounded-2xl border border-white/10 shadow-[0_16px_36px_rgba(0,0,0,0.6)] py-2 z-50 animate-fade-in backdrop-blur-xl ring-1 ring-white/5">
          <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
            Visualização
          </div>
          {/* Opção: Todas as unidades */}
          <button
            onClick={() => { setActiveUnitId(null); setOpen(false); }}
            className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm transition-colors text-left ${
              isAllUnits ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-white/80 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Layers className={`w-4 h-4 flex-shrink-0 ${isAllUnits ? 'text-blue-400' : 'text-white/40'}`} />
              <span className="truncate">Todas as unidades</span>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-400/30 text-blue-300 flex-shrink-0">
                Consolidado
              </span>
            </div>
            {isAllUnits && <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />}
          </button>

          <div className="my-1.5 border-t border-white/10" />

          <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
            Unidades
          </div>
          {units.map(u => (
            <button
              key={u.id}
              onClick={() => { setActiveUnitId(u.id); setOpen(false); }}
              className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm transition-colors text-left ${
                u.id === activeUnitId ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-white/80 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className={`w-4 h-4 flex-shrink-0 ${u.id === activeUnitId ? 'text-blue-400' : 'text-white/40'}`} />
                <span className="truncate">{u.name}</span>
                {u.is_default && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/30 text-amber-300 flex-shrink-0">
                    Matriz
                  </span>
                )}
              </div>
              {u.id === activeUnitId && <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}