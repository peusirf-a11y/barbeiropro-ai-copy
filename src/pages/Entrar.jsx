// Entrar — Tela de login da auth própria O CORTE.
// Email + senha. Mensagens genéricas. Sem aparência Base44.

import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useBarberAuth } from '@/lib/BarberAuthContext';
import AuthShell from '@/components/auth/AuthShell';
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function Entrar() {
  const { login, isAuthenticated, loading } = useBarberAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Prefill do email se vier do checkout/email
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const e = sp.get('email');
    if (e) setEmail(e);
  }, [location.search]);

  // Se já autenticado, redireciona
  useEffect(() => {
    if (!loading && isAuthenticated) navigate('/app/dashboard', { replace: true });
  }, [loading, isAuthenticated, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err?.message || 'Email ou senha inválidos');
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-7 sm:p-8">
        <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Entrar</h1>
        <p className="text-sm text-gray-500 mt-1.5">Acesse o painel da sua barbearia.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field
            icon={Mail}
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            inputMode="email"
          />
          <Field
            icon={Lock}
            type={showPwd ? 'text' : 'password'}
            placeholder="Sua senha"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            rightIcon={showPwd ? EyeOff : Eye}
            onRightIconClick={() => setShowPwd(v => !v)}
          />

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !email || !password}
            className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-[0.99]"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Entrar <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-black/8 flex items-center justify-between text-sm">
          <Link to="/esqueci-senha" className="text-[#2563EB] hover:underline font-semibold">
            Esqueci minha senha
          </Link>
          <Link to="/landing" className="text-gray-500 hover:text-[#0F172A]">
            Voltar
          </Link>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 mt-5">
        Ainda não tem conta? <Link to="/checkout" className="text-[#2563EB] hover:underline font-semibold">Conheça os planos</Link>
      </p>
    </AuthShell>
  );
}

function Field({ icon: Icon, rightIcon: RightIcon, onRightIconClick, value, onChange, ...rest }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-10 py-3.5 bg-white border border-black/10 rounded-xl text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
        {...rest}
      />
      {RightIcon && (
        <button
          type="button"
          onClick={onRightIconClick}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-[#0F172A]"
          tabIndex={-1}
        >
          <RightIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}