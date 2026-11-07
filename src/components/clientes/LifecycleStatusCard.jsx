import { Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LIFECYCLE_LABELS = {
  primeira_visita: { label: 'Visitante',    shortLabel: 'Visitante',    icon: '✦', tone: 'bg-blue-400/15 text-blue-200 border-blue-400/30' },
  fiel:            { label: 'Cliente fiel', shortLabel: 'Fiel',         icon: '✓', tone: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30' },
  em_risco:        { label: 'Em risco',     shortLabel: 'Em risco',     icon: '⚠️', tone: 'bg-amber-400/15 text-amber-200 border-amber-400/30' },
  inativo:         { label: 'Inativo',      shortLabel: 'Inativo',      icon: '💤', tone: 'bg-orange-400/15 text-orange-200 border-orange-400/30' },
  perdido:         { label: 'Perdido',      shortLabel: 'Perdido',      icon: '🚫', tone: 'bg-rose-400/15 text-rose-200 border-rose-400/30' },
};

const LIFECYCLE_OPTIONS = [
  { key: 'primeira_visita', label: 'Visitante' },
  { key: 'fiel',            label: 'Cliente fiel' },
  { key: 'em_risco',        label: 'Em risco' },
  { key: 'inativo',         label: 'Inativo' },
  { key: 'perdido',         label: 'Perdido' },
];

export default function LifecycleStatusCard({ customer, value, onChange }) {
  const status = value || customer?.lifecycle_status || 'primeira_visita';
  const meta = LIFECYCLE_LABELS[status] || LIFECYCLE_LABELS.primeira_visita;
  const updatedAt = customer?.lifecycle_updated_at;

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] backdrop-blur-sm p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#93C5FD]" />
          <label htmlFor="client-lifecycle-select" className="text-[11px] font-bold text-white uppercase tracking-wider">
            Ciclo de vida
          </label>
        </div>
        {meta && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.tone}`}>
            <span>{meta.icon}</span>
            {meta.label}
          </span>
        )}
      </div>

      {onChange ? (
        <div className="space-y-2">
          <select
            id="client-lifecycle-select"
            aria-label="Ciclo de vida"
            value={status}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 bg-white/[0.04] border border-white/12 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-[#60A5FA]"
          >
            {LIFECYCLE_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key} className="bg-[#0F172A] text-white">
                {opt.label}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-1.5">
            {LIFECYCLE_OPTIONS.map((opt) => {
              const itemMeta = LIFECYCLE_LABELS[opt.key];
              const isSelected = status === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onChange(opt.key)}
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                    isSelected
                      ? `${itemMeta.tone} ring-1 ring-white/30`
                      : 'bg-white/[0.03] text-white/60 border-white/10 hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  <span>{itemMeta.icon}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${meta.tone}`}>
            <span>{meta.icon}</span>
            {meta.label}
          </span>
          {updatedAt && (
            <span className="text-[10px] text-white/45">
              Atualizado em {format(new Date(updatedAt), "d MMM yyyy", { locale: ptBR })}
            </span>
          )}
        </div>
      )}

      <p className="text-[11px] text-white/45 mt-2 leading-snug">
        Classificação de ciclo de vida usada para segmentação e campanhas de retenção.
      </p>
    </div>
  );
}