// PostCheckoutAccessCard — card premium exibido em /checkout/sucesso.
// Mostra: status do pagamento, email da compra, plano contratado, progresso
// (pagamento ✓ → conta criada ✓ → acessar plataforma →) e CTA único que dispara
// o login oficial da plataforma. O usuário não vê nada técnico — só o próximo passo.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Mail, Loader2, Sparkles } from 'lucide-react';
import Logo from '@/components/Logo';
import { base44 } from '@/api/base44Client';

export default function PostCheckoutAccessCard({ email, planName }) {
  const [loading, setLoading] = useState(false);

  const handleAccess = async () => {
    setLoading(true);
    try {
      const authed = await base44.auth.isAuthenticated();
      if (authed) {
        window.location.href = '/app/dashboard';
        return;
      }
      // Leva para a tela intermediária guiada (/acessar-conta) com contexto
      // do email e do plano. Lá o usuário escolhe Google / criar senha / link.
      const params = new URLSearchParams();
      if (email) params.set('email', email);
      if (planName) params.set('plan', String(planName).toLowerCase());
      window.location.href = `/acessar-conta?${params.toString()}`;
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg w-full bg-white rounded-3xl border border-black/8 p-7 sm:p-9 shadow-card-lg">
      {/* Topo: check + headline */}
      <div className="text-center mb-7">
        <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
          <CheckCircle2 className="w-9 h-9 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] mb-2 tracking-tight">
          Seu acesso já está pronto
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Entre com sua conta Google usando o email abaixo.
        </p>
      </div>

      {/* Email da compra */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-4 mb-5">
        <div className="flex items-center gap-2 text-[11px] font-bold text-blue-900/70 uppercase tracking-wider mb-1.5">
          <Mail className="w-3.5 h-3.5" /> Seu email de acesso
        </div>
        <div className="text-[#0F172A] font-bold text-base break-all">
          {email || '—'}
        </div>
        {planName && (
          <div className="mt-3 pt-3 border-t border-blue-100/70 flex items-center justify-between text-xs">
            <span className="text-blue-900/60 font-semibold uppercase tracking-wider">Plano contratado</span>
            <span className="text-[#0F172A] font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-500" />
              {planName}
            </span>
          </div>
        )}
      </div>

      {/* Progresso */}
      <div className="mb-7">
        <div className="flex items-center justify-between gap-2">
          <Step done label="Pagamento" />
          <StepConnector done />
          <Step done label="Conta criada" />
          <StepConnector />
          <Step current label="Acessar" />
        </div>
      </div>

      {/* CTA principal */}
      <button
        onClick={handleAccess}
        disabled={loading}
        className="w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-brand flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-70"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {loading ? 'Abrindo sua conta…' : 'Entrar com Google'}
        {!loading && <ArrowRight className="w-4 h-4" />}
      </button>

      {/* CTA secundário */}
      <Link
        to="/checkout"
        className="block text-center mt-3 text-xs font-semibold text-gray-500 hover:text-[#2563EB] transition-colors"
      >
        Usar outro email
      </Link>

      <p className="text-[11px] text-gray-400 text-center mt-6 leading-relaxed">
        Use sempre sua conta Google vinculada a este email para acessar.
      </p>
    </div>
  );
}

function Step({ done, current, label }) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
          done
            ? 'bg-green-500 text-white shadow-md shadow-green-500/30'
            : current
            ? 'bg-[#2563EB] text-white ring-4 ring-blue-200 animate-pulse'
            : 'bg-gray-200 text-gray-500'
        }`}
      >
        {done ? <CheckCircle2 className="w-4 h-4" strokeWidth={3} /> : '→'}
      </div>
      <span
        className={`text-[10px] font-bold uppercase tracking-wider ${
          done ? 'text-green-600' : current ? 'text-[#2563EB]' : 'text-gray-400'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function StepConnector({ done }) {
  return (
    <div className={`h-0.5 flex-1 rounded-full -mt-5 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
  );
}

export function PostCheckoutPageShell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F7F3] via-white to-blue-50/40 font-inter flex flex-col">
      <header className="bg-white/80 backdrop-blur-md border-b border-black/5 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center">
          <Link to="/landing">
            <Logo size={32} />
          </Link>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        {children}
      </div>
    </div>
  );
}