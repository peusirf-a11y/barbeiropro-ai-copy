// Register — página customizada de cadastro pós-checkout.
// Acessada via link do email após pagamento confirmado:
//   /Register?email=...&from_url=/app/dashboard
// Dispara a tela oficial Base44 para criar senha (email + senha).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';
import { Mail, KeyRound, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const email = (params.get('email') || '').trim().toLowerCase();
  const fromUrl = params.get('from_url') || '/app/dashboard';

  useEffect(() => {
    base44.auth.isAuthenticated().then((auth) => {
      if (auth) navigate(fromUrl, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = () => {
    if (busy) return;
    setBusy(true);
    base44.auth.redirectToLogin(fromUrl);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-inter">
      <header className="bg-white/80 backdrop-blur-sm border-b border-black/5 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Logo size={32} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Criar minha senha
          </span>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-16 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] mb-4 shadow-sm">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mb-2">
            Crie sua senha de acesso
          </h1>
          <p className="text-sm text-gray-500">
            Você será levado à tela oficial de cadastro. Use o email abaixo e escolha uma senha segura.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2563EB]/8 text-[#2563EB] flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">
                Seu email
              </div>
              <div className="text-sm font-semibold text-[#0F172A] break-all">
                {email || '—'}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={busy}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[#0F172A] text-white hover:bg-[#1E293B] shadow-md transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-bold">Continuar para criar senha</div>
            <div className="text-[12px] text-white/70 mt-0.5">Abrir tela oficial de cadastro</div>
          </div>
          <ArrowRight className="w-4 h-4 text-white/70 flex-shrink-0" />
        </button>

        <div className="flex items-center justify-center gap-2 mt-8 text-[11px] text-gray-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Acesso seguro e criptografado · O CORTE</span>
        </div>
      </div>
    </div>
  );
}