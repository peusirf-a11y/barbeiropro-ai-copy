// BarberSpecialtiesAnalyzer — Painel de especialidades sugeridas por IA.
//
// - Lista as especialidades sugeridas (tag, confiança, evidência).
// - Confiança vira label: Muito forte / Forte / Moderada.
// - Cada tag tem botão "Definir como especialidade principal" → preenche
//   o campo `specialty` no form do barbeiro.
// - Requer professional_id (precisa ter sido salvo antes).

import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, Wand2, RefreshCcw, Check, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function confidenceLabel(c) {
  if (c >= 95) return { label: 'Muito forte', tone: 'emerald' };
  if (c >= 80) return { label: 'Forte', tone: 'blue' };
  return { label: 'Moderada', tone: 'amber' };
}

const TONE_STYLES = {
  emerald: 'bg-emerald-400/12 text-emerald-200 border-emerald-400/30',
  blue: 'bg-blue-400/12 text-blue-200 border-blue-400/30',
  amber: 'bg-amber-400/12 text-amber-100 border-amber-400/30',
};

function normalizeSpecialtyItem(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (!trimmed) return null;
    return {
      tag: trimmed,
      confidence: 88,
      evidence: 'Especialidade cadastrada no perfil do profissional.',
    };
  }
  if (typeof item === 'object') {
    const rawTag = item.tag ?? item.name ?? item.specialty ?? item.label ?? '';
    const trimmed = String(rawTag).trim();
    if (!trimmed) return null;
    const conf = Number(item.confidence ?? item.score ?? 88);
    return {
      tag: trimmed,
      confidence: Number.isFinite(conf) && conf > 0 ? Math.min(100, Math.round(conf)) : 88,
      evidence: item.evidence || item.reason || item.description || '',
    };
  }
  return null;
}

export default function BarberSpecialtiesAnalyzer({
  professionalId,
  suggested = [],
  analyzedAt,
  currentSpecialty,
  onApplySpecialty,
  disabled = false,
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState({
    specialties: Array.isArray(suggested) ? suggested : [],
    analyzedAt,
    reason: null,
    total: null,
  });

  const analyze = async () => {
    if (!professionalId) {
      setError('Salve o profissional primeiro para analisar com IA.');
      return;
    }
    setError('');
    setAnalyzing(true);
    try {
      const { data } = await base44.functions.invoke('analyzeProfessionalSpecialties', {
        professional_id: professionalId,
      });
      if (!data?.success) throw new Error(data?.error || 'Falha na análise.');
      setResult({
        specialties: Array.isArray(data.specialties) ? data.specialties : [],
        analyzedAt: data.analyzed_at || new Date().toISOString(),
        reason: data.reason || null,
        total: data.total_appointments,
        minRequired: data.min_required,
      });
    } catch (e) {
      console.error('[BarberSpecialtiesAnalyzer]', e);
      setError(e?.message || 'Falha ao analisar especialidades.');
    } finally {
      setAnalyzing(false);
    }
  };

  const specialties = (Array.isArray(result.specialties) ? result.specialties : [])
    .map(normalizeSpecialtyItem)
    .filter(Boolean);
  const hasResults = specialties.length > 0;
  const currentSpecNormalized = typeof currentSpecialty === 'string' ? currentSpecialty.trim().toLowerCase() : '';

  let formattedAnalyzedAt = null;
  if (result.analyzedAt) {
    try {
      const d = new Date(result.analyzedAt);
      if (!Number.isNaN(d.getTime())) {
        formattedAnalyzedAt = formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
      }
    } catch (_) {}
  }

  return (
    <div className="rounded-xl border border-[#60A5FA]/25 bg-[#0B1226] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[#93C5FD]">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Especialidades sugeridas pela IA</span>
          </div>
          <p className="text-[11px] text-white/55 mt-1 leading-snug">
            A análise é feita só com base nos atendimentos concluídos reais — volume, avaliações e ticket médio por tipo de serviço.
          </p>
          {formattedAnalyzedAt && (
            <p className="text-[10px] text-white/40 mt-1">
              Última análise: {formattedAnalyzedAt}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={analyze}
          disabled={disabled || analyzing || !professionalId}
          title={!professionalId ? 'Salve o profissional primeiro' : ''}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-lg text-xs font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_24px_rgba(37,99,235,0.35)] transition-all"
        >
          {analyzing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Analisando…
            </>
          ) : hasResults ? (
            <>
              <RefreshCcw className="w-3.5 h-3.5" />
              Reanalisar
            </>
          ) : (
            <>
              <Wand2 className="w-3.5 h-3.5" />
              Analisar com IA
            </>
          )}
        </button>
      </div>

      {!professionalId && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-400/10 border border-amber-400/25">
          <AlertCircle className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
          <span className="text-[11px] text-amber-100">
            Salve o profissional para liberar a análise.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-400/25">
          <AlertCircle className="w-4 h-4 text-rose-300 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-rose-200">{error}</span>
        </div>
      )}

      {/* Caso: volume insuficiente */}
      {result.reason === 'volume_insuficiente' && (
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white/65 leading-relaxed">
          Volume ainda insuficiente para uma análise confiável. O barbeiro tem{' '}
          <strong className="text-white">{result.total ?? 0}</strong> atendimentos concluídos — precisamos de pelo menos{' '}
          <strong className="text-white">{result.minRequired ?? 20}</strong>. Cadastre mais atendimentos e tente novamente.
        </div>
      )}
      {result.reason === 'mix_insuficiente' && (
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white/65 leading-relaxed">
          Os atendimentos estão muito concentrados em um único serviço com baixo volume — sem dados suficientes para sugerir especialidades.
        </div>
      )}

      {/* Resultado */}
      {hasResults && (
        <div className="space-y-2">
          {specialties.map((s, idx) => {
            const { label, tone } = confidenceLabel(s.confidence);
            const isCurrent = Boolean(currentSpecNormalized && currentSpecNormalized === s.tag.toLowerCase());
            return (
              <div
                key={`${s.tag}-${idx}`}
                className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{s.tag}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${TONE_STYLES[tone]}`}>
                      {s.confidence}% · {label}
                    </span>
                  </div>
                  {s.evidence && (
                    <p className="text-[11px] text-white/55 mt-1 leading-snug">{s.evidence}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onApplySpecialty && onApplySpecialty(s.tag)}
                  disabled={disabled || isCurrent}
                  className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    isCurrent
                      ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30 cursor-default'
                      : 'bg-white/[0.05] text-white/85 border border-white/15 hover:bg-white/[0.1] hover:border-[#60A5FA]/40'
                  }`}
                >
                  {isCurrent ? (
                    <>
                      <Check className="w-3 h-3" /> Atual
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" /> Definir como principal
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!hasResults && !result.reason && !analyzing && (
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white/55 leading-relaxed">
          Clique em <strong className="text-white/80">Analisar com IA</strong> para identificar as especialidades deste barbeiro a partir do histórico real de atendimentos.
        </div>
      )}
    </div>
  );
}