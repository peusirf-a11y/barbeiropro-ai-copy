import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, AlertCircle, Loader2, Check } from 'lucide-react';

/**
 * Formulário de cadastro para clientes — nome, email, telefone, senha.
 *
 * Props:
 *  - companyId: ID da empresa
 *  - onSuccess(customerId, token): callback ao criar conta
 *  - onGoToLogin(): mudar para tela de login
 *  - primaryColor: cor tema
 */
export default function RegisterCustomerForm({ companyId, onSuccess, onGoToLogin, primaryColor = '#2563EB' }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const validateForm = () => {
    const { name, email, phone, password, confirmPassword } = form;

    if (!name.trim()) return 'Nome obrigatório';
    if (!email.trim()) return 'Email obrigatório';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Email inválido';
    if (!phone.trim()) return 'Telefone obrigatório';
    if (phone.replace(/\D/g, '').length < 11) return 'Telefone deve ter 11 dígitos';
    if (password.length < 8) return 'Senha deve ter no mínimo 8 caracteres';
    if (password !== confirmPassword) return 'Senhas não conferem';
    if (!acceptedTerms) return 'Você deve aceitar os termos e política de privacidade';

    return '';
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    const validation = validateForm();
    if (validation) {
      setError(validation);
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('customerAuth', {
        company_id: companyId,
        action: 'register',
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.replace(/\D/g, ''),
        password: form.password,
      });

      if (!res?.data?.success) {
        setError(res?.data?.error || 'Falha ao criar conta. Tente novamente.');
        return;
      }

      const { customer_id, token } = res.data;
      if (!customer_id || !token) {
        setError('Resposta inválida do servidor');
        return;
      }

      // Persistir sessão automaticamente após cadastro
      localStorage.setItem('customer_session', JSON.stringify({
        customer_id,
        token,
        company_id: companyId,
        created_at: new Date().toISOString(),
      }));

      onSuccess(customer_id, token);
    } catch (err) {
      console.error('[RegisterCustomerForm] error:', err);
      setError(err.message || 'Erro ao conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-black text-[#1B1C1E] mb-2">Criar conta</h3>
        <p className="text-sm text-gray-500">Rápido e seguro</p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        {/* Nome */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-2">Nome</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Seu nome"
            className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white focus:outline-none focus:border-black/30"
            disabled={loading}
          />
        </div>

        {/* Email */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-2">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="seu@email.com"
            className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white focus:outline-none focus:border-black/30"
            disabled={loading}
          />
        </div>

        {/* Telefone */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-2">Telefone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => {
              let val = e.target.value.replace(/\D/g, '');
              if (val.length > 11) val = val.slice(0, 11);
              setForm({ ...form, phone: val });
            }}
            placeholder="(11) 99999-9999"
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
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Mínimo 8 caracteres"
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

        {/* Confirmar Senha */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-2">Confirmar Senha</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              placeholder="Confirme a senha"
              className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white focus:outline-none focus:border-black/30 pr-10"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              disabled={loading}
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Termos */}
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="terms"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="w-4 h-4 cursor-pointer mt-0.5"
            disabled={loading}
          />
          <label htmlFor="terms" className="text-xs text-gray-600 cursor-pointer">
            Concordo com os <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#2563EB]">Termos de Uso</a> e <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#2563EB]">Política de Privacidade</a>
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
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-black/10" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-400">ou</span>
        </div>
      </div>

      {/* Link para login */}
      <button
        type="button"
        onClick={onGoToLogin}
        className="w-full py-3 rounded-xl font-bold text-[#2563EB] border border-black/20 hover:bg-blue-50 transition-colors"
        disabled={loading}
      >
        Já tenho conta
      </button>
    </div>
  );
}