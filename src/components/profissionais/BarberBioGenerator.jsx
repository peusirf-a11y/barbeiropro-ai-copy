// BarberBioGenerator — Gera e edita as biografias de IA do barbeiro.
//
// Comporta-se como um campo controlado: lê e devolve as três versões via onChange.
// O botão "Gerar com IA" só fica disponível depois que o profissional foi salvo
// (precisa de professional_id no servidor pra coletar dados reais).

import { useState } from 'react';
import { Sparkles, Loader2, RefreshCcw, AlertCircle, Wand2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LIMITS = { bio_short: 150, bio_medium: 300, bio_full: 600 };

export default function BarberBioGenerator({
  professionalId,
  values,
  generatedAt,
  onChange,
  disabled = false,
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!professionalId) {
      setError('Salve o profissional primeiro para gerar a biografia com IA.');
      return;
    }
    setError('');
    setGenerating(true);
    try {
      const { data } = await base44.functions.invoke('generateProfessionalBio', {
        professional_id: professionalId,
      });
      if (!data?.success) throw new Error(data?.error || 'Falha ao gerar.');
      onChange({
        bio_short: data.bio_short,
        bio_medium: data.bio_medium,
        bio_full: data.bio_full,
        bio_generated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[BarberBioGenerator]', e);
      setError(e?.message || 'Falha ao gerar biografias.');
    } finally {
      setGenerating(false);
    }
  };

  const handleField = (field, val) => {
    const max = LIMITS[field];
    onChange({ [field]: val.slice(0, max) });
  };

  const hasAny = values.bio_short || values.bio_medium || values.bio_full;

  return (
    <div className="rounded-xl border border-[#60A5FA]/25 bg-[#0B1226] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[#93C5FD]">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Biografia profissional</span>
          </div>
          <p className="text-[11px] text-white/55 mt-1 leading-snug">
            A IA usa só os dados reais do barbeiro (nome, especialidade, serviços, atendimentos, avaliações). Nunca inventa cursos ou anos de carreira.
          </p>
          {generatedAt && (
            <p className="text-[10px] text-white/40 mt-1">
              Última geração: {formatDistanceToNow(new Date(generatedAt), { addSuffix: true, locale: ptBR })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={disabled || generating || !professionalId}
          title={!professionalId ? 'Salve o profissional primeiro' : ''}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-lg text-xs font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_24px_rgba(37,99,235,0.35)] transition-all"
        >
          {generating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Gerando…
            </>
          ) : hasAny ? (
            <>
              <RefreshCcw className="w-3.5 h-3.5" />
              Regerar
            </>
          ) : (
            <>
              <Wand2 className="w-3.5 h-3.5" />
              Gerar com IA
            </>
          )}
        </button>
      </div>

      {!professionalId && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-400/10 border border-amber-400/25">
          <AlertCircle className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
          <span className="text-[11px] text-amber-100">
            Salve o profissional para liberar a geração automática.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-400/25">
          <AlertCircle className="w-4 h-4 text-rose-300 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-rose-200">{error}</span>
        </div>
      )}

      {(hasAny || professionalId) && (
        <div className="space-y-3">
          <BioField
            label="Curta"
            hint="Até 150 caracteres — para listagens e cards"
            value={values.bio_short || ''}
            max={LIMITS.bio_short}
            rows={2}
            onChange={(v) => handleField('bio_short', v)}
            disabled={disabled}
          />
          <BioField
            label="Média"
            hint="Até 300 caracteres — para perfil resumido"
            value={values.bio_medium || ''}
            max={LIMITS.bio_medium}
            rows={3}
            onChange={(v) => handleField('bio_medium', v)}
            disabled={disabled}
          />
          <BioField
            label="Completa"
            hint="Até 600 caracteres — para página pública do barbeiro"
            value={values.bio_full || ''}
            max={LIMITS.bio_full}
            rows={5}
            onChange={(v) => handleField('bio_full', v)}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

function BioField({ label, hint, value, max, rows, onChange, disabled }) {
  const remaining = max - (value?.length || 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-bold uppercase tracking-wider text-white/70">{label}</label>
        <span className={`text-[10px] font-mono ${remaining < 0 ? 'text-rose-300' : 'text-white/40'}`}>
          {value?.length || 0}/{max}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={max}
        disabled={disabled}
        placeholder="Clique em 'Gerar com IA' para criar automaticamente."
        className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 resize-none leading-relaxed"
      />
      <p className="text-[10px] text-white/35 mt-0.5">{hint}</p>
    </div>
  );
}