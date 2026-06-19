// AtivarAcesso — Tela de ativação pós-checkout via OTP nativo do Base44.
//
// Fluxo:
//   1) Página carrega com ?email=... do checkout.
//   2) Se ainda não disparamos, chama requestPasswordSetup → plataforma Base44
//      envia um código de 6 dígitos para o email.
//   3) Dono digita o código → base44.auth.verifyOtp → sessão ativa.
//   4) Redireciona para /app/dashboard.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  CheckCircle2,
  Mail,
  Sparkles,
  Clock,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Loader2,
} from 'lucide-react';

const PLAN_LABEL = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };

function recordEvent(eventType, metadata = {}) {
  try {
    // eslint-disable-next-line no-console
    console.info(`[ativar-acesso] ${eventType}`, metadata);
    base44.functions.invoke('trackEvent', { event_type: eventType, metadata }).catch(() => {});
  } catch { /* no-op */ }
}

export default function AtivarAcesso() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const didDispatch = useRef(false);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const email = (params.get('email') || '').trim().toLowerCase();
  const planKey = (params.get('plan') || '').toLowerCase();
  const planName = PLAN_LABEL[planKey] || 'O CORTE';

  // 1) Dispara envio do OTP no primeiro carregamento.
  useEffect(() => {
    if (didDispatch.current) return;
    didDispatch.current = true;
    recordEvent('first_access_started', { has_email: !!email });

    (async () => {
      const authed = await base44.auth.isAuthenticated().catch(() => false);
      if (authed) {
        navigate('/app/dashboard', { replace: true });
        return;
      }
      if (!email) return;
      try {
        await base44.functions.invoke('requestPasswordSetup', { email });
      } catch (e) {
        console.warn('[ativar-acesso] dispatch failed:', e?.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cooldown visual para botão "Reenviar".
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async (otp) => {
    if (verifying) return;
    setVerifying(true);
    setError('');
    recordEvent('first_access_otp_verify', { email });
    try {
      await base44.auth.verifyOtp({ email, otp });
      recordEvent('first_access_otp_success', { email });
      window.location.href = '/app/dashboard';
    } catch (e) {
      const msg = (e?.message || '').toLowerCase();
      if (/invalid|incorrect|wrong/.test(msg)) {
        setError('Código incorreto. Verifique e tente novamente.');
      } else if (/expired/.test(msg)) {
        setError('Código expirado. Clique em "Reenviar código" para receber outro.');
      } else {
        setError('Não foi possível verificar o código. Tente novamente.');
      }
      setCode('');
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    setError('');
    recordEvent('first_access_resend', { email });
    try {
      const res = await base44.functions.invoke('requestPasswordSetup', { email });
      const data = res?.data || {};
      if (data.ok) {
        setResent(true);
        setCooldown(data.wait_seconds || 60);
      } else {
        setError('Não consegui reenviar agora. Tente novamente em instantes.');
      }
    } catch {
      setError('Não consegui reenviar agora. Tente novamente em instantes.');
    }
    setResending(false);
  };

  const handleCodeChange = (v) => {
    setCode(v);
    if (v.length === 6 && !verifying) {
      handleVerify(v);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-inter">
      <header className="bg-white/80 backdrop-blur-sm border-b border-black/5 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Logo size={32} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Ativação de acesso
          </span>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-14 animate-fade-in-up">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] mb-4 shadow-sm">
            <KeyRound className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mb-2">
            Digite o código de acesso
          </h1>
          <p className="text-sm sm:text-base text-gray-500 max-w-md mx-auto">
            Enviamos um código de 6 dígitos para o seu email. Cole o código abaixo para entrar no seu painel.
          </p>
        </div>

        {/* Account summary */}
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-3">
            <SummaryItem
              icon={Mail}
              label="Email"
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
              label="Trial"
              value="7 dias grátis"
              valueClass="text-emerald-700"
            />
          </div>
        </div>

        {/* OTP input */}
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6 mb-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3 text-center">
            Código recebido por email
          </div>
          <div className="flex justify-center mb-4">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={handleCodeChange}
              disabled={verifying}
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
            >
              <InputOTPGroup className="gap-2">
                {[0,1,2,3,4,5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="h-14 w-12 sm:h-16 sm:w-14 text-2xl sm:text-3xl font-black text-[#0F172A] bg-white border-2 border-gray-200 rounded-xl first:rounded-l-xl last:rounded-r-xl"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {verifying && (
            <div className="flex items-center justify-center gap-2 text-sm text-[#2563EB] mb-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verificando código…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-start gap-2 text-sm text-rose-800 mb-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {resent && !error && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2 text-sm text-emerald-800 mb-3">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>Código reenviado! Verifique sua caixa de entrada.</div>
            </div>
          )}

          <button
            onClick={handleResend}
            disabled={resending || cooldown > 0 || verifying}
            className="w-full text-center text-sm font-semibold text-gray-600 hover:text-[#2563EB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed py-2"
          >
            {resending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reenviando…
              </span>
            ) : cooldown > 0 ? (
              `Reenviar código em ${cooldown}s`
            ) : (
              'Não recebi o código — reenviar'
            )}
          </button>
        </div>

        {/* Trust line */}
        <div className="flex items-center justify-center gap-2 mt-8 text-[11px] text-gray-400 text-center">
          <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Acesso seguro e criptografado · Dúvidas?{' '}
            <Link to="/landing" className="underline hover:text-[#2563EB]">central de ajuda</Link>
          </span>
        </div>
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