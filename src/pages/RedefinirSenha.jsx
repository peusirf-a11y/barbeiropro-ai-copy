// RedefinirSenha — Recebe ?token=xxx do email e troca a senha.
// Após sucesso, entra direto no painel.

import { useState, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useBarberAuth } from '@/lib/BarberAuthContext';
import AuthShell from '@/components/auth/AuthShell';
import { Lock, Loader2, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function RedefinirSenha() {
  const { resetPassword } = useBarberAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    if (password.length < 8) { setError('A senha precisa ter ao menos 8 caracteres.'); return; }
    setError(''); setBusy(true);
    try {
      await resetPassword({ token, password });
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err?.message || 'Não foi possível redefinir a senha.');
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthShell>
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-7 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
          <h1 className="text-xl font-black text-[#0F172A]">Link inválido</h1>
          <p className="text-sm text-gray-500 mt-2">Use o link enviado para o seu email.</p>
          <Link to="/esqueci-senha" className="inline-block mt-5 text-[#2563EB] hover:underline font-semibold text-sm">
            Solicitar novo link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-7 sm:p-8">
        <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Defina sua nova senha</h1>
        <p className="text-sm text-gray-500 mt-1.5">Ao redefinir, todas as sessões ativas serão encerradas.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <PasswordField label="Nova senha" value={password} onChange={setPassword} show={showPwd} onToggle={() => setShowPwd(v => !v)} autoComplete="new-password" />
          <PasswordField label="Confirme a senha" value={confirm} onChange={setConfirm} show={showPwd} hideToggle autoComplete="new-password" />

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm text-rose-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={busy || !password || !confirm}
            className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-[0.99]"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Redefinir e entrar <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, hideToggle, autoComplete }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full pl-10 pr-10 py-3.5 bg-white border border-black/10 rounded-xl text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
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