// EsqueciSenha — Recuperação de Senha via Código OTP de 6 dígitos ou Token do Link (Supabase Auth)
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import Logo from '@/components/Logo';
import { toast } from '@/components/ui/use-toast';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RotateCw,
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

export default function EsqueciSenha() {
  const navigate = useNavigate();

  // Etapa do fluxo: 1 = Informar e-mail | 2 = Digitar código OTP/Token e nova senha
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Contador regressivo para reenvio do código OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // ETAPA 1: Enviar código OTP para o e-mail
  const handleRequestOtp = async (e) => {
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
      if (isSupabaseConfigured && supabase) {
        console.log('[EsqueciSenha] Solicitando código OTP para:', cleanEmail);
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail);

        if (resetError) {
          console.warn('[EsqueciSenha] Erro retornado pelo Supabase:', resetError.message);
          setError(resetError.message || 'Erro ao enviar código de recuperação.');
          setSubmitting(false);
          return;
        }
      }

      setStep(2);
      setCountdown(60);
      toast({
        title: 'Código/Link enviado!',
        description: `Verifique o código ou link de recuperação enviado para ${cleanEmail}.`,
      });
    } catch (err) {
      console.warn('[EsqueciSenha] Exceção ao solicitar código:', err);
      setError(err?.message || 'Falha ao solicitar código de recuperação.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reenviar código OTP
  const handleResendOtp = async () => {
    if (resending || countdown > 0) return;
    setResending(true);
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    try {
      if (isSupabaseConfigured && supabase) {
        console.log('[EsqueciSenha] Reenviando código OTP para:', cleanEmail);
        const { error: resendError } = await supabase.auth.resetPasswordForEmail(cleanEmail);
        if (resendError) {
          throw resendError;
        }
      }
      setCountdown(60);
      toast({
        title: 'Novo código enviado!',
        description: `Um novo código/link foi enviado para ${cleanEmail}.`,
      });
    } catch (err) {
      console.warn('[EsqueciSenha] Erro ao reenviar:', err);
      setError(err?.message || 'Erro ao reenviar código. Aguarde alguns instantes.');
    } finally {
      setResending(false);
    }
  };

  // Manipulador para o campo de token, limpando URLs coladas automaticamente
  const handleTokenChange = (e) => {
    const rawVal = e.target.value;
    const cleanVal = extractCleanToken(rawVal);
    setToken(cleanVal);
  };

  // ETAPA 2: Validar código OTP e Atualizar Senha imediatamente
  const handleVerifyOtpAndReset = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = extractCleanToken(token);
    const novaSenha = newPassword.trim();
    const confirmaSenha = confirmPassword.trim();

    if (!cleanToken) {
      setError('Cole ou digite o código de 6 dígitos ou o token/link recebido no e-mail.');
      return;
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

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Serviço de autenticação temporariamente indisponível.');
      }

      // 1. Valida o token OTP de recuperação e abre a sessão autenticada
      console.log('[EsqueciSenha] Validando verifyOtp para:', cleanEmail, 'Token:', cleanToken);
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'recovery',
      });

      if (verifyError) {
        console.warn('[EsqueciSenha] Erro no verifyOtp:', verifyError.message);
        throw verifyError;
      }

      console.log('[EsqueciSenha] Código/Token validado com sucesso! Sessão ativa estabelecida.');

      // 2. Com a sessão estabelecida pelo verifyOtp, atualiza a senha imediatamente
      console.log('[EsqueciSenha] Atualizando senha do usuário via updateUser...');
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: novaSenha,
      });

      if (updateError) {
        console.warn('[EsqueciSenha] Erro no updateUser:', updateError.message);
        throw updateError;
      }

      // 3. Sucesso completo
      console.log('[EsqueciSenha] Senha alterada com sucesso!');
      setSuccess(true);
      toast({
        title: 'Senha alterada com sucesso!',
        description: 'Sua nova senha foi salva. Redirecionando para o login...',
      });

      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1800);
    } catch (err) {
      console.warn('[EsqueciSenha] Falha ao validar token e salvar senha:', err);
      const msg = err?.message || 'Código ou token inválido ou expirado. Tente novamente.';
      setError(msg);
      toast({
        variant: 'destructive',
        title: 'Erro na validação',
        description: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-inter flex flex-col justify-between">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-black/5 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-95 transition-opacity">
            <Logo size={32} />
          </Link>
          <Link
            to="/login"
            className="text-xs font-semibold text-gray-500 hover:text-[#2563EB] inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao login
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16">
        <div className="max-w-md w-full animate-fade-in-up">
          {/* Top Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] mb-4 shadow-sm">
              {step === 1 ? <Mail className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mb-2">
              {step === 1 ? 'Recuperar senha' : 'Confirmar código e nova senha'}
            </h1>
            <p className="text-sm text-gray-500">
              {step === 1
                ? 'Informe seu e-mail para receber as instruções de recuperação.'
                : 'Cole o código de 6 dígitos ou o link/token recebido por e-mail e crie sua nova senha.'}
            </p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl border border-black/8 shadow-xl shadow-slate-200/50 p-6 sm:p-8">
            {success ? (
              <div className="text-center py-4 space-y-4 animate-fade-in">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-[#0F172A]">Senha alterada com sucesso!</h2>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Sua nova credencial foi gravada no Supabase. Redirecionando para a tela de login...
                </p>
                <div className="pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                  >
                    Entrar no painel agora →
                  </Link>
                </div>
              </div>
            ) : step === 1 ? (
              /* ETAPA 1: SOLICITAÇÃO DO E-MAIL */
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Seu e-mail cadastrado
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={submitting}
                      placeholder="exemplo@barbearia.com"
                      required
                      autoFocus
                      className="w-full h-12 pl-10 pr-3 rounded-xl border border-gray-200 bg-slate-50/50 text-sm text-[#0F172A] placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 flex items-start gap-2.5 text-xs text-rose-800 animate-shake">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                    <div className="font-medium leading-relaxed">{error}</div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !email.trim()}
                  className="w-full h-12 mt-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gerando recuperação…</span>
                    </>
                  ) : (
                    'Enviar código / link de recuperação'
                  )}
                </button>
              </form>
            ) : (
              /* ETAPA 2: DIGITAR CÓDIGO/TOKEN E NOVA SENHA */
              <form onSubmit={handleVerifyOtpAndReset} className="space-y-4">
                {/* Badge do e-mail de destino */}
                <div className="rounded-xl bg-blue-50/80 border border-blue-200/60 p-3 flex items-center justify-between text-xs text-blue-900">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Mail className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0" />
                    <span className="truncate font-semibold">{email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setError('');
                    }}
                    className="text-[11px] font-bold text-[#2563EB] hover:underline flex-shrink-0 ml-2"
                  >
                    Alterar
                  </button>
                </div>

                {/* Código OTP ou Token completo do e-mail */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500">
                      Código ou Token do E-mail
                    </label>
                    <button
                      type="button"
                      disabled={resending || countdown > 0}
                      onClick={handleResendOtp}
                      className="font-semibold text-[11px] text-[#2563EB] hover:underline disabled:opacity-50 disabled:no-underline inline-flex items-center gap-1"
                    >
                      {resending ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Reenviando...
                        </>
                      ) : countdown > 0 ? (
                        `Reenviar em ${countdown}s`
                      ) : (
                        <>
                          <RotateCw className="w-3 h-3" />
                          Reenviar
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      autoComplete="one-time-code"
                      value={token}
                      onChange={handleTokenChange}
                      disabled={submitting}
                      placeholder="Cole o código de 6 dígitos ou o link/token do e-mail"
                      required
                      autoFocus
                      className="w-full h-12 pl-10 pr-3 rounded-xl border border-gray-200 bg-slate-50/50 text-xs sm:text-sm font-mono text-[#0F172A] placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Você pode digitar o código numérico ou colar a URL inteira do link de recuperação recebido.
                  </p>
                </div>

                {/* Nova Senha */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={submitting}
                      placeholder="Mínimo 8 caracteres"
                      required
                      className="w-full h-12 pl-10 pr-10 rounded-xl border border-gray-200 bg-slate-50/50 text-sm text-[#0F172A] placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPassword && newPassword.length < 8 && (
                    <p className="text-[11px] font-medium text-amber-600 mt-1">
                      A senha precisa ter no mínimo 8 caracteres.
                    </p>
                  )}
                </div>

                {/* Confirmar Nova Senha */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={submitting}
                      placeholder="Repita a nova senha"
                      required
                      className="w-full h-12 pl-10 pr-3 rounded-xl border border-gray-200 bg-slate-50/50 text-sm text-[#0F172A] placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
                    />
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
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

                <button
                  type="submit"
                  disabled={submitting || !token.trim() || newPassword.length < 8 || newPassword !== confirmPassword}
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
      <footer className="py-6 text-center text-xs text-gray-400 border-t border-black/5">
        <p>© {new Date().getFullYear()} O CORTE · BarberPass. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}