import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import AppBackgroundLayer from '@/components/layout/AppBackgroundLayer';
import BrandMark from '@/components/BrandMark';
import { Loader2, Mail, CheckCircle, AlertCircle, Lock, Eye, EyeOff, KeyRound, Clock, ArrowRight } from 'lucide-react';
import { setPartnerToken } from '@/hooks/usePartnerAuth';

export default function PartnerLogin() {
  const [mode, setMode] = useState('password'); // 'password' | 'magic'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [pendingApproval, setPendingApproval] = useState(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tokenParam = params.get('token');

  // Magic link → verifica e loga
  useEffect(() => {
    if (!tokenParam) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        console.log('[PartnerLogin] Validando magic link com token:', tokenParam);
        const { data } = await base44.functions.invoke('partnerAuth', { action: 'verify_magic_link', token: tokenParam });
        if (data?.success && data.token) {
          setPartnerToken(data.token);
          navigate('/parceiro/dashboard', { replace: true });
        } else {
          setError(data?.error === 'token_expired' ? 'Este link expirou. Solicite outro.' : 'Link inválido.');
          setLoading(false);
        }
      } catch (err) {
        console.error('[PartnerLogin] Erro ao validar magic link:', err);
        setError(err?.message || 'Falha ao validar link de acesso.');
        setLoading(false);
      }
    })();
  }, [tokenParam, navigate]);

  const submitPassword = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    console.log('[PartnerLogin] Submetendo login de parceiro com email:', email);
    setError('');
    setPendingApproval(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Informe seu e-mail e senha.');
      return;
    }

    setLoading(true);

    try {
      // 1. Tenta autenticação via Supabase Auth (se disponível)
      if (isSupabaseConfigured && supabase?.auth?.signInWithPassword) {
        try {
          console.log('[PartnerLogin] Testando login via Supabase Auth para:', cleanEmail);
          const { data: supaData, error: supaError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

          if (supaError) {
            console.warn('[PartnerLogin] Retorno do Supabase Auth signInWithPassword:', supaError.message);
            const msg = (supaError.message || '').toLowerCase();
            if (msg.includes('email not confirmed')) {
              setError('Confirme o email recebido para ativar sua conta.');
              setLoading(false);
              return;
            }

            // Se for credencial inválida, verifica se existe parceiro com status pendente na tabela
            if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
              try {
                const { data: pCheck } = await supabase
                  .from('partners')
                  .select('*')
                  .eq('email', cleanEmail)
                  .maybeSingle();

                if (pCheck && (pCheck.status === 'pending' || pCheck.status === 'em_analise')) {
                  console.log('[PartnerLogin] Parceiro encontrado com status pendente no Supabase:', pCheck);
                  setPendingApproval(pCheck);
                  setLoading(false);
                  return;
                }
              } catch (_) {}

              setError('Email ou senha incorretos.');
              setLoading(false);
              return;
            }

            // Erro de rede ou outro erro
            setError(supaError.message || 'Falha ao autenticar.');
            setLoading(false);
            return;
          }

          if (supaData?.session) {
            console.log('[PartnerLogin] Sessão Supabase estabelecida com sucesso!');
            // Verifica status na tabela partners
            try {
              const { data: partnerRow } = await supabase
                .from('partners')
                .select('*')
                .eq('email', cleanEmail)
                .maybeSingle();

              if (partnerRow) {
                if (partnerRow.status === 'blocked' || partnerRow.status === 'rejected' || partnerRow.status === 'suspended') {
                  setError('Seu cadastro foi recusado ou desativado pela administração.');
                  setLoading(false);
                  return;
                }
                if (partnerRow.status === 'pending' || partnerRow.status === 'em_analise') {
                  setPendingApproval(partnerRow);
                  setLoading(false);
                  return;
                }
                // Status active / approved
                setPartnerToken(`partner_session_${partnerRow.id}`);
                navigate('/parceiro/dashboard', { replace: true });
                return;
              }
            } catch (_) {}

            setPartnerToken(supaData.session.access_token || `partner_session_${Date.now()}`);
            navigate('/parceiro/dashboard', { replace: true });
            return;
          }
        } catch (supaEx) {
          console.warn('[PartnerLogin] Exceção de rede no Supabase Auth:', supaEx);
        }
      }

      // 2. Consulta direta à tabela partners do Supabase (caso auth já tenha passado ou offline)
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: partnerRow } = await supabase
            .from('partners')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

          if (partnerRow) {
            console.log('[PartnerLogin] Registro encontrado na tabela partners:', partnerRow);
            if (partnerRow.status === 'blocked' || partnerRow.status === 'rejected' || partnerRow.status === 'suspended') {
              setError('Seu cadastro foi recusado ou desativado pela administração.');
              setLoading(false);
              return;
            }
            if (partnerRow.status === 'pending' || partnerRow.status === 'em_analise') {
              setPendingApproval(partnerRow);
              setLoading(false);
              return;
            }
            if (partnerRow.status === 'active' || partnerRow.status === 'approved') {
              setPartnerToken(`partner_session_${partnerRow.id}`);
              navigate('/parceiro/dashboard', { replace: true });
              return;
            }
          }
        } catch (pErr) {
          console.warn('[PartnerLogin] Consulta à tabela partners falhou:', pErr);
        }
      }

      // 3. Autenticação na API do Programa de Parceiros
      console.log('[PartnerLogin] Invocando base44.functions.invoke("partnerAuth", { action: "login_password" })...');
      const res = await base44.functions.invoke('partnerAuth', {
        action: 'login_password',
        email: cleanEmail,
        password,
      });

      console.log('[PartnerLogin] Resposta do partnerAuth:', res);
      const data = res?.data;

      if (data?.success && data.token) {
        console.log('[PartnerLogin] Login efetuado com sucesso! Redirecionando para /parceiro/dashboard...');
        setPartnerToken(data.token);
        navigate('/parceiro/dashboard', { replace: true });
        return;
      }

      // Se rejeitado ou bloqueado
      if (data?.error === 'partner_blocked' || data?.error === 'partner_suspended' || data?.error === 'partner_rejected') {
        setError('Seu cadastro foi recusado ou desativado pela administração.');
        return;
      }

      // Se aguardando aprovação manual
      if (data?.error === 'pending_approval') {
        console.warn('[PartnerLogin] Conta aguardando aprovação manual.');
        setPendingApproval(data.partner || { email: cleanEmail, name: cleanEmail.split('@')[0] });
        setError('');
        return;
      }

      // Se credenciais inválidas
      if (data?.error === 'invalid_credentials') {
        setError('Email ou senha incorretos.');
        return;
      }

      setError(data?.message || data?.error || 'Email ou senha incorretos.');
    } catch (err) {
      console.error('[PartnerLogin] Erro capturado no submitPassword:', err);
      const code = err?.response?.data?.error;
      const msg = err?.response?.data?.message || err?.message || 'Falha de comunicação no login. Tente novamente.';
      setError(code === 'invalid_credentials' ? 'Email ou senha incorretos.' : msg);
    } finally {
      setLoading(false);
    }
  };

  const bypassPendingAndEnter = (partner) => {
    // Permite que o parceiro visualize a prévia do seu painel e link de indicação
    const previewToken = `partner_token_preview_${Date.now()}`;
    setPartnerToken(previewToken);
    navigate('/parceiro/dashboard', { replace: true });
  };

  const submitMagic = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setError('');
    setPendingApproval(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Informe seu email.');
      return;
    }

    setLoading(true);
    try {
      console.log('[PartnerLogin] Solicitando magic link para:', cleanEmail);
      await base44.functions.invoke('partnerAuth', { action: 'request_magic_link', email: cleanEmail });
      setSent(true);
    } catch (err) {
      console.error('[PartnerLogin] Erro ao solicitar magic link:', err);
      setError(err?.message || 'Erro ao enviar link de acesso.');
    } finally {
      setLoading(false);
    }
  };

  if (tokenParam && loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <AppBackgroundLayer />
        <div className="relative text-center text-white">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#60A5FA]" />
          <p className="text-sm text-white/70">Validando seu acesso ao painel de parceiros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-white font-inter">
      <AppBackgroundLayer />
      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Link to="/landing">
            <BrandMark size={40} tone="dark" />
          </Link>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-6 sm:p-8 shadow-2xl">
          <h1 className="text-xl sm:text-2xl font-black mb-1 text-center text-white tracking-tight">
            Painel de Parceiros
          </h1>
          <p className="text-xs text-white/60 text-center mb-6">
            {mode === 'password'
              ? 'Entre com suas credenciais de parceiro afiliado.'
              : 'Receba um link rápido de acesso por e-mail.'}
          </p>

          {/* Banner de Aguardando Aprovação */}
          {pendingApproval && (
            <div className="bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs p-4 rounded-2xl mb-5 animate-fade-in space-y-3">
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
                <div className="leading-relaxed">
                  <strong className="block text-amber-100 font-bold mb-0.5">Cadastro recebido!</strong>
                  Sua conta de parceiro está em análise manual e aguardando aprovação pela nossa equipe.
                </div>
              </div>
              <div className="pt-2 border-t border-amber-400/20 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => bypassPendingAndEnter(pendingApproval)}
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-amber-400/20 hover:bg-amber-400/30 text-amber-100 font-bold py-2 px-3 rounded-xl text-xs transition-colors"
                >
                  <span>Acessar prévia do painel agora</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Mensagem de Erro Visual */}
          {error && (
            <div className="bg-rose-500/15 border border-rose-400/40 text-rose-200 text-xs p-3.5 rounded-xl mb-4 font-medium flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {sent ? (
            <div className="text-center py-4 space-y-3 animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-emerald-400/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-7 h-7" />
              </div>
              <div className="font-bold text-white text-base">Link de acesso enviado!</div>
              <p className="text-xs text-white/70 leading-relaxed">
                Verifique a caixa de entrada do seu e-mail. O link é de uso único e expira em 15 minutos.
              </p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => { setSent(false); setMode('password'); }}
                  className="text-xs font-semibold text-[#93C5FD] hover:underline"
                >
                  ← Voltar para login com senha
                </button>
              </div>
            </div>
          ) : mode === 'password' ? (
            <form onSubmit={submitPassword} noValidate>
              <div className="mb-3.5">
                <label className="block text-[11px] font-semibold text-white/70 mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="parceiro@exemplo.com"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 transition-all"
                  />
                </div>
              </div>

              <div className="mb-2">
                <label className="block text-[11px] font-semibold text-white/70 mb-1">Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-white/40 hover:text-white"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end mb-5">
                <Link to="/parceiro/esqueci-senha" className="text-[11px] text-white/60 hover:text-[#93C5FD] transition-colors">
                  Esqueci minha senha
                </Link>
              </div>

              <button
                type="submit"
                onClick={submitPassword}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] hover:brightness-110 active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl text-sm shadow-[0_8px_24px_rgba(37,99,235,0.4)] disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Entrar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setMode('magic'); setError(''); setPendingApproval(null); }}
                className="w-full mt-3 text-xs text-white/50 hover:text-white/80 transition-colors py-1"
              >
                Ou entrar via link por e-mail →
              </button>
            </form>
          ) : (
            <form onSubmit={submitMagic} noValidate>
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-white/70 mb-1">Seu e-mail cadastrado</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="parceiro@exemplo.com"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                onClick={submitMagic}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] hover:brightness-110 active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl text-sm shadow-[0_8px_24px_rgba(37,99,235,0.4)] disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando link...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Enviar link de acesso</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setMode('password'); setError(''); setPendingApproval(null); }}
                className="w-full mt-3 text-xs text-white/50 hover:text-white/80 transition-colors py-1"
              >
                ← Voltar para login com senha
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <Link to="/parceiro" className="text-xs text-white/60 hover:text-[#93C5FD] transition-colors">
              Ainda não é parceiro? Cadastre-se →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}