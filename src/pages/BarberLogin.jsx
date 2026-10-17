// BarberLogin — Tela de login oficial, limpa e profissional
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import Logo from '@/components/Logo';
import { AlertCircle, Loader2, Lock, Mail, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function BarberLogin() {
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated } = useAuth();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [email, setEmail] = useState((params.get('email') || '').trim().toLowerCase());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Informe seu e-mail e senha para continuar.');
      return;
    }

    setSubmitting(true);

    if (!isSupabaseConfigured || !supabase) {
      setError('Sistema temporariamente indisponível. Tente novamente em instantes.');
      setSubmitting(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password.trim(),
      });

      if (authError) {
        console.warn('[Login] Credenciais inválidas:', authError.message);

        // Diagnóstico: verifica se o e-mail consta na tabela team_members
        let pendingMember = null;
        try {
          const { data: tmData } = await supabase
            .from('team_members')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

          if (tmData) pendingMember = tmData;
        } catch (_) {}

        if (pendingMember) {
          setError(
            <span>
              O seu acesso ainda não foi ativado ou a sua senha precisa ser definida.{' '}
              <Link
                to={`/definir-senha?email=${encodeURIComponent(cleanEmail)}&token=${pendingMember.invite_token || ''}`}
                className="font-bold underline text-[#2563EB] hover:text-blue-800"
              >
                Clique aqui para definir a sua senha
              </Link>
            </span>
          );
        } else {
          setError('E-mail ou senha incorretos. Verifique suas credenciais.');
        }
        setSubmitting(false);
        return;
      }

      const session = data?.session;
      const user = session?.user;

      if (user) {
        user.is_super_admin = user.email === 'pedrojesantos@hotmail.com' || user.app_metadata?.role === 'superadmin' || user.user_metadata?.role === 'superadmin';

        // Consulta team_members para carregar papel e permissões reais
        let teamRole = null;
        try {
          const { data: tm } = await supabase
            .from('team_members')
            .select('*')
            .ilike('email', cleanEmail)
            .maybeSingle();

          if (tm) {
            teamRole = tm.role;
            user.role = tm.role;
            user.company_id = tm.company_id;
            user.professional_id = tm.professional_id || null;
            user.full_name = tm.name || user.user_metadata?.name || null;
            user.isBarbeiro = tm.role === 'barbeiro';
          }
        } catch (_) {}

        setUser?.(user);
        setIsAuthenticated?.(true);

        try {
          localStorage.setItem('admin_logged_user', JSON.stringify(user));
          localStorage.setItem('barberpass_auth_email', cleanEmail);
        } catch (_) {}

        // Redireciona imediatamente para o painel correspondente
        if (user.is_super_admin) {
          navigate('/master/dashboard', { replace: true });
        } else if (user.isBarbeiro || teamRole === 'barbeiro') {
          navigate('/app/agenda', { replace: true });
        } else {
          navigate('/app/dashboard', { replace: true });
        }
      } else {
        setError('Não foi possível obter a sessão do usuário. Tente novamente.');
        setSubmitting(false);
      }

    } catch (err) {
      console.warn('[Login] Exceção durante autenticação:', err);
      setError('Erro de conexão ao autenticar. Tente novamente.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] font-inter flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-95 transition-opacity">
            <Logo size={32} />
          </Link>
          <Link
            to="/checkout"
            className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
          >
            Quero ser parceiro →
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="max-w-md w-full animate-fade-in-up">
          {/* Headline */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] mb-4 shadow-sm">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mb-2">
              Acesse sua conta
            </h1>
            <p className="text-sm text-slate-500">
              Gerencie sua barbearia, agendamentos e clientes.
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
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
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Senha
                  </label>
                  <Link
                    to="/esqueci-senha"
                    className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] hover:underline"
                  >
                    Esqueci a senha
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    placeholder="••••••••"
                    required
                    className="w-full h-12 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-[#0F172A] placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 flex items-start gap-2.5 text-xs text-rose-800 animate-shake">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                  <div className="font-medium leading-relaxed">{error}</div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 mt-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Entrando…</span>
                  </>
                ) : (
                  <>
                    <span>Entrar na plataforma</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Bottom Register CTA */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                Ainda não tem uma assinatura?{' '}
                <Link
                  to="/checkout"
                  className="font-bold text-[#2563EB] hover:text-[#1D4ED8] hover:underline"
                >
                  Cadastre sua barbearia
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-100">
        <p>© {new Date().getFullYear()} O CORTE · BarberPass. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}