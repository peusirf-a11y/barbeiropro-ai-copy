// ResetarSenha — Redefinição de senha com suporte a Código OTP de 6 dígitos ou Token do Link via Supabase Auth
import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import Logo from '@/components/Logo';
import { toast } from '@/components/ui/use-toast';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';

// Função utilitária para extrair o token mesmo se o usuário colar o link inteiro do e-mail
const extractCleanToken = (inputToken) => {
  if (!inputToken) return '';
  let clean = inputToken.trim();
  if (clean.includes('token=')) {
    const match = clean.match(/token=([a-zA-Z0-9_\-\.]+)/);
    if (match) clean = match[1];
  } else if (clean.includes('code=')) {
    const match = clean.match(/code=([a-zA-Z0-9_\-\.]+)/);
    if (match) clean = match[1];
  } else if (clean.includes('access_token=')) {
    const match = clean.match(/access_token=([a-zA-Z0-9_\-\.]+)/);
    if (match) clean = match[1];
  }
  return clean.trim();
};

export default function ResetarSenha() {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const initialEmail = searchParams.get('email') || '';
  const initialCode = extractCleanToken(searchParams.get('code') || searchParams.get('token') || '');

  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState(initialCode);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [hasValidSession, setHasValidSession] = useState(false);

  // Escuta e processa eventual sessão ativa ou troca de código PKCE
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      if (!isSupabaseConfigured || !supabase) return;

      try {
        const code = searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.warn('[ResetarSenha] Falha ao processar code PKCE:', exchangeError.message);
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (mounted && session?.user) {
          setHasValidSession(true);
          if (!email && session.user.email) {
            setEmail(session.user.email);
          }
        }
      } catch (err) {
        console.warn('[ResetarSenha] Erro ao verificar sessão:', err);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase?.auth?.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || Boolean(session?.user)) {
        setHasValidSession(true);
        if (session?.user?.email) {
          setEmail(session.user.email);
        }
      }
    }) || { data: { subscription: null } };

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const handleTokenChange = (e) => {
    const rawVal = e.target.value;
    const cleanVal = extractCleanToken(rawVal);
    setToken(cleanVal);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = extractCleanToken(token);
    const novaSenha = password.trim();
    const confirmaSenha = confirm.trim();

    // Se não há sessão ativa pré-estabelecida, o e-mail e o token são obrigatórios
    if (!hasValidSession) {
      if (!cleanEmail) {
        setError('Informe o e-mail cadastrado.');
        return;
      }
      if (!cleanToken) {
        setError('Cole ou digite o código de 6 dígitos ou o link/token do e-mail.');
        return;
      }
    }

    if (novaSenha.length < 8) {
      setError('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (novaSenha !== confirmaSenha) {
      setError('A confirmação de senha não coincide com a nova senha.');
      return;
    }

    setSubmitting(true);

    if (!isSupabaseConfigured || !supabase) {
      setError('Serviço de autenticação temporariamente indisponível.');
      setSubmitting(false);
      return;
    }

    try {
      // 1. Se informou token OTP/link ou não possui sessão ativa, valida o verifyOtp primeiro
      if (cleanToken && cleanEmail) {
        console.log('[ResetarSenha] Validando verifyOtp para:', cleanEmail, 'com token:', cleanToken);
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: 'recovery',
        });

        if (verifyError) {
          console.warn('[ResetarSenha] Erro verifyOtp:', verifyError.message);
          throw verifyError;
        }
        console.log('[ResetarSenha] Código/Token OTP validado com sucesso.');
      }

      // 2. Atualiza a senha no Supabase Auth
      console.log('[ResetarSenha] Enviando atualização de senha para o Supabase Auth...');
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: novaSenha,
      });

      if (updateError) {
        console.warn('[ResetarSenha] Erro retornado pelo Supabase:', updateError.message);
        throw updateError;
      }

      console.log('[ResetarSenha] Senha alterada com sucesso!');
      setSuccess(true);
      toast({
        title: 'Senha alterada com sucesso!',
        description: 'Sua nova senha foi salva. Redirecionando para o login...',
      });

      setPassword('');
      setConfirm('');

      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1800);
    } catch (err) {
      console.warn('[ResetarSenha] Exceção ao atualizar senha:', err);
      const msg = err?.message || 'Código/token inválido ou sessão expirada. Tente solicitar um novo código.';
      setError(msg);
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar senha',
        description: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] font-inter flex flex-col justify-between">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-95 transition-opacity">
            <Logo size={32} />
          </Link>
          <Link
            to="/login"
            className="text-xs font-semibold text-slate-500 hover:text-[#2563EB] inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao login
          </Link>
        </div>
      </header>

      {/* Main Form */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="max-w-md w-full animate-fade-in-up">
          {/* Headline */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] mb-4 shadow-sm">
              <KeyRound className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mb-2">
              Redefinir Senha
            </h1>
            <p className="text-sm text-slate-500">
              {hasValidSession
                ? 'Escolha sua nova senha de acesso ao painel.'
                : 'Cole o código ou link/token recebido no e-mail e crie sua nova senha.'}
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 p-6 sm:p-8">
            {success ? (
              <div className="text-center py-4 space-y-3 animate-fade-in">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-[#0F172A]">Senha alterada com sucesso!</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Sua nova senha foi gravada com sucesso no Supabase. Redirecionando para o login…
                </p>
                <div className="pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                  >
                    Ir para o login agora
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Se não houver sessão ativa, solicita o e-mail e o código/token OTP */}
                {!hasValidSession && (
                  <>
                    {/* E-mail */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        E-mail
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={submitting}
                          placeholder="seu@email.com"
                          required
                          className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-[#0F172A] placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
                        />
                      </div>
                    </div>

                    {/* Código ou Token do e-mail */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                          Código OTP ou Link/Token do e-mail
                        </label>
                        <Link
                          to="/esqueci-senha"
                          className="text-[11px] font-bold text-[#2563EB] hover:underline"
                        >
                          Solicitar novo código
                        </Link>
                      </div>
                      <div className="relative">
                        <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          autoComplete="one-time-code"
                          value={token}
                          onChange={handleTokenChange}
                          disabled={submitting}
                          placeholder="Cole o código de 6 dígitos ou o link/token do e-mail"
                          required
                          className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs sm:text-sm font-mono text-[#0F172A] placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Você pode digitar os 6 dígitos ou colar a URL completa com o parâmetro verify?token=...
                      </p>
                    </div>
                  </>
                )}

                {/* Nova senha */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Nova senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      placeholder="Mínimo 8 caracteres"
                      required
                      autoFocus={hasValidSession}
                      className="w-full h-12 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-[#0F172A] placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && password.length < 8 && (
                    <p className="text-[11px] font-medium text-amber-600 mt-1">
                      A senha precisa ter no mínimo 8 caracteres.
                    </p>
                  )}
                </div>

                {/* Confirmar nova senha */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Confirmar nova senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      disabled={submitting}
                      placeholder="Repita a nova senha"
                      required
                      className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-[#0F172A] placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
                    />
                  </div>
                  {confirm && password !== confirm && (
                    <p className="text-[11px] font-medium text-amber-600 mt-1">
                      As senhas não coincidem.
                    </p>
                  )}
                </div>

                {error && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 flex items-start gap-2.5 text-xs text-rose-800 animate-shake">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                    <div className="font-medium leading-relaxed">{error}</div>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    password.length < 8 ||
                    password !== confirm ||
                    (!hasValidSession && (!email.trim() || !token.trim()))
                  }
                  className="w-full h-12 mt-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validando código e salvando…</span>
                    </>
                  ) : (
                    'Validar Código e Redefinir Senha'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-100">
        <p>© 2026 O CORTE. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}