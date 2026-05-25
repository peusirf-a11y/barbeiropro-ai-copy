// ExistingLoginCard — Opção 3 em /ativar-acesso (usuários que já têm senha).
import { Loader2, Lock, ArrowRight } from 'lucide-react';

export default function ExistingLoginCard({ onClick, busy, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left rounded-2xl border border-black/8 bg-white p-4 hover:border-black/20 hover:bg-gray-50 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center flex-shrink-0">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#0F172A]">Já tenho senha — entrar</div>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>
    </button>
  );
}