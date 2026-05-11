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
    <div className="bg-white rounded-2xl border border-black/5 p-4 sm:p-5 mb-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2 mb-3 text-[11px] uppercase tracking-wider font-bold text-[#6B7280]">
        <Calendar className="w-3.5 h-3.5" /> Período
      </div>
      <div className="flex flex-wrap gap-2">
        {RANGE_PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              preset === p.key
                ? 'bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]'
                : 'bg-white border border-black/10 text-gray-600 hover:border-[#2563EB] hover:text-[#2563EB]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-[11px] font-semibold text-[#6B7280] block mb-1">De</label>
            <input
              type="date"
              value={customFrom || ''}
              max={customTo || todayISO()}
              onChange={e => setCustomFrom(e.target.value)}
              className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#6B7280] block mb-1">Até</label>
            <input
              type="date"
              value={customTo || ''}
              min={customFrom || ''}
              max={todayISO()}
              onChange={e => setCustomTo(e.target.value)}
              className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}