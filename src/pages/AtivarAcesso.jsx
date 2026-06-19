// AtivarAcesso — UX premium de ativação de acesso pós-checkout.
//
// Rota: /ativar-acesso?email=...&plan=...
//
// Política atual: acesso da barbearia é EXCLUSIVAMENTE via email + senha.
// Após o pagamento confirmado (webhook do Asaas), enviamos automaticamente
// um email com link para criar senha. Esta tela confirma o status e permite
// reenviar o link se necessário.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';
import {
  CheckCircle2,
  Mail,
  Sparkles,
  Clock,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Lock,
  Loader2,
  ArrowRight,
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
  const [busy, setBusy] = useState(null); // 'reset' | 'login' | null
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState('');

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const email = (params.get('email') || '').trim().toLowerCase();
  const planKey = (params.get('plan') || '').toLowerCase();
  const planName = PLAN_LABEL[planKey] || 'O CORTE';

  useEffect(() => {
    recordEvent('first_access_started', { has_email: !!email });
    base44.auth.isAuthenticated().then((auth) => {
      if (auth) {
        navigate('/app/dashboard', { replace: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendLink = async () => {
    if (busy) return;
    if (!email) {
      setError('Email não informado. Volte para o checkout e tente novamente.');
      return;
    }
    setBusy('reset');
    setError('');
    recordEvent('first_access_reset', { email });
    try {
      const res = await base44.functions.invoke('requestPasswordSetup', { email });
      const data = res?.data || {};
      if (data.ok) {
        setResetSent(true);
      } else {
        setError('Não consegui enviar o link agora. Tente novamente em instantes.');
        setBusy(null);
      }
    } catch (err) {
      console.warn('[ativar-acesso] requestPasswordSetup failed:', err?.message);
      setError('Não consegui enviar o link agora. Tente novamente em instantes.');
      setBusy(null);
    }
  };

  const handleLogin = () => {
    if (busy) return;
    setBusy('login');
    recordEvent('first_access_login', { email });
    base44.auth.redirectToLogin('/app/dashboard');
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 mb-4 shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mb-2">
            Seu acesso está pronto
          </h1>
          <p className="text-sm sm:text-base text-gray-500 max-w-md mx-auto">
            Enviamos um email para você criar sua senha. Verifique sua caixa de entrada para acessar o painel.
          </p>
        </div>

        {/* Account summary */}
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-3">
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
              label="Trial"
              value="7 dias grátis"
              valueClass="text-emerald-700"
            />
          </div>
        </div>

        {/* Sucesso do reset */}
        {resetSent && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-[#0F172A] text-sm">Link enviado!</div>
                <p className="text-[13px] text-emerald-900/80 mt-1 leading-relaxed">
                  Enviamos um email para <strong className="break-all">{email}</strong>. Abra o email e clique no botão "Criar minha senha".
                </p>
                <p className="text-[11px] text-emerald-900/60 mt-2">Não chegou em 1 minuto? Verifique a caixa de spam.</p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3 text-sm text-rose-800">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2.5">
          <ActionButton
            onClick={handleSendLink}
            busy={busy === 'reset' && !resetSent}
            disabled={busy === 'reset' && !resetSent}
            highlight={!resetSent}
            icon={<KeyRound className="w-5 h-5" />}
            label={resetSent ? 'Reenviar link de senha' : 'Receber link para criar senha'}
            sublabel={resetSent ? `Reenviar para ${email}` : 'Enviaremos um link para seu email'}
          />
          <ActionButton
            onClick={handleLogin}
            busy={busy === 'login'}
            disabled={!!busy && busy !== 'login'}
            variant="ghost"
            icon={<Lock className="w-5 h-5" />}
            label="Já tenho senha — entrar"
            sublabel="Abrir tela de acesso"
          />
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

function ActionButton({ onClick, busy, disabled, highlight, icon, label, sublabel, variant = 'solid' }) {
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