// BarberPhotoStandardizer — Upload de foto de barbeiro com padronização IA.
//
// Fluxo:
// 1. Barbearia faz upload da foto original
// 2. Imagem é enviada à IA (standardizeBarberPhoto) — preserva identidade,
//    aplica camisa preta lisa, fundo neutro
// 3. Mostra "Processando..." durante a geração
// 4. Exibe Original vs Padronizada lado a lado
// 5. Barbearia escolhe: aprovar padronizada, refazer, ou usar original
// 6. onChange só é chamado com a URL aprovada
//
// Uso: <BarberPhotoStandardizer value={photoUrl} onChange={setUrl} fallbackText="João" />

import { useRef, useState } from 'react';
import { Upload, X, Loader2, Camera, Sparkles, RefreshCcw, Check, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;
const TARGET_SIZE = 1024; // maior para a IA ter mais qualidade pra trabalhar

function getInitials(text) {
  if (!text) return '?';
  return text.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
}

async function processImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.onload = () => {
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = TARGET_SIZE;
        canvas.height = TARGET_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, TARGET_SIZE, TARGET_SIZE);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Falha ao processar imagem'));
            const processed = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
            resolve(processed);
          },
          'image/jpeg',
          0.9
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function BarberPhotoStandardizer({ value, onChange, fallbackText = '', disabled = false }) {
  const [phase, setPhase] = useState('idle'); // idle | uploading | standardizing | review | error
  const [originalUrl, setOriginalUrl] = useState('');
  const [standardizedUrl, setStandardizedUrl] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const reset = () => {
    setPhase('idle');
    setOriginalUrl('');
    setStandardizedUrl('');
    setError('');
  };

  const handleFile = async (file) => {
    setError('');
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato inválido. Use JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Imagem muito grande (máx ${MAX_SIZE_MB}MB).`);
      return;
    }

    try {
      // 1. Upload original
      setPhase('uploading');
      const processed = await processImage(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: processed });
      setOriginalUrl(file_url);

      // 2. Padroniza via IA
      setPhase('standardizing');
      const { data } = await base44.functions.invoke('standardizeBarberPhoto', {
        original_url: file_url,
      });

      if (!data?.success || !data?.standardized_url) {
        throw new Error(data?.error || 'A IA não conseguiu gerar a foto padronizada.');
      }

      setStandardizedUrl(data.standardized_url);
      setPhase('review');
    } catch (e) {
      console.error('[BarberPhotoStandardizer]', e);
      setError(e?.message || 'Falha ao processar foto. Tente novamente.');
      setPhase(originalUrl ? 'error' : 'idle');
    }
  };

  const handleRegenerate = async () => {
    if (!originalUrl) return;
    setError('');
    try {
      setPhase('standardizing');
      const { data } = await base44.functions.invoke('standardizeBarberPhoto', {
        original_url: originalUrl,
      });
      if (!data?.success || !data?.standardized_url) {
        throw new Error(data?.error || 'Falha ao gerar nova versão.');
      }
      setStandardizedUrl(data.standardized_url);
      setPhase('review');
    } catch (e) {
      console.error('[BarberPhotoStandardizer] regenerate', e);
      setError(e?.message || 'Falha ao gerar nova versão.');
      setPhase('error');
    }
  };

  const approveStandardized = () => {
    onChange(standardizedUrl);
    reset();
  };

  const useOriginal = () => {
    onChange(originalUrl);
    reset();
  };

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onRemove = () => {
    if (disabled) return;
    onChange('');
    reset();
  };

  const initials = getInitials(fallbackText);

  // ── ESTADO: REVIEW (mostra original vs padronizada) ──────────────────
  if (phase === 'review' || phase === 'standardizing' || phase === 'error') {
    return (
      <div className="rounded-xl border border-[#60A5FA]/25 bg-[#0B1226] p-4 space-y-3">
        <div className="flex items-center gap-2 text-[#93C5FD]">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">
            {phase === 'standardizing' ? 'Padronizando com IA…' : 'Revisar padronização'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Original */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Original</div>
            <div className="aspect-square rounded-xl overflow-hidden bg-black/30 border border-white/10">
              {originalUrl ? (
                <img src={originalUrl} alt="Original" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">—</div>
              )}
            </div>
          </div>

          {/* Padronizada */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#93C5FD] flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Padronizada
            </div>
            <div className="aspect-square rounded-xl overflow-hidden bg-black/30 border border-[#60A5FA]/30 relative">
              {phase === 'standardizing' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#1D4ED8]/20 to-[#3B82F6]/20">
                  <Loader2 className="w-8 h-8 text-[#93C5FD] animate-spin" />
                  <span className="text-[11px] text-white/70 font-semibold">Processando…</span>
                  <span className="text-[9px] text-white/40">leva ~10s</span>
                </div>
              ) : standardizedUrl ? (
                <img src={standardizedUrl} alt="Padronizada" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">—</div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-400/25">
            <AlertCircle className="w-4 h-4 text-rose-300 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-rose-200">{error}</span>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-col gap-2">
          {phase === 'review' && (
            <>
              <button
                type="button"
                onClick={approveStandardized}
                disabled={disabled}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-lg text-sm font-bold hover:brightness-110 shadow-[0_8px_24px_rgba(16,185,129,0.35)] transition-all"
              >
                <Check className="w-4 h-4" /> Aprovar versão padronizada
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={disabled}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white/[0.04] border border-white/15 text-white/85 rounded-lg text-xs font-semibold hover:bg-white/[0.08] transition-colors"
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> Tentar outra
                </button>
                <button
                  type="button"
                  onClick={useOriginal}
                  disabled={disabled}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white/[0.04] border border-white/15 text-white/85 rounded-lg text-xs font-semibold hover:bg-white/[0.08] transition-colors"
                >
                  Usar original
                </button>
              </div>
              <button
                type="button"
                onClick={reset}
                disabled={disabled}
                className="text-[11px] text-white/45 hover:text-white/70 transition-colors"
              >
                Cancelar e enviar outra foto
              </button>
            </>
          )}

          {phase === 'error' && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleRegenerate}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#2563EB] text-white rounded-lg text-xs font-bold hover:brightness-110 transition-all"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Tentar novamente
              </button>
              <button
                type="button"
                onClick={useOriginal}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white/[0.04] border border-white/15 text-white/85 rounded-lg text-xs font-semibold hover:bg-white/[0.08] transition-colors"
              >
                Usar original mesmo assim
              </button>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={onInputChange}
          className="hidden"
        />
      </div>
    );
  }

  // ── ESTADO: IDLE / UPLOADING (mostra foto salva ou área de upload) ───
  return (
    <div>
      <div className="flex items-center gap-4 p-3 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.025]">
        {/* Avatar / preview da foto SALVA (não da que está em revisão) */}
        <div className="relative w-20 h-20 flex-shrink-0">
          {value ? (
            <img
              src={value}
              alt="Preview"
              className="w-20 h-20 rounded-xl object-cover ring-2 ring-white/15 shadow-sm"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-white text-xl font-bold shadow-sm">
              {initials}
            </div>
          )}
          {phase === 'uploading' && (
            <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || phase === 'uploading'}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2563EB] text-white rounded-lg text-xs font-semibold hover:bg-[#2563EB]/90 disabled:opacity-50 transition-colors"
            >
              {value ? <Camera className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
              {value ? 'Trocar foto' : 'Enviar foto'}
            </button>
            {value && (
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled || phase === 'uploading'}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] border border-white/15 text-white/75 rounded-lg text-xs font-semibold hover:bg-white/[0.08] disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Remover
              </button>
            )}
          </div>
          <p className="text-[11px] text-[#93C5FD]/80 mt-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Padronizamos automaticamente com camisa preta
          </p>
          <p className="text-[10px] text-white/40 mt-0.5">
            JPG, PNG ou WEBP até {MAX_SIZE_MB}MB
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={onInputChange}
          className="hidden"
        />
      </div>

      {error && (
        <p className="text-xs text-rose-300 mt-1.5">{error}</p>
      )}
    </div>
  );
}