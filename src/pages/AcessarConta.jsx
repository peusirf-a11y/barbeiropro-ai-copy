// Tela intermediária pós-checkout — prepara o usuário ANTES de cair na auth Base44.
//
// Fluxo:
//   /checkout/sucesso → CTA "Continuar" → /acessar-conta?email=...&plan=...
//   → escolha do método (Google / criar senha / definir senha)
//   → base44.auth.redirectToLogin() leva à tela Base44 com contexto claro.
//
// Toda a comunicação do produto fica em PT-BR e na identidade O CORTE. A tela
// Base44 que vem em seguida é apresentada como "página de acesso seguro" —
// sem termos técnicos como "tenant", "provider", "Base44".

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';
import {
  CheckCircle2,
  Mail,
  Lock,
  KeyRound,
  Sparkles,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Clock,
} from 'lucide-react';

const PLAN_LABEL = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };

// Observabilidade: registro silencioso. Quando o usuário ainda não está logado,
// trackEvent retorna 401 — ignoramos sem barulho.
function recordAccessEvent(eventType, metadata = {}) {
  try {
    // eslint-disable-next-line no-console
    console.info(`[first-access] ${eventType}`, metadata);
    base44.functions.invoke('trackEvent', { event_type: eventType, metadata }).catch(() => {});
  } catch {
    /* no-op */
  }
}

function isGmail(email) {
  return /@(gmail|googlemail)\.com$/i.test(String(email || '').trim());
}

export default function AcessarConta() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null); // 'google' | 'password' | 'reset' | null
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const email = (params.get('email') || '').trim().toLowerCase();
  const planKey = (params.get('plan') || '').toLowerCase();
  const action = (params.get('action') || '').toLowerCase();
  const planName = PLAN_LABEL[planKey] || 'O CORTE';
  const gmail = isGmail(email);

  // Dispara o reset de senha de verdade (envia link para o email).
  const triggerReset = async ({ auto = false } = {}) => {
    if (!email) {
      setResetError('Email não informado. Volte para o checkout e tente novamente.');
      return;
    }
    recordAccessEvent('first_access_reset', { email, auto });
    setBusy('reset');
    setResetError('');
    try {
      // Método oficial Base44 — envia email com link para criar/redefinir senha.
      await base44.auth.resetPasswordRequest(email);
      setResetSent(true);
    } catch (err) {
      console.warn('[acessar-conta] resetPasswordRequest failed:', err?.message);
      setResetError('Não consegui enviar o link agora. Tente novamente em instantes.');
      setBusy(null);
    }
  };

  useEffect(() => {
    recordAccessEvent('first_access_started', { has_email: !!email, gmail, action: action || null });
    base44.auth.isAuthenticated().then((auth) => {
      if (auth) {
        navigate('/app/dashboard', { replace: true });
        return;
      }
      // Vindo do email transacional (?action=reset) — já dispara o envio do link.
      if (action === 'reset' && email) {
        triggerReset({ auto: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogle = () => {
    if (busy) return;
    setBusy('google');
    recordAccessEvent('first_access_google', { email });
    base44.auth.redirectToLogin('/app/dashboard');
  };

  const handlePassword = () => {
    if (busy) return;
    setBusy('password');
    recordAccessEvent('first_access_password', { email });
    base44.auth.redirectToLogin('/app/dashboard');
  };

  const handleReset = () => {
    if (busy === 'reset') return;
    triggerReset({ auto: false });
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-inter">
      <header className="bg-white/80 backdrop-blur-sm border-b border-black/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Logo size={32} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Acesso seguro</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-14 animate-fade-in-up">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 mb-4 shadow-sm">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mb-2">
            Seu acesso já está pronto
          </h1>
          <p className="text-sm sm:text-base text-gray-500 max-w-md mx-auto">
            Use o mesmo email do cadastro para entrar na plataforma. Em segundos você cai direto no painel da sua barbearia.
          </p>
        </div>

        {/* Account summary */}
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2">
            <SummaryItem
              icon={Mail}
              label="Email de acesso"
              value={email || '—'}
              valueClass="break-all"
            />
            <SummaryItem
              icon={Sparkles}
              label="Plano"
              value={`O CORTE · ${planName}`}
            />
            <SummaryItem
              icon={Clock}
              label="Período de teste"
              value="7 dias grátis"
            />
          </div>
        </div>

        {/* Gmail recommendation */}
        {gmail && (
          <div className="bg-gradient-to-br from-[#2563EB]/5 to-[#60A5FA]/10 border border-[#2563EB]/15 rounded-2xl p-4 mb-4 flex items-start gap-3 animate-fade-in">
            <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
              <GoogleIcon />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-[#2563EB] uppercase tracking-wider mb-0.5">Recomendado</div>
              <p className="text-sm text-[#0F172A] font-semibold leading-tight">Entre com Google</p>
              <p className="text-[12px] text-gray-500 mt-0.5">Mais rápido e sem precisar criar senha.</p>
            </div>
          </div>
        )}

        {/* Sucesso do reset — prioridade no topo */}
        {resetSent && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-[#0F172A] text-sm">Link enviado!</div>
                <p className="text-[13px] text-emerald-900/80 mt-1 leading-relaxed">
                  Enviamos um email para <strong className="break-all">{email}</strong> com o link para criar sua senha. Abra o email e clique no botão "Definir senha".
                </p>
                <p className="text-[11px] text-emerald-900/60 mt-2">Não chegou em 1 minuto? Verifique a caixa de spam ou clique abaixo para reenviar.</p>
              </div>
            </div>
          </div>
        )}

        {resetError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-4 text-sm text-rose-700">
            {resetError}
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2.5">
          <PrimaryAction
            onClick={handleGoogle}
            busy={busy === 'google'}
            disabled={!!busy && busy !== 'google'}
            highlight={gmail && !resetSent}
            icon={<GoogleIcon />}
            label="Continuar com Google"
            sublabel={gmail ? 'Use sua conta Gmail — sem senha' : 'Se você usa Google no email cadastrado'}
          />
          <PrimaryAction
            onClick={handleReset}
            busy={busy === 'reset' && !resetSent}
            disabled={busy === 'reset' && !resetSent}
            highlight={!gmail && !resetSent}
            icon={<KeyRound className="w-5 h-5" />}
            label={resetSent ? 'Reenviar link de senha' : 'Receber link para criar senha'}
            sublabel={resetSent ? `Reenviar para ${email}` : 'Enviamos um link de criação de senha para o seu email'}
          />
          <PrimaryAction
            onClick={handlePassword}
            busy={busy === 'password'}
            disabled={!!busy && busy !== 'password'}
            variant="ghost"
            icon={<Lock className="w-5 h-5" />}
            label="Já tenho senha — entrar"
            sublabel="Abrir tela de acesso"
          />
        </div>

        {/* Trust line */}
        <div className="flex items-center justify-center gap-2 mt-8 text-[11px] text-gray-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Acesso seguro e criptografado · Suporte: <Link to="/landing" className="underline hover:text-[#2563EB]">central de ajuda</Link></span>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ icon: Icon, label, value, valueClass = '' }) {
  return (
    <div className="flex sm:flex-col items-start gap-3 sm:gap-1 sm:items-start">
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

function PrimaryAction({ onClick, busy, disabled, highlight, icon, label, sublabel, variant = 'solid' }) {
  const base = 'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed';
  const isHighlight = highlight && variant !== 'ghost';
  const styles = variant === 'ghost'
    ? 'bg-white border-black/8 hover:border-black/20 hover:bg-gray-50'
    : isHighlight
      ? 'bg-[#0F172A] border-[#0F172A] text-white hover:bg-[#1E293B] shadow-md'
      : 'bg-white border-black/10 hover:border-[#2563EB]/40 hover:bg-[#2563EB]/[0.02]';

  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isHighlight ? 'bg-white/10 text-white' : 'bg-gray-50 text-[#0F172A]'
      }`}>
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-bold ${isHighlight ? 'text-white' : 'text-[#0F172A]'}`}>{label}</div>
        <div className={`text-[12px] mt-0.5 truncate ${isHighlight ? 'text-white/70' : 'text-gray-500'}`}>{sublabel}</div>
      </div>
      <ArrowRight className={`w-4 h-4 flex-shrink-0 ${isHighlight ? 'text-white/70' : 'text-gray-400'}`} />
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}