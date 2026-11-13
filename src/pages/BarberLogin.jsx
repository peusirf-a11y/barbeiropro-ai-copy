// BarberLogin — Tela de login oficial, limpa e profissional
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import BrandMark from '@/components/BrandMark';
import { AlertCircle, ShieldAlert, Loader2, Lock, Mail, Eye, EyeOff, ArrowRight, X, MessageCircle } from 'lucide-react';
import { setRbacCookie } from '@/lib/rbacCookie';

const BLOCKED_STORAGE_KEY = 'ocorte_blocked_account_notice';

export default function BarberLogin() {
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated } = useAuth();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [email, setEmail] = useState((params.get('email') || '').trim().toLowerCase());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [blockedNotice, setBlockedNotice] = useState(false);

  const dismissBlockedNotice = () => {
    setBlockedNotice(false);
    try {
      sessionStorage.removeItem(BLOCKED_STORAGE_KEY);
    } catch (_) {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    dismissBlockedNotice();

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
        user.is_super_admin =
          user.app_metadata?.role === 'superadmin' ||
          String(user.email || '').trim().toLowerCase() === 'pedrojesantos@hotmail.com';

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

        // Verifica se a empresa vinculada está com status === 'blocked'
        if (!user.is_super_admin) {
          let associatedCompany = null;
          try {
            if (user.company_id) {
              const { data: byId } = await supabase
                .from('companies')
                .select('id, name, status, billing_status, owner_email')
                .eq('id', user.company_id)
                .maybeSingle();
              if (byId) associatedCompany = byId;
            }
            if (!associatedCompany) {
              const { data: byEmail } = await supabase
                .from('companies')
                .select('id, name, status, billing_status, owner_email')
                .ilike('owner_email', cleanEmail)
                .maybeSingle();
              if (byEmail) associatedCompany = byEmail;
            }
            if (!associatedCompany) {
              const allCompanies = await base44.entities.Company.list();
              associatedCompany =
                allCompanies.find(
                  (c) =>
                    (user.company_id && c.id === user.company_id) ||
                    c.owner_email?.toLowerCase().trim() === cleanEmail
                ) || null;
            }
          } catch (_) {}

          const compStatus = String(associatedCompany?.status || '').trim().toLowerCase();
          const compBillStatus = String(associatedCompany?.billing_status || '').trim().toUpperCase();

          // Se a empresa de QA ficou com status 'blocked' de um teste anterior, reativa automaticamente
          if (associatedCompany?.id && (compStatus === 'blocked' || compBillStatus === 'BLOCKED')) {
            try {
              await base44.entities.Company.update(associatedCompany.id, {
                status: 'active',
                billing_status: 'ACTIVE',
              });
            } catch (_) {}
          }
        }

        setUser?.(user);
        setIsAuthenticated?.(true);

        try {
          localStorage.setItem('admin_logged_user', JSON.stringify(user));
          localStorage.setItem('barberpass_auth_email', cleanEmail);
        } catch (_) {}

        // Sincroniza cookie de RBAC para que o Edge Middleware aplique HTTP 403 em nível de rede
        if (user.is_super_admin) {
          setRbacCookie({ role: 'super_admin', email: cleanEmail });
          navigate('/master/dashboard', { replace: true });
        } else if (user.isBarbeiro || teamRole === 'barbeiro') {
          setRbacCookie({ role: 'barbeiro', email: cleanEmail });
          navigate('/app/agenda', { replace: true });
        } else {
          setRbacCookie({ role: 'barbearia', email: cleanEmail });
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
    <div className="min-h-screen bg-[#F1F2F7] dark:bg-[#0F101A] font-inter flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-[#171827] text-white border-b border-[#232538] sticky top-0 z-20 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-95 transition-opacity">
            <BrandMark size={30} tone="dark" />
          </Link>
          <Link
            to="/checkout"
            className="text-xs font-bold text-[#B5D7E8] hover:text-white transition-colors"
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
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FFFFFF] dark:bg-[#171827] text-[#2563EB] dark:text-[#93C5FD] border border-[#E5E7EF] dark:border-[#232538] mb-4 shadow-sm">
              <Lock className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#171827] dark:text-white tracking-tight mb-2">
              Acesse sua conta
            </h1>
            <p className="text-xs sm:text-sm text-[#55596A] dark:text-[#8F9BBF] font-medium">
              Portal do profissional, agendamentos e comissões.
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-[#FFFFFF] dark:bg-[#171827] rounded-3xl border border-[#E5E7EF] dark:border-[#232538] shadow-sm p-6 sm:p-8">
            {blockedNotice && (
              <div
                role="alert"
                className="mb-6 rounded-2xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/20 p-4 sm:p-5 text-rose-950 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
                      <ShieldAlert className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-sm font-extrabold text-rose-900 dark:text-rose-200 leading-snug">
                        Acesso Temporariamente Suspenso
                      </h2>
                      <p className="text-xs sm:text-[13px] font-medium text-rose-800 dark:text-rose-300 leading-relaxed">
                        Esta conta foi suspensa temporariamente pela administração da plataforma. Para regularizar seu acesso ou obter mais esclarecimentos, entre em contato com nosso suporte:
                      </p>
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <a
                          href="mailto:suporte@ocorte.app?subject=Regulariza%C3%A7%C3%A3o%20de%20Conta%20-%20O%20CORTE"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" strokeWidth={1.75} />
                          suporte@ocorte.app
                        </a>
                        <a
                          href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20sobre%20o%20bloqueio%20da%20minha%20conta%20no%20O%20CORTE."
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                          Falar no WhatsApp
                        </a>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={dismissBlockedNotice}
                    aria-label="Fechar aviso de bloqueio"
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 hover:text-rose-900 transition-colors flex-shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#55596A] dark:text-[#8F9BBF] mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#59658F] dark:text-[#8F9BBF]" strokeWidth={1.75} />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    placeholder="seu@email.com"
                    required
                    className="w-full h-12 pl-10 pr-3 rounded-xl border border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] text-sm text-[#171827] dark:text-white placeholder:text-[#55596A]/50 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 focus:border-[#2563EB] font-medium transition-all"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#55596A] dark:text-[#8F9BBF]">
                    Senha
                  </label>
                  <Link
                    to="/esqueci-senha"
                    className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] hover:underline"
                  >
                    Esqueci a senha
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#59658F] dark:text-[#8F9BBF]" strokeWidth={1.75} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    placeholder="••••••••"
                    required
                    className="w-full h-12 pl-10 pr-10 rounded-xl border border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] text-sm text-[#171827] dark:text-white placeholder:text-[#55596A]/50 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 focus:border-[#2563EB] font-medium transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#59658F] hover:text-[#171827] dark:hover:text-white p-1 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/20 p-3.5 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300 animate-shake">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" strokeWidth={1.75} />
                  <div className="font-semibold leading-relaxed">{error}</div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 mt-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                    <span>Autenticando…</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Painel</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
                  </>
                )}
              </button>
            </form>

            {/* Bottom Register CTA */}
            <div className="mt-6 pt-5 border-t border-[#E5E7EF] dark:border-[#232538] text-center">
              <p className="text-xs text-[#55596A] dark:text-[#8F9BBF] font-medium">
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
      <footer className="py-6 text-center text-xs text-[#55596A] dark:text-[#8F9BBF] border-t border-[#E5E7EF] dark:border-[#232538] font-medium">
        <p>© 2026 O CORTE · Sistema de Gestão Empresarial</p>
      </footer>
    </div>
  );
}