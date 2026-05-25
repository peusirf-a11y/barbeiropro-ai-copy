// GoogleAccessCard — Opção recomendada na tela /ativar-acesso.
// CTA: continuar com Google (mais rápido, sem senha).
import { Loader2, ArrowRight, Sparkles } from 'lucide-react';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}

export default function GoogleAccessCard({ onClick, busy, disabled, recommended }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left rounded-2xl border p-5 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
        recommended
          ? 'bg-[#0F172A] border-[#0F172A] text-white hover:bg-[#1E293B] shadow-md'
          : 'bg-white border-black/10 hover:border-[#2563EB]/40 hover:bg-[#2563EB]/[0.02]'
      }`}
    >
      {recommended && (
        <div className="inline-flex items-center gap-1.5 mb-3 px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold uppercase tracking-wider">
          <Sparkles className="w-3 h-3" /> Recomendado
        </div>
      )}
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          recommended ? 'bg-white' : 'bg-gray-50'
        }`}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-base font-bold ${recommended ? 'text-white' : 'text-[#0F172A]'}`}>
            Continuar com Google
          </div>
          <div className={`text-[13px] mt-0.5 ${recommended ? 'text-white/70' : 'text-gray-500'}`}>
            Mais rápido e sem precisar criar senha
          </div>
        </div>
        <ArrowRight className={`w-5 h-5 flex-shrink-0 ${recommended ? 'text-white/70' : 'text-gray-400'}`} />
      </div>
    </button>
  );
}