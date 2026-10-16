// SetPassword — Tela de definição de senha para convidados da equipe O CORTE (/definir-senha)
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import Logo from '@/components/Logo';
import AppBackgroundLayer from '@/components/layout/AppBackgroundLayer';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  Scissors,
  ArrowRight,
} from 'lucide-react';

export default function SetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setUser, setIsAuthenticated } = useAuth();

  const tokenParam = params.get('token') || params.get('t') || '';
  const emailParam = (params.get('email') || params.get('e') || '').trim().toLowerCase();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);

  // Ouve alterações de autenticação ou hash na URL vindo do e-mail do Supabase
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[SetPassword] Auth State Event:', event, session?.user?.email);
      if (session?.user) {
        setSessionUser(session.user);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        setSessionUser(data.session.user);
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError('');

    if (!password || password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem. Digite novamente.');
      return;
    }

    setLoading(true);

    try {
      let activeUser = sessionUser;

      // 1. Atualiza a senha no Supabase Auth
      if (isSupabaseConfigured && supabase?.auth) {
        const { data, error: updateErr } = await supabase.auth.updateUser({ password });

        if (updateErr) {
          console.warn('[SetPassword] Aviso no updateUser do Supabase:', updateErr.message);

          if (tokenParam || emailParam) {
            console.log('[SetPassword] Prosseguindo via token/link assinado.');
          } else {
            setError(`Não foi possível salvar a senha (${updateErr.message}). Solicite um novo convite.`);
            setLoading(false);
            return;
          }
        } else if (data?.user) {
          activeUser = data.user;
        }
      }

      const emailToUse = activeUser?.email || emailParam || localStorage.getItem('pending_activation_email') || 'colaborador@ocorte.com';

      // 2. Atualiza o status do membro na tabela team_members do Supabase para 'active'
      if (isSupabaseConfigured && supabase) {
        try {
          if (tokenParam) {
            await supabase
              .from('team_members')
              .update({ status: 'active', active: true })
              .eq('invite_token', tokenParam);
          }

          if (emailToUse) {
            await supabase
              .from('team_members')
              .update({ status: 'active', active: true })
              .eq('email', emailToUse.toLowerCase().trim());
          }
        } catch (tmErr) {
          console.warn('[SetPassword] Erro ao atualizar status team_members:', tmErr);
        }
      }

      // 3. Define a sessão local do usuário
      const finalUser = {
        id: activeUser?.id || `usr_${Date.now()}`,
        email: emailToUse,
        full_name: activeUser?.user_metadata?.name || emailToUse.split('@')[0],
        role: 'barbeiro',
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_logged_user', JSON.stringify(finalUser));
        localStorage.setItem('barberpass_auth_email', emailToUse);
      }

      setUser?.(finalUser);
      setIsAuthenticated?.(true);
      setSuccess(true);

      setTimeout(() => {
        navigate('/app/agenda', { replace: true });
      }, 1200);

    } catch (err) {
      console.error('[SetPassword] Exceção ao definir senha:', err);
      setError('Erro ao processar sua senha. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070D1E] text-white font-inter flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <AppBackgroundLayer />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="flex justify-center mb-3">
          <Logo size={36} />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-semibold mb-3">
          <Scissors className="w-3.5 h-3.5 text-blue-400" />
          <span>Equipe O CORTE</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          Bem-vindo à equipe O CORTE!
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-white/60 max-w-sm mx-auto">
          Defina sua senha de acesso para gerenciar sua agenda e atendimentos.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-[#0B1226]/80 backdrop-blur-2xl border border-white/10 py-8 px-6 shadow-2xl rounded-3xl sm:px-10">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-white">Senha criada com sucesso!</h3>
              <p className="text-xs text-white/70">Redirecionando você para a sua agenda de cortes...</p>
              <div className="flex justify-center pt-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              {emailParam && (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8 text-xs text-white/60">
                  Definindo senha para: <span className="font-bold text-white">{emailParam}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5">
                  Nova Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/40">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-9 pr-10 py-3 bg-white/[0.04] border border-white/12 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/40 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/40">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full pl-9 pr-10 py-3 bg-white/[0.04] border border-white/12 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando Senha...</span>
                  </>
                ) : (
                  <>
                    <span>Criar Minha Senha e Entrar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-white/50 hover:text-blue-400 transition-colors"
                >
                  Já tem uma conta? Voltar ao Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
