// AtivarAcesso — "Primeiro acesso" pós-checkout.
//
// Recebe ?token=xxx (enviado por email após o checkout) e exibe o formulário
// premium da imagem: "Nova senha" + "Confirmação de senha" → ativa a conta
// e entra direto no /app/dashboard, sem passar por tela de login.
//
// Substitui completamente o fluxo antigo que dependia do Base44 Auth.

import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useBarberAuth } from '@/lib/BarberAuthContext';
import AuthShell from '@/components/auth/AuthShell';
import {
  ShieldCheck, Lock, Loader2, ArrowRight, Eye, EyeOff,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';

export default function AtivarAcesso() {
  const { activate, isAuthenticated, loading } = useBarberAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && isAuthenticated) navigate('/app/dashboard', { replace: true });
  }, [loading, isAuthenticated, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    if (password.length < 8) { setError('A senha precisa ter ao menos 8 caracteres.'); return; }
    setError(''); setBusy(true);
    try {
      await activate({ token, password });
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err?.message || 'Não foi possível ativar sua conta.');
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthShell>
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-7 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
          <h1 className="text-xl font-black text-[#0F172A]">Link de ativação inválido</h1>
          <p className="text-sm text-gray-500 mt-2">Use o link enviado para o seu email após o checkout.</p>
          <Link to="/entrar" className="inline-block mt-5 text-[#2563EB] hover:underline font-semibold text-sm">
            Ir para o login
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="bg-white rounded-2xl border border-black/8 shadow-md p-7 sm:p-8">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#0F172A] tracking-tight">Primeiro acesso detectado</h1>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">Você está acessando o sistema pela primeira vez.</p>
          </div>
        </div>

        <ul className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 mb-6 space-y-2 text-[13px] text-gray-600">
          <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" /><span>É necessário definir uma nova senha para o seu usuário.</span></li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" /><span>Após a definição, você entrará automaticamente no painel.</span></li>
        </ul>

        <form onSubmit={submit} className="space-y-4">
          <PasswordField
            label="Nova senha"
            placeholder="Digite uma nova senha de acesso"
            value={password}
            onChange={setPassword}
            show={showPwd}
            onToggle={() => setShowPwd(v => !v)}
            autoComplete="new-password"
          />
          <PasswordField
            label="Confirmação de senha"
            placeholder="Por favor, confirme a nova senha"
            value={confirm}
            onChange={setConfirm}
            show={showPwd}
            hideToggle
            autoComplete="new-password"
          />

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !password || !confirm}
            className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-[0.99]"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Definir senha e entrar <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        <p className="text-[11px] text-gray-400 text-center mt-5">
          A senha precisa ter ao menos 8 caracteres. Use letras, números e símbolos para mais segurança.
        </p>
      </div>
    </AuthShell>
  );
}

function PasswordField({ label, placeholder, value, onChange, show, onToggle, hideToggle, autoComplete }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full pl-10 pr-10 py-3.5 bg-white border border-black/10 rounded-xl text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
        />
        {!hideToggle && (
          <button type="button" onClick={onToggle} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-[#0F172A]">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}