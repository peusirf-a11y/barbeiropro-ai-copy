import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Formulário de login para clientes — email + senha.
 *
 * Props:
 *  - companyId: ID da empresa (isolamento multi-tenant)
 *  - onSuccess(customerId, token): callback ao autenticar
 *  - onGoToRegister(): mudar para tela de cadastro
 *  - onGoToForgotPassword(): mudar para recuperação de senha
 *  - primaryColor: cor tema da barbearia
 */
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

    if (!email.trim()) {
      setError('Email obrigatório');
      return;
    }
    if (!password) {
      setError('Senha obrigatória');
      return;
    }

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
      if (!customer_id || !token) {
        setError('Resposta inválida do servidor');
        return;
      }

      // Persistir sessão
      if (rememberMe) {
        localStorage.setItem('customer_session', JSON.stringify({
          customer_id,
          token,
          company_id: companyId,
          created_at: new Date().toISOString(),
        }));
      }

      onSuccess(customer_id, token);
    } catch (err) {
      console.error('[LoginCustomerForm] error:', err);
      setError(err.message || 'Erro ao conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-black text-[#1B1C1E] mb-2">Entrar</h3>
        <p className="text-sm text-gray-500">Use sua conta para acessar</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        {/* Email */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white focus:outline-none focus:border-black/30"
            disabled={loading}
          />
        </div>

        {/* Senha */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-2">Senha</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white focus:outline-none focus:border-black/30 pr-10"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              disabled={loading}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Checkbox "Continuar logado" */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="remember"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
          <label htmlFor="remember" className="text-xs text-gray-600 cursor-pointer">
            Continuar logado neste dispositivo
          </label>
        </div>

        {/* Erro */}
        {error && (
          <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ backgroundColor: primaryColor }}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Autenticando...' : 'Entrar'}
        </button>
      </form>

      {/* Recuperação de senha */}
      <button
        type="button"
        onClick={onGoToForgotPassword}
        className="w-full py-2 text-sm font-semibold text-gray-600 hover:text-[#1B1C1E] underline-offset-2 hover:underline transition-colors"
        disabled={loading}
      >
        Esqueceu a senha?
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-black/10" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-400">ou</span>
        </div>
      </div>

      {/* Link para cadastro */}
      <button
        type="button"
        onClick={onGoToRegister}
        className="w-full py-3 rounded-xl font-bold text-[#2563EB] border border-black/20 hover:bg-blue-50 transition-colors"
        disabled={loading}
      >
        Criar nova conta
      </button>

      {/* Ativar conta legada */}
      <button
        type="button"
        onClick={() => {
          // Será capturado por AuthGateModal para trocar view
          const event = new CustomEvent('switchToActivate');
          document.dispatchEvent(event);
        }}
        className="w-full py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline transition-colors"
        disabled={loading}
      >
        Tenho agendamentos antigos — ativar conta
      </button>
    </div>
  );
}