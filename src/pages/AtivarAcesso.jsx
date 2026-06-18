// AtivarAcesso — UX premium de ativação de acesso pós-checkout.
//
// Rota: /ativar-acesso?email=...&plan=...
//
// Política atual: cadastro/ativação da barbearia é EXCLUSIVAMENTE via Google.
// Não há mais opção de "criar senha" nem "já tenho senha" — simplifica o onboarding
// e garante identidade verificada (email Google = email do checkout).
//
// Princípios:
//   - NÃO recriar auth — só camada UX em cima da Base44.
//   - Mobile-first, premium (estilo Stripe/Notion/Shopify onboarding).
//   - Toda comunicação PT-BR, identidade O CORTE.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';
import GoogleAccessCard from '@/components/ativar/GoogleAccessCard';
import {
  CheckCircle2,
  Mail,
  Sparkles,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

const PLAN_LABEL = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };

function recordEvent(eventType, metadata = {}) {
  try {
    // eslint-disable-next-line no-console
    console.info(`[ativar-acesso] ${eventType}`, metadata);
    base44.functions.invoke('trackEvent', { event_type: eventType, metadata }).catch(() => {});
  } catch { /* no-op */ }
}

function isGmail(email) {
  return /@(gmail|googlemail)\.com$/i.test(String(email || '').trim());
}

export default function AtivarAcesso() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error] = useState('');

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const email = (params.get('email') || '').trim().toLowerCase();
  const planKey = (params.get('plan') || '').toLowerCase();
  const planName = PLAN_LABEL[planKey] || 'O CORTE';
  const gmail = isGmail(email);

  useEffect(() => {
    recordEvent('first_access_started', { has_email: !!email, gmail });
    base44.auth.isAuthenticated().then((auth) => {
      if (auth) {
        navigate('/app/dashboard', { replace: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogle = () => {
    if (busy) return;
    setBusy(true);
    recordEvent('first_access_google', { email });
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
            Entre com sua conta Google para acessar o painel da sua barbearia em segundos.
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

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3 text-sm text-rose-800">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {/* Google access — única opção */}
        <GoogleAccessCard
          onClick={handleGoogle}
          busy={busy}
          disabled={busy}
          recommended
        />

        {/* Aviso sobre email */}
        {email && !gmail && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 text-sm text-amber-900">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="font-bold">Atenção:</strong> use a conta Google vinculada ao email <strong>{email}</strong> para entrar. Se você não tem conta Google nesse endereço, crie uma gratuitamente em{' '}
              <a href="https://accounts.google.com/signup" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                accounts.google.com
              </a>.
            </div>
          </div>
        )}

        {/* Trust line */}
        <div className="flex items-center justify-center gap-2 mt-8 text-[11px] text-gray-400 text-center">
          <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Acesso seguro via Google · Dúvidas?{' '}
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