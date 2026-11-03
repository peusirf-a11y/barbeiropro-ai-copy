// BarberPhotoStandardizer / BarberPhotoUpload — Upload direto e limpo de foto do profissional
// Permite que o barbeiro carregue e salve a sua foto original diretamente no Supabase Storage.
// Sem pré-visualizações lado a lado, sem seletores de camisa e sem botões de aprovação de IA.

import { useRef, useState } from 'react';
import { Upload, X, Loader2, Camera, User } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;
const TARGET_SIZE = 512;

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

// Processa e comprime a foto original para formato quadrado otimizado (512x512)
async function processImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('A imagem selecionada é inválida ou está corrompida.'));
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
            if (!blob) return reject(new Error('Falha ao comprimir imagem.'));
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

// Upload direto para o Supabase Storage com fallback resiliente para UploadFile
async function uploadToStorage(file) {
  if (isSupabaseConfigured && supabase?.storage) {
    try {
      const ext = file.name ? file.name.split('.').pop() : 'jpg';
      const fileName = `professional-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const { data, error } = await supabase.storage.from('avatars').upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

      if (!error && data?.path) {
        const { data: pubData } = supabase.storage.from('avatars').getPublicUrl(data.path);
        if (pubData?.publicUrl) {
          return pubData.publicUrl;
        }
      }
    } catch (storageErr) {
      console.warn('[BarberPhotoUpload] Fallback de storage:', storageErr);
    }
  }

  // Fallback padrão da aplicação
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return file_url;
}

export default function BarberPhotoStandardizer({
  value,
  onChange,
  fallbackText = '',
  disabled = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    setError('');
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato inválido. Use imagens JPG, PNG ou WEBP.');
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Imagem muito grande (máximo ${MAX_SIZE_MB}MB).`);
      return;
    }

    try {
      setUploading(true);
      const processed = await processImage(file);
      const publicUrl = await uploadToStorage(processed);
      onChange(publicUrl);
    } catch (err) {
      console.error('[BarberPhotoUpload] Erro ao enviar foto:', err);
      setError(err?.message || 'Falha no upload da foto. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onRemove = () => {
    if (disabled || uploading) return;
    onChange('');
    setError('');
  };

  const initials = getInitials(fallbackText);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 p-3.5 rounded-xl border border-white/10 bg-white/[0.03]">
        {/* Pré-visualização simples da foto do profissional */}
        <div className="relative w-20 h-20 flex-shrink-0">
          {value ? (
            <img
              src={value}
              alt={fallbackText || 'Foto do profissional'}
              className="w-20 h-20 rounded-xl object-cover ring-2 ring-[#2563EB]/40 shadow-sm bg-neutral-900"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center text-white text-xl font-bold shadow-sm">
              {initials !== '?' ? initials : <User className="w-8 h-8 opacity-75" />}
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs rounded-xl flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Botões de Ação Direta */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || uploading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Enviando…
                </>
              ) : value ? (
                <>
                  <Camera className="w-3.5 h-3.5" />
                  Trocar foto
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Carregar foto
                </>
              )}
            </button>

            {value && !uploading && (
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/[0.05] hover:bg-white/[0.10] border border-white/10 text-white/80 hover:text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Remover
              </button>
            )}
          </div>

          <p className="text-[11px] text-white/45 mt-1.5">
            Formatos suportados: JPG, PNG ou WEBP até {MAX_SIZE_MB}MB.
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
        <p className="text-xs text-rose-400 font-medium pl-1">{error}</p>
      )}
    </div>
  );
}

export { BarberPhotoStandardizer as BarberPhotoUpload };