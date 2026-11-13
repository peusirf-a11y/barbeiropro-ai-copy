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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F1F2F7] dark:bg-[#0F101A] text-[#171827] dark:text-[#E5E7F3] font-inter">
      <AppBackgroundLayer />
      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-6"><BrandMark size={40} tone="dark" /></div>
        <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827] p-6 sm:p-8 shadow-sm">
          <h1 className="text-xl font-black mb-1 text-center text-[#171827] dark:text-white">Nova senha</h1>
          <p className="text-xs text-[#55596A] dark:text-white/55 text-center mb-6">Crie sua nova senha de acesso.</p>

          {!token ? (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
              Token não encontrado. Solicite um novo link em "Esqueci minha senha".
            </div>
          ) : (
            <form onSubmit={submit}>
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-lg mb-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={1.75} />{error}
                </div>
              )}

              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60 mb-1">Nova senha (mín. 8)</label>
              <div className="relative mb-3">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#59658F] dark:text-white/40" strokeWidth={1.75} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-white/[0.04] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#59658F] dark:text-white/40 hover:text-[#171827] dark:hover:text-white" tabIndex={-1}>
                  {showPwd ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                </button>
              </div>

              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60 mb-1">Confirmar senha</label>
              <div className="relative mb-4">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#59658F] dark:text-white/40" strokeWidth={1.75} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-white/[0.04] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
                />
              </div>

              <button type="submit" disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold py-2.5 rounded-xl text-sm shadow-sm hover:brightness-105 active:scale-[0.99] disabled:opacity-60 transition-all cursor-pointer">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" strokeWidth={1.75} />}
                {loading ? 'Salvando...' : 'Definir nova senha'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-[#E5E7EF] dark:border-[#232538] text-center">
            <Link to="/parceiro/login" className="text-xs text-[#55596A] dark:text-white/55 hover:text-[#2563EB] dark:hover:text-white transition-colors">← Voltar para o login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}