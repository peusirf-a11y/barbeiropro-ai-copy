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
    <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] shadow-sm p-4 sm:p-5 mb-5">
      <div className="flex items-center gap-2 mb-3 text-[11px] uppercase tracking-wider font-bold text-[#59658F] dark:text-[#8F9BBF]">
        <Calendar className="w-3.5 h-3.5 text-[#59658F] dark:text-[#8F9BBF]" strokeWidth={1.75} />
        <span>Janela de Período</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {RANGE_PRESETS.map(p => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              preset === p.key
                ? 'bg-[#171827] text-white dark:bg-[#2563EB] shadow-xs'
                : 'bg-[#F8FAFC] dark:bg-[#1C1E30] border border-[#E5E7EF] dark:border-[#232538] text-[#55596A] dark:text-[#8F9BBF] hover:border-[#2563EB]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-3 mt-3.5">
          <div>
            <label className="text-[11px] font-bold text-[#59658F] dark:text-[#8F9BBF] block mb-1">De</label>
            <input
              type="date"
              value={customFrom || ''}
              max={customTo || todayISO()}
              onChange={e => setCustomFrom(e.target.value)}
              className="w-full px-3 py-2 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-xs sm:text-sm text-[#171827] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#59658F] dark:text-[#8F9BBF] block mb-1">Até</label>
            <input
              type="date"
              value={customTo || ''}
              min={customFrom || ''}
              max={todayISO()}
              onChange={e => setCustomTo(e.target.value)}
              className="w-full px-3 py-2 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-xs sm:text-sm text-[#171827] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        </div>
      )}
    </div>
  );
}