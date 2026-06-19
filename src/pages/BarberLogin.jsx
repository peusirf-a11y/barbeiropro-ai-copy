// BarberLogin — Tela de login com email + senha (auth própria O CORTE, Fase 1).
//
// UX:
//   - Email + senha + botão "Entrar".
//   - Link "Esqueci minha senha" (placeholder, Fase 2).
//   - Mostra erros estáveis (invalid_credentials, account_locked).
//   - Em sucesso, seta o token Base44 e redireciona para /app/dashboard.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';
import { AlertCircle, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';

export default function BarberLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Preencha email e senha.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('loginBarberCredential', {
        email: cleanEmail,
        password,
      });
      const data = res?.data || {};

      if (!data.ok) {
        if (data.error === 'account_locked') {
          const until = data.locked_until ? new Date(data.locked_until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
          setError(`Conta bloqueada por excesso de tentativas. Tente novamente após ${until}.`);
        } else if (data.error === 'invalid_credentials') {
          setError('Email ou senha incorretos.');
        } else if (data.error === 'base44_login_failed') {
          setError('Não conseguimos validar sua conta. Use a opção "Esqueci minha senha".');
        } else {
          setError('Não foi possível entrar. Tente novamente.');
        }
        setSubmitting(false);
        return;
      }

      // Sucesso: seta token Base44 e redireciona.
      if (data.access_token && typeof base44.auth.setToken === 'function') {
        base44.auth.setToken(data.access_token);
      }
      window.location.href = '/app/dashboard';
    } catch (err) {
      console.error('[BarberLogin] submit_failed', err);
      setError('Não conseguimos entrar agora. Tente novamente em instantes.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-inter">
      <header className="bg-white/80 backdrop-blur-sm border-b border-black/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Logo size={32} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Acessar painel
          </span>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-16 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] mb-4 shadow-sm">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mb-2">
            Entrar no O CORTE
          </h1>
          <p className="text-sm text-gray-500">
            Acesse seu painel com email e senha.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-black/8 shadow-sm p-6 space-y-4"
        >
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                placeholder="seu@email.com"
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-gray-200 bg-white text-sm text-[#0F172A] placeholder-gray-400"
                autoFocus
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Senha
              </label>
              <Link to="/esqueci-senha" className="text-[11px] font-semibold text-[#2563EB] hover:underline">
                Esqueci a senha
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                placeholder="••••••••"
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-gray-200 bg-white text-sm text-[#0F172A] placeholder-gray-400"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-start gap-2 text-sm text-rose-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Entrando…
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="flex items-center justify-center gap-2 mt-8 text-[11px] text-gray-400">
          <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Acesso seguro e criptografado</span>
        </div>
      </div>
    </div>
  );
}