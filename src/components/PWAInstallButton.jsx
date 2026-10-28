import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export default function PWAInstallButton({ className = '' }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-[#60A5FA]/35 bg-[#2563EB]/15 px-3 py-2 text-xs font-bold text-[#93C5FD] hover:bg-[#2563EB]/25 transition-colors cursor-pointer ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/[0.08] transition-colors cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-[#93C5FD]" />
          <span>Instalar App</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/12 bg-[#0A1124] p-6 text-white shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                <h3 className="text-base font-bold text-white">Instalar O CORTE no iPhone</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-2.5 text-xs text-white/75 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#93C5FD]">1.</span>
                  <span>
                    Toque no botão <strong>Compartilhar</strong> (<Share className="inline w-3.5 h-3.5 text-[#93C5FD]" />) na barra do Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#93C5FD]">2.</span>
                  <span>
                    Role para baixo e selecione <strong>&ldquo;Adicionar à Tela de Início&rdquo;</strong>.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[#2563EB] py-2.5 text-xs font-bold text-white hover:bg-[#1D4ED8] transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
