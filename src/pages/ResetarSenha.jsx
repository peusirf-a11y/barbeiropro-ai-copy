// ResetarSenha — Consome token do email e define nova senha (Fase 2 auth própria).

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react';

function passwordStrength(p) {
  if (!p) return { ok: false, msg: '' };
  if (p.length < 8) return { ok: false, msg: 'Mínimo de 8 caracteres.' };
  if (!/[A-Za-z]/.test(p)) return { ok: false, msg: 'Precisa de ao menos 1 letra.' };
  if (!/\d/.test(p)) return { ok: false, msg: 'Precisa de ao menos 1 número.' };
  return { ok: true, msg: 'Senha forte.' };
}

export default function ResetarSenha() {
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = (params.get('token') || '').trim();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const strength = passwordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    if (!token) {
      setError('Link inválido ou expirado. Solicite um novo.');
      return;
    }
    if (!strength.ok) {
      setError(strength.msg || 'Senha fraca.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não são iguais.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('resetBarberPassword', {
        token,
        new_password: password,
      });
      const data = res?.data || {};
      if (!data.ok) {
        if (data.error === 'invalid_token') {
          setError('Link inválido. Solicite um novo em "Esqueci minha senha".');
        } else if (data.error === 'token_expired') {
          setError('Este link expirou. Solicite um novo.');
        } else if (data.error === 'weak_password') {
          setError('Senha fraca. Use ao menos 8 caracteres com letras e números.');
        } else {
          setError('Não conseguimos atualizar a senha agora.');
        }
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      console.error('[ResetarSenha] error', err);
      setError('Erro inesperado. Tente novamente.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-inter">
      <header className="bg-white/80 backdrop-blur-sm border-b border-black/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Logo size={32} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Redefinir senha
          </span>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-16 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] mb-4 shadow-sm">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mb-2">
            Criar nova senha
          </h1>
          <p className="text-sm text-gray-500">
            Escolha uma senha forte com pelo menos 8 caracteres.
          </p>
        </div>

        {success ? (
          <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-[#0F172A] mb-2">Senha atualizada!</h2>
            <p className="text-sm text-gray-600">
              Redirecionando para o login…
            </p>
          </div>
        ) : !token ? (
          <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-6 text-center">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-[#0F172A] mb-2">Link inválido</h2>
            <p className="text-sm text-gray-600 mb-4">
              Este link não é válido ou está incompleto.
            </p>
            <Link to="/esqueci-senha" className="text-sm font-semibold text-[#2563EB] hover:underline">
              Solicitar novo link
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
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-start gap-2 text-sm text-rose-800">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !strength.ok || password !== confirm}
              className="w-full h-11 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando…
                </>
              ) : (
                'Salvar nova senha'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}