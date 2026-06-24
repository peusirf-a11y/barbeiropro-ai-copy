// Seletor de mês simples (YYYY-MM). Mostra os últimos 12 meses + os 2 próximos.
// Usado em telas Master onde filtragem por mês é o caso comum (parceiros, financeiro etc).
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export default function MonthPicker({ value, onChange, range = 12 }) {
  const months = buildMonthOptions(range);

  const shift = (delta) => {
    if (!value || !/^\d{4}-\d{2}$/.test(value)) return;
    const [y, m] = value.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="inline-flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-xl p-1">
      <button
        onClick={() => shift(-1)}
        className="p-1.5 rounded-lg hover:bg-white/8 text-white/70"
        title="Mês anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm font-semibold text-white px-2 py-1.5 outline-none border-0 [color-scheme:dark] min-w-[130px]"
      >
        {months.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <button
        onClick={() => shift(1)}
        className="p-1.5 rounded-lg hover:bg-white/8 text-white/70"
        title="Próximo mês"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function buildMonthOptions(range) {
  const now = new Date();
  const out = [];
  for (let i = -2; i < range; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${MONTH_LABELS[d.getMonth()]}/${d.getFullYear()}`;
    out.push({ value, label });
  }
  return out;
}

export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}