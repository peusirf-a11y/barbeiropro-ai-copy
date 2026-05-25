// CreatePasswordCard — Opção 2 em /ativar-acesso.
// Dispara o envio do link de criação de senha via requestPasswordSetup.
import { Loader2, KeyRound, CheckCircle2, Mail } from 'lucide-react';

export default function CreatePasswordCard({ onClick, busy, disabled, sent, email, recommended }) {
  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 animate-fade-in">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-[#0F172A]">Link enviado!</div>
            <p className="text-[13px] text-emerald-900/80 mt-1 leading-relaxed">
              Abra o email enviado para <strong className="break-all">{email}</strong> e clique em <strong>"Definir senha"</strong>.
            </p>
            <button
              onClick={onClick}
              disabled={disabled || busy}
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 hover:text-emerald-900 transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
              Reenviar link
            </button>
          </div>
        </div>
      </div>
    );
  }

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
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          recommended ? 'bg-white/10 text-white' : 'bg-gray-50 text-[#0F172A]'
        }`}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-base font-bold ${recommended ? 'text-white' : 'text-[#0F172A]'}`}>
            Criar senha de acesso
          </div>
          <div className={`text-[13px] mt-0.5 ${recommended ? 'text-white/70' : 'text-gray-500'}`}>
            Receba um link para definir sua senha
          </div>
        </div>
      </div>
    </button>
  );
}