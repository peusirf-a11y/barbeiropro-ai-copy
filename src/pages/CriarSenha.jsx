// CriarSenha — Tela pós-checkout onde o dono define a senha do painel (Fase 3).
//
// Fluxo:
//   1. Recebe ?email=...&plan=... do /checkout/sucesso.
//   2. Dono escolhe nova senha (mín 8, letra + número).
//   3. Chama registerBarberCredential.
//      - Se 409 (já existe credencial), redireciona pro /login com o email.
//   4. Em sucesso, chama loginBarberCredential com a senha recém-criada,
//      seta o token Base44 e redireciona pra /app/dashboard.
//
// É a tela "Bem-vindo, defina sua senha" — fluxo principal pós-checkout.

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Sparkles,
} from 'lucide-react';

const PLAN_LABEL = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };

function passwordStrength(p) {
  if (!p) return { ok: false, msg: '' };
  if (p.length < 8) return { ok: false, msg: 'Mínimo de 8 caracteres.' };
  if (!/[A-Za-z]/.test(p)) return { ok: false, msg: 'Precisa de ao menos 1 letra.' };
  if (!/\d/.test(p)) return { ok: false, msg: 'Precisa de ao menos 1 número.' };
  return { ok: true, msg: 'Senha forte.' };
}

export default function CriarSenha() {
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const email = (params.get('email') || '').trim().toLowerCase();
  const planKey = (params.get('plan') || '').toLowerCase();
  const planName = PLAN_LABEL[planKey] || 'O CORTE';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const strength = passwordStrength(password);
  const canSubmit = !!email && strength.ok && password === confirm && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);

    try {
      // 1) Cria credencial.
      const regRes = await base44.functions.invoke('registerBarberCredential', {
        email,
        password,
      });
      const regData = regRes?.data || {};

      if (!regData.ok) {
        if (regData.error === 'credential_already_exists') {
          // Conta já tem senha — manda direto pro login.
          navigate(`/login?email=${encodeURIComponent(email)}`, { replace: true });
          return;
        }
        if (regData.error === 'no_company_for_email') {
          setError('Não encontramos uma compra recente vinculada a este email. Verifique o link ou refaça o checkout.');
        } else if (regData.error === 'weak_password') {
          setError('Senha fraca. Use ao menos 8 caracteres com letras e números.');
        } else {
          setError('Não conseguimos criar sua senha agora. Tente novamente em instantes.');
        }
        setSubmitting(false);
        return;
      }

      // 2) Faz login automático.
      const loginRes = await base44.functions.invoke('loginBarberCredential', {
        email,
        password,
      });
      const loginData = loginRes?.data || {};
      if (loginData.ok && loginData.access_token) {
        if (typeof base44.auth.setToken === 'function') {
          base44.auth.setToken(loginData.access_token);
        }
        window.location.href = '/app/dashboard';
        return;
      }

      // Login falhou por algum motivo — manda pro /login pra ele tentar manualmente.
      navigate(`/login?email=${encodeURIComponent(email)}`, { replace: true });
    } catch (err) {
      console.error('[CriarSenha] submit_failed', err);
      setError('Erro inesperado. Tente novamente.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-inter">
      <header className="bg-white/80 backdrop-blur-sm border-b border-black/5 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Logo size={32} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Bem-vindo a bordo
          </span>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-14 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] mb-4 shadow-sm">
            <KeyRound className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mb-2">
            Crie sua senha de acesso
          </h1>
          <p className="text-sm sm:text-base text-gray-500 max-w-md mx-auto">
            Pagamento confirmado! Defina uma senha pra entrar no seu painel sempre que quiser.
          </p>
        </div>

        {/* Resumo da conta */}
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-3">
            <SummaryItem icon={Mail} label="Email" value={email || '—'} valueClass="break-all" />
            <SummaryItem icon={Sparkles} label="Plano" value={`O CORTE · ${planName}`} />
            <SummaryItem icon={Clock} label="Trial" value="7 dias grátis" valueClass="text-emerald-700" />
          </div>
        </div>

        {/* Form */}
        {!email ? (
          <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-6 text-center">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-[#0F172A] mb-2">Link incompleto</h2>
            <p className="text-sm text-gray-600 mb-4">
              Não recebemos seu email. Refaça o checkout ou tente acessar pela tela de login.
            </p>
            <Link to="/login" className="text-sm font-semibold text-[#2563EB] hover:underline">
              Ir para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-black/8 shadow-sm p-6 space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Nova senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  placeholder="Mínimo 8 caracteres"
                  autoFocus
                  className="w-full h-11 pl-10 pr-10 rounded-xl border border-gray-200 bg-white text-sm text-[#0F172A] placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && (
                <div className={`mt-1.5 text-[11px] font-semibold ${strength.ok ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {strength.msg}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Confirmar senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={submitting}
                  placeholder="Repita a senha"
                  className="w-full h-11 pl-10 pr-3 rounded-xl border border-gray-200 bg-white text-sm text-[#0F172A] placeholder-gray-400"
                />
              </div>
              {confirm && password !== confirm && (
                <div className="mt-1.5 text-[11px] font-semibold text-amber-600">
                  As senhas não são iguais.
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-start gap-2 text-sm text-rose-800">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-11 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Criando sua conta…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Criar senha e entrar
                </>
              )}
            </button>

            <Link
              to={`/login?email=${encodeURIComponent(email)}`}
              className="block text-center text-xs font-semibold text-gray-500 hover:text-[#2563EB]"
            >
              Já tenho senha — ir para o login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}

function SummaryItem({ icon: Icon, label, value, valueClass = '' }) {
  return (
    <div className="flex sm:flex-col items-start gap-3 sm:gap-1.5">
      <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-[#2563EB]/8 text-[#2563EB] flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{label}</div>
        <div className={`text-sm font-semibold text-[#0F172A] ${valueClass}`}>{value}</div>
      </div>
    </div>
  );
}