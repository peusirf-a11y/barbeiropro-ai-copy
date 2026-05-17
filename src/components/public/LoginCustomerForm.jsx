import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginCustomerForm({ companyId, onSuccess, onGoToRegister, onGoToForgotPassword, primaryColor = '#2563EB' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Email obrigatório'); return; }
    if (!password) { setError('Senha obrigatória'); return; }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('customerAuth', {
        company_id: companyId,
        action: 'login',
        email: email.trim().toLowerCase(),
        password,
      });

      if (!res?.data?.success) {
        setError(res?.data?.error || 'Falha ao autenticar. Verifique email e senha.');
        return;
      }

      const { customer_id, token } = res.data;
      if (!customer_id || !token) { setError('Resposta inválida do servidor'); return; }

      if (rememberMe) localStorage.setItem(`bt_customer_token_${companyId}`, token);
      onSuccess(customer_id, token);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Erro ao conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 border border-white/10 rounded-xl text-sm bg-white/5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-black text-white mb-1">Entrar</h3>
        <p className="text-sm text-white/40">Use sua conta para acessar</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-white/50 block mb-2">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com" className={inputClass} disabled={loading} />
        </div>

        <div>
          <label className="text-xs font-semibold text-white/50 block mb-2">Senha</label>
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              className={`${inputClass} pr-10`} disabled={loading} />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60" disabled={loading}>
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="remember" checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 cursor-pointer" />
          <label htmlFor="remember" className="text-xs text-white/40 cursor-pointer">
            Continuar logado neste dispositivo
          </label>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ backgroundColor: primaryColor }}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Autenticando...' : 'Entrar'}
        </button>
      </form>

      <button type="button" onClick={onGoToForgotPassword}
        className="w-full py-2 text-sm font-semibold text-white/50 hover:text-white/80 transition-colors" disabled={loading}>
        Esqueceu a senha?
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-[#1a1a2e] text-white/30">ou</span>
        </div>
      </div>

      <button type="button" onClick={onGoToRegister}
        className="w-full py-3 rounded-xl font-bold text-white/80 border border-white/15 hover:bg-white/5 transition-colors" disabled={loading}>
        Criar nova conta
      </button>

      <button type="button"
        onClick={() => document.dispatchEvent(new CustomEvent('switchToActivate'))}
        className="w-full py-2 text-xs font-semibold text-white/30 hover:text-white/50 transition-colors" disabled={loading}>
        Tenho agendamentos antigos — ativar conta
      </button>
    </div>
  );
}