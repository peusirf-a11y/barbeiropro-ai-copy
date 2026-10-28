import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { usePublicTheme } from '@/hooks/usePublicTheme';

export default function ActivateAccountForm({ companyId, onSuccess, onGoToLogin, primaryColor = '#2563EB' }) {
  const { tw } = usePublicTheme();
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
    if (password !== passwordConfirm) { setError('As senhas não coincidem'); setLoading(false); return; }
    if (password.length < 8) { setError('Senha deve ter no mínimo 8 caracteres'); setLoading(false); return; }

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
        localStorage.setItem(`bt_customer_token_${companyId}`, response.data.token);
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

  const inputClass = `w-full px-4 py-3 border rounded-xl text-sm focus:outline-none ${tw.input}`;

  return (
    <div className="space-y-5">
      <div>
        <h3 className={`text-lg font-black ${tw.text} mb-1`}>Ativar conta</h3>
        <p className={`text-sm ${tw.textMuted}`}>
          Você tem um histórico de agendamentos conosco! Ative sua conta agora.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={`block text-xs font-semibold ${tw.textMuted} mb-2`}>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com" className={inputClass} disabled={loading} />
        </div>
        <div>
          <label className={`block text-xs font-semibold ${tw.textMuted} mb-2`}>Telefone (com WhatsApp)</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 98765-4321" className={inputClass} disabled={loading} />
        </div>
        <div>
          <label className={`block text-xs font-semibold ${tw.textMuted} mb-2`}>Criar Senha</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" className={inputClass} disabled={loading} />
        </div>
        <div>
          <label className={`block text-xs font-semibold ${tw.textMuted} mb-2`}>Confirmar Senha</label>
          <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="••••••••" className={inputClass} disabled={loading} />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#FFFFFF' }} />}
          <span style={{ color: '#FFFFFF' }}>{loading ? 'Ativando...' : 'Ativar Conta'}</span>
        </button>
      </form>

      <button onClick={onGoToLogin}
        className={`w-full text-sm ${tw.textMuted} hover:opacity-75 font-medium py-2 transition-colors`}>
        Voltar ao login
      </button>
    </div>
  );
}