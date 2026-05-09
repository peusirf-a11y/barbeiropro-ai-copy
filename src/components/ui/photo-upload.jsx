// PhotoUpload — componente reutilizável de upload de foto com preview, crop quadrado,
// compressão automática e fallback por iniciais.
//
// Uso:
//   <PhotoUpload value={photoUrl} onChange={(url) => setPhotoUrl(url)} fallbackText="João" />
//
// Funcionalidades:
//   - Aceita JPG, PNG, WEBP até 5MB
//   - Crop automático para 512x512 quadrado
//   - Compressão para JPEG quality 0.85 (performance mobile)
//   - Drag & drop no desktop, picker mobile
//   - Loading visual, fallback com iniciais

import { useRef, useState } from 'react';
import { Upload, X, Loader2, Camera } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;
const TARGET_SIZE = 512;

function getInitials(text) {
  if (!text) return '?';
  return text.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
}

// Crop central quadrado + redimensiona para TARGET_SIZE + comprime para JPEG
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
          0.85
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function PhotoUpload({ value, onChange, fallbackText = '', disabled = false }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

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
      setUploading(true);
      const processed = await processImage(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: processed });
      onChange(file_url);
    } catch (e) {
      console.error('[PhotoUpload]', e);
      setError(e?.message || 'Falha no upload. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ''; // permite re-selecionar o mesmo arquivo
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onRemove = () => {
    if (disabled || uploading) return;
    onChange('');
    setError('');
  };

  const initials = getInitials(fallbackText);

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled && !uploading) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex items-center gap-4 p-3 rounded-xl border-2 border-dashed transition-colors ${
          dragOver ? 'border-[#2563EB] bg-[#2563EB]/5' : 'border-black/10 bg-white'
        }`}
      >
        {/* Avatar / preview */}
        <div className="relative w-20 h-20 flex-shrink-0">
          {value ? (
            <img
              src={value}
              alt="Preview"
              className="w-20 h-20 rounded-xl object-cover ring-2 ring-white shadow-sm"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-white text-xl font-bold shadow-sm">
              {initials}
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
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
              disabled={disabled || uploading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2563EB] text-white rounded-lg text-xs font-semibold hover:bg-[#2563EB]/90 disabled:opacity-50 transition-colors"
            >
              {value ? <Camera className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
              {value ? 'Trocar foto' : 'Enviar foto'}
            </button>
            {value && (
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled || uploading}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-black/10 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Remover
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 hidden sm:block">
            Arraste aqui ou clique. JPG, PNG ou WEBP até {MAX_SIZE_MB}MB.
          </p>
          <p className="text-[11px] text-gray-400 mt-1.5 sm:hidden">
            Toque para selecionar da galeria.
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
        <p className="text-xs text-red-600 mt-1.5">{error}</p>
      )}
    </div>
  );
}