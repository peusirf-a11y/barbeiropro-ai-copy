// Filtros do relatório: período (presets + custom) e unidade (quando multi-unidade).
import { Calendar } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';

const todayISO = () => format(new Date(), 'yyyy-MM-dd');

export const RANGE_PRESETS = [
  { key: 'today',     label: 'Hoje' },
  { key: '7d',        label: '7 dias' },
  { key: '30d',       label: '30 dias' },
  { key: 'this_month',label: 'Este mês' },
  { key: 'last_month',label: 'Mês anterior' },
  { key: 'custom',    label: 'Personalizado' },
];

export function resolveRange(preset, customFrom, customTo) {
  const now = new Date();
  let from, to;
  switch (preset) {
    case 'today':      from = startOfDay(now); to = endOfDay(now); break;
    case '7d':         from = startOfDay(subDays(now, 6)); to = endOfDay(now); break;
    case '30d':        from = startOfDay(subDays(now, 29)); to = endOfDay(now); break;
    case 'this_month': from = startOfMonth(now); to = endOfDay(now); break;
    case 'last_month': {
      const lm = subDays(startOfMonth(now), 1);
      from = startOfMonth(lm); to = endOfMonth(lm); break;
    }
    case 'custom':
      from = customFrom ? startOfDay(new Date(customFrom)) : startOfDay(subDays(now, 29));
      to   = customTo   ? endOfDay(new Date(customTo))     : endOfDay(now);
      break;
    default: from = startOfDay(subDays(now, 29)); to = endOfDay(now);
  }
  const label = `${format(from, 'dd/MM/yyyy')} – ${format(to, 'dd/MM/yyyy')}`;
  return { from, to, label };
}

export default function HistoryFilters({ preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-4 sm:p-5 mb-5">
      <div className="flex items-center gap-2 mb-3 text-[11px] uppercase tracking-wider font-bold text-white/55">
        <Calendar className="w-3.5 h-3.5" /> Período
      </div>
      <div className="flex flex-wrap gap-2">
        {RANGE_PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              preset === p.key
                ? 'bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white shadow-[0_4px_12px_rgba(37,99,235,0.4)] ring-1 ring-white/15'
                : 'bg-white/[0.04] border border-white/10 text-white/65 hover:border-[#60A5FA]/30 hover:text-[#93C5FD] hover:bg-white/[0.06]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-[11px] font-semibold text-white/55 block mb-1">De</label>
            <input
              type="date"
              value={customFrom || ''}
              max={customTo || todayISO()}
              onChange={e => setCustomFrom(e.target.value)}
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-white/55 block mb-1">Até</label>
            <input
              type="date"
              value={customTo || ''}
              min={customFrom || ''}
              max={todayISO()}
              onChange={e => setCustomTo(e.target.value)}
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
            />
          </div>
        </div>
      )}
    </div>
  );
}