import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ActivateAccountForm({
  companyId,
  onSuccess,
  onGoToLogin,
  primaryColor = '#2563EB',
}) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email.trim() || !phone.trim() || !password) {
      setError('Todos os campos são obrigatórios');
      setLoading(false);
      return;
    }

    if (password !== passwordConfirm) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Senha deve ter no mínimo 8 caracteres');
      setLoading(false);
      return;
    }

    try {
      const response = await base44.functions.invoke('customerAuth', {
        action: 'activate_account',
        company_id: companyId,
        email: email.trim(),
        phone: phone.replace(/\D/g, ''),
        password,
        password_confirm: passwordConfirm,
      });

      if (response.data?.success) {
        onSuccess(response.data.customer_id, response.data.token);
      } else {
        setError(response.data?.error || 'Erro ao ativar conta');
      }
    } catch (err) {
      setError(err.message || 'Erro na ativação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-600 mb-4">
          Parece que você tem um histórico de agendamentos conosco! Ative sua conta agora com a mesma informação de contato.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Telefone (com WhatsApp)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 98765-4321"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Criar Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Confirmar Senha</label>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full text-white font-semibold py-2.5 rounded-lg transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ backgroundColor: primaryColor }}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Ativando...' : 'Ativar Conta'}
        </button>
      </form>

      <button
        onClick={onGoToLogin}
        className="w-full text-sm text-gray-600 hover:text-gray-900 font-medium py-2"
      >
        Voltar ao login
      </button>
    </div>
  );
}