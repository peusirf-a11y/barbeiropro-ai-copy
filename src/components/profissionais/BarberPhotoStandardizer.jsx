// BarberPhotoStandardizer — Upload de foto de barbeiro com padronização inteligente de estúdio.
//
// Fluxo:
// 1. Barbearia faz upload da foto original
// 2. Imagem é padronizada automaticamente (neutralização de luz neon/colorida,
//    fundo de estúdio neutro e padronização de camisa Preta ou Branca)
// 3. Vincula imediatamente a versão padronizada ao formulário (onChange) para que,
//    mesmo se o usuário clicar direto em "Salvar" no rodapé do modal, a foto seja persistida.
// 4. Exibe comparativo Original vs Padronizada permitindo alternar a cor da camisa
//    em tempo real, aprovar a padronizada ou optar pela foto original.

import { useRef, useState } from 'react';
import {
  Upload,
  X,
  Loader2,
  Camera,
  Sparkles,
  RefreshCcw,
  Check,
  AlertCircle,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;
const TARGET_SIZE = 768;

function getInitials(text) {
  if (!text) return '?';
  return (
    text
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || '?'
  );
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
            const processed = new File([blob], `photo-${Date.now()}.jpg`, {
              type: 'image/jpeg',
            });
            resolve(processed);
          },
          'image/jpeg',
          0.88
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function dataUrlToFile(dataUrl, filename = `barber-studio-${Date.now()}.webp`) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/webp' });
}

export default function BarberPhotoStandardizer({
  value,
  onChange,
  fallbackText = '',
  disabled = false,
}) {
  const [phase, setPhase] = useState('idle'); // idle | uploading | standardizing | approving | review | error
  const [originalUrl, setOriginalUrl] = useState('');
  const [standardizedUrl, setStandardizedUrl] = useState('');
  const [shirtColor, setShirtColor] = useState('black'); // 'black' | 'white'
  const [approvedBadge, setApprovedBadge] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const reset = () => {
    setPhase('idle');
    setOriginalUrl('');
    setStandardizedUrl('');
    setError('');
  };

  const runStandardization = async (sourceUrl, targetShirtColor) => {
    setError('');
    setApprovedBadge(false);
    setPhase('standardizing');
    try {
      // Pequeno yield para garantir renderização imediata do estado de carregamento na UI
      await new Promise((r) => setTimeout(r, 60));
      const { data } = await base44.functions.invoke('standardizeBarberPhoto', {
        original_url: sourceUrl,
        shirt_color: targetShirtColor,
      });

      if (!data?.success || !data?.standardized_url) {
        throw new Error(data?.error || 'Não foi possível padronizar a imagem.');
      }

      setStandardizedUrl(data.standardized_url);
      // Vincula imediatamente ao formulário para que o botão "Salvar" do modal já tenha a foto pronta
      onChange(data.standardized_url);
      setPhase('review');
    } catch (e) {
      console.error('[BarberPhotoStandardizer] standardize error:', e);
      setError(e?.message || 'Falha ao padronizar foto. Usando foto original.');
      onChange(sourceUrl);
      setPhase('error');
    }
  };

  const handleFile = async (file) => {
    setError('');
    setApprovedBadge(false);
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
      setPhase('uploading');
      const processed = await processImage(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: processed });
      setOriginalUrl(file_url);
      onChange(file_url);

      await runStandardization(file_url, shirtColor);
    } catch (e) {
      console.error('[BarberPhotoStandardizer] upload error:', e);
      setError(e?.message || 'Falha ao carregar foto. Tente novamente.');
      setPhase('idle');
    }
  };

  const handleShirtColorSwitch = async (nextColor) => {
    setShirtColor(nextColor);
    if (originalUrl && (phase === 'review' || phase === 'error')) {
      await runStandardization(originalUrl, nextColor);
    }
  };

  const handleRegenerate = async () => {
    if (!originalUrl) return;
    await runStandardization(originalUrl, shirtColor);
  };

  const approveStandardized = async () => {
    if (!standardizedUrl) {
      reset();
      return;
    }
    setPhase('approving');
    try {
      let finalPhotoUrl = standardizedUrl;
      if (standardizedUrl.startsWith('data:image/')) {
        try {
          const fileObj = await dataUrlToFile(
            standardizedUrl,
            `barber-standardized-${shirtColor}-${Date.now()}.webp`
          );
          const uploaded = await base44.integrations.Core.UploadFile({ file: fileObj });
          if (uploaded?.file_url) {
            finalPhotoUrl = uploaded.file_url;
          }
        } catch (_) {
          finalPhotoUrl = standardizedUrl;
        }
      }
      onChange(finalPhotoUrl);
      setApprovedBadge(true);
    } finally {
      reset();
    }
  };

  const useOriginal = () => {
    if (originalUrl) {
      onChange(originalUrl);
    }
    setApprovedBadge(false);
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
    setApprovedBadge(false);
    reset();
  };

  const initials = getInitials(fallbackText);

  // ── ESTADO: REVIEW / STANDARDIZING / APPROVING / ERROR ────────────────
  if (
    phase === 'review' ||
    phase === 'standardizing' ||
    phase === 'approving' ||
    phase === 'error'
  ) {
    const isBusy = phase === 'standardizing' || phase === 'approving';
    return (
      <div className="rounded-xl border border-[#2563EB]/30 bg-card p-4 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-[#2563EB] dark:text-[#93C5FD]">
            {isBusy ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0" />
            )}
            <span className="text-xs font-bold uppercase tracking-wider">
              {phase === 'standardizing'
                ? 'Segmentando rosto, uniforme e fundo de estúdio…'
                : phase === 'approving'
                  ? 'Salvando versão padronizada…'
                  : 'Revisar padronização'}
            </span>
          </div>

          {/* Seletor de camisa ativo também durante a revisão */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Camisa:
            </span>
            <button
              type="button"
              onClick={() => handleShirtColorSwitch('black')}
              disabled={disabled || isBusy}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                shirtColor === 'black'
                  ? 'bg-[#2563EB]/15 border-[#2563EB] text-[#2563EB] dark:text-white shadow-sm'
                  : 'bg-background border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-slate-950 border border-slate-500 shrink-0" />
              Preta
            </button>
            <button
              type="button"
              onClick={() => handleShirtColorSwitch('white')}
              disabled={disabled || isBusy}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                shirtColor === 'white'
                  ? 'bg-[#2563EB]/15 border-[#2563EB] text-[#2563EB] dark:text-white shadow-sm'
                  : 'bg-background border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-400 shrink-0" />
              Branca
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Original */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Original
            </div>
            <div className="aspect-square rounded-xl overflow-hidden bg-muted/40 border border-border">
              {originalUrl ? (
                <img src={originalUrl} alt="Original" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                  —
                </div>
              )}
            </div>
          </div>

          {/* Padronizada */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] dark:text-[#93C5FD] flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Padronizada ({shirtColor === 'white' ? 'Camisa Branca' : 'Camisa Preta'})
            </div>
            <div className="aspect-square rounded-xl overflow-hidden bg-muted/40 border-2 border-[#2563EB] relative shadow-sm">
              {isBusy ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center bg-background/85 backdrop-blur-sm">
                  <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin" />
                  <span className="text-[11px] text-foreground font-semibold leading-tight">
                    {phase === 'approving'
                      ? 'Aplicando foto padronizada…'
                      : 'Aplicando uniforme e fundo de estúdio…'}
                  </span>
                </div>
              ) : standardizedUrl ? (
                <>
                  <img
                    src={standardizedUrl}
                    alt="Padronizada"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-[10px] font-bold shadow">
                    Ativa
                  </span>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                  —
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-rose-600 dark:text-rose-300">{error}</span>
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
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-[0_6px_18px_rgba(16,185,129,0.28)] transition-all"
              >
                <Check className="w-4 h-4" /> Aprovar versão padronizada
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={disabled}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-background border border-border text-foreground rounded-xl text-xs font-semibold hover:bg-muted transition-colors"
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> Tentar outra
                </button>
                <button
                  type="button"
                  onClick={useOriginal}
                  disabled={disabled}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-background border border-border text-foreground rounded-xl text-xs font-semibold hover:bg-muted transition-colors"
                >
                  Usar original
                </button>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
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
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#2563EB] text-white rounded-xl text-xs font-bold hover:bg-[#1d4ed8] transition-all"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Tentar novamente
              </button>
              <button
                type="button"
                onClick={useOriginal}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-background border border-border text-foreground rounded-xl text-xs font-semibold hover:bg-muted transition-colors"
              >
                Usar original
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
      <div className="flex items-center gap-4 p-3.5 rounded-xl border-2 border-dashed border-border bg-muted/20">
        {/* Avatar / preview da foto SALVA */}
        <div className="relative w-20 h-20 flex-shrink-0">
          {value ? (
            <img
              src={value}
              alt="Preview do barbeiro"
              className="w-20 h-20 rounded-xl object-cover ring-2 ring-[#2563EB]/30 shadow-sm"
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
          {value && approvedBadge && phase === 'idle' && (
            <span className="absolute -bottom-1.5 -right-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-bold shadow">
              <Check className="w-2.5 h-2.5" /> IA
            </span>
          )}
        </div>

        {/* Ações */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || phase === 'uploading'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2563EB] text-white rounded-xl text-xs font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors shadow-sm"
            >
              {value ? <Camera className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
              {value ? 'Trocar foto' : 'Enviar foto'}
            </button>
            {value && (
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled || phase === 'uploading'}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-background border border-border text-foreground rounded-xl text-xs font-semibold hover:bg-muted disabled:opacity-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Remover
              </button>
            )}
          </div>
          <p className="text-[11px] text-[#2563EB] dark:text-[#93C5FD] font-medium mt-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 shrink-0" />{' '}
            {approvedBadge && value
              ? 'Versão padronizada aprovada e pronta para salvar'
              : 'Padronizamos automaticamente com a IA'}
          </p>

          {/* Seletor de cor da camisa com contraste perfeito no tema claro e escuro */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Camisa:
            </span>
            <button
              type="button"
              onClick={() => setShirtColor('black')}
              disabled={disabled || phase === 'uploading'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                shirtColor === 'black'
                  ? 'bg-[#2563EB]/15 border-[#2563EB] text-[#2563EB] dark:text-white shadow-sm'
                  : 'bg-background border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-slate-950 border border-slate-500 shrink-0" />
              Preta
            </button>
            <button
              type="button"
              onClick={() => setShirtColor('white')}
              disabled={disabled || phase === 'uploading'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                shirtColor === 'white'
                  ? 'bg-[#2563EB]/15 border-[#2563EB] text-[#2563EB] dark:text-white shadow-sm'
                  : 'bg-background border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-400 shrink-0" />
              Branca
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground mt-1.5">
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
        <p className="text-xs text-rose-600 dark:text-rose-300 mt-1.5 font-medium">{error}</p>
      )}
    </div>
  );
}