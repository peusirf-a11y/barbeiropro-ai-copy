// EsqueciSenha — Solicita link de redefinição por email.
// Resposta sempre neutra (anti-enumeração).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBarberAuth } from '@/lib/BarberAuthContext';
import AuthShell from '@/components/auth/AuthShell';
import { Mail, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function EsqueciSenha() {
  const { requestReset } = useBarberAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try { await requestReset(email.trim().toLowerCase()); } catch { /* neutro */ }
    setSent(true);
    setBusy(false);
  };

  return (
    <AuthShell>
      <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-7 sm:p-8">
        {sent ? (
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-black text-[#0F172A]">Verifique seu email</h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Se o email <strong className="text-[#0F172A] break-all">{email}</strong> estiver cadastrado, enviamos um link para redefinir sua senha. O link expira em 1 hora.
            </p>
            <Link to="/entrar" className="inline-block mt-6 text-[#2563EB] hover:underline font-semibold text-sm">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Esqueci minha senha</h1>
            <p className="text-sm text-gray-500 mt-1.5">Informe seu email para receber o link de redefinição.</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-3 py-3.5 bg-white border border-black/10 rounded-xl text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                  autoComplete="email"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={busy || !email}
                className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-[0.99]"
              >
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Enviar link <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>

            <Link to="/entrar" className="block mt-5 text-center text-sm text-gray-500 hover:text-[#0F172A]">
              Voltar para o login
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}