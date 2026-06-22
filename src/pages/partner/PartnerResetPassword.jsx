import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AppBackgroundLayer from '@/components/layout/AppBackgroundLayer';
import BrandMark from '@/components/BrandMark';
import { Loader2, AlertCircle, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { setPartnerToken } from '@/hooks/usePartnerAuth';

export default function PartnerResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    if (!token) { setError('Token de reset ausente. Solicite um novo link.'); return; }
    if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não conferem.'); return; }
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('partnerAuth', {
        action: 'reset_password', token, new_password: password,
      });
      if (data?.success && data.token) {
        setPartnerToken(data.token);
        navigate('/parceiro/dashboard', { replace: true });
      } else {
        setError(data?.message || data?.error === 'invalid_or_expired_token'
          ? 'Link inválido ou expirado. Solicite um novo.'
          : 'Falha ao redefinir senha.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-white">
      <AppBackgroundLayer />
      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-6"><BrandMark size={40} tone="dark" /></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8">
          <h1 className="text-xl font-black mb-1 text-center">Nova senha</h1>
          <p className="text-xs text-white/55 text-center mb-6">Crie sua nova senha de acesso.</p>

          {!token ? (
            <div className="bg-rose-500/10 border border-rose-400/30 text-rose-300 text-xs p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              Token não encontrado. Solicite um novo link em "Esqueci minha senha".
            </div>
          ) : (
            <form onSubmit={submit}>
              {error && (
                <div className="bg-rose-500/10 border border-rose-400/30 text-rose-300 text-xs p-3 rounded-lg mb-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
                </div>
              )}

              <label className="block text-[11px] font-semibold text-white/60 mb-1">Nova senha (mín. 8)</label>
              <div className="relative mb-3">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full pl-9 pr-10 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/40 hover:text-white/80" tabIndex={-1}>
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <label className="block text-[11px] font-semibold text-white/60 mb-1">Confirmar senha</label>
              <div className="relative mb-4">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="w-full pl-9 pr-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
                />
              </div>

              <button type="submit" disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white font-bold py-3 rounded-xl text-sm shadow-[0_8px_24px_rgba(37,99,235,0.4)] hover:brightness-110 active:scale-[0.99] disabled:opacity-60">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {loading ? 'Salvando...' : 'Definir nova senha'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-white/8 text-center">
            <Link to="/parceiro/login" className="text-xs text-white/55 hover:text-white">← Voltar para o login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}