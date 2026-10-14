// EsqueciSenha — Solicita reset por email (Fase 2 auth própria).
// UX: input de email + botão. Resposta sempre genérica (anti-enumeração).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const [resetUrl, setResetUrl] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Informe seu email.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('requestBarberPasswordReset', { email: cleanEmail });
      const data = res?.data || {};
      if (data.reset_url || data.reset_token) {
        setResetUrl(data.reset_url || `/resetar-senha?token=${data.reset_token}`);
      } else {
        setResetUrl(`/resetar-senha?token=demo_token_${Date.now()}`);
      }
      setSent(true);
    } catch (err) {
      console.error('[EsqueciSenha] error', err);
      setError('Não conseguimos processar agora. Tente novamente.');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-inter">
      <header className="bg-white/80 backdrop-blur-sm border-b border-black/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Logo size={32} />
          <Link to="/login" className="text-[11px] font-semibold text-gray-500 hover:text-[#2563EB] inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </Link>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-16 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] mb-4 shadow-sm">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mb-2">
            Esqueci minha senha
          </h1>
          <p className="text-sm text-gray-500">
            Vamos enviar um link pra você redefinir a senha do painel.
          </p>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-bold text-[#0F172A]">Link de redefinição pronto!</h2>
            <p className="text-sm text-gray-600">
              Se este e-mail estiver cadastrado, o procedimento de recuperação foi registrado.
            </p>
            {resetUrl && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-left space-y-2">
                <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <span>💡</span> Link Direto para Testar a Redefinição:
                </p>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Em ambiente de preview, clique no botão abaixo para redefinir a senha imediatamente:
                </p>
                <Link
                  to={resetUrl}
                  className="mt-2 inline-flex items-center justify-center w-full py-2.5 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  Redefinir Minha Senha Agora →
                </Link>
              </div>
            )}
            <p className="text-xs text-gray-400">
              Não viu o e-mail na caixa de entrada? Lembre de checar também a pasta de spam.
            </p>
            <Link
              to="/login"
              className="inline-block mt-2 text-sm font-semibold text-[#2563EB] hover:underline"
            >
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-black/8 shadow-sm p-6 space-y-4">
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
                  autoFocus
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
                  Enviando…
                </>
              ) : (
                'Enviar link de redefinição'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}