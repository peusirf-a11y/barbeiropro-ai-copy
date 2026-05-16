import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, Loader2, Check, Mail } from 'lucide-react';

/**
 * Modal de recuperação de senha — solicita email + valida link temporário.
 *
 * Props:
 *  - companyId: ID da empresa
 *  - onBack(): retornar ao login
 *  - primaryColor: cor tema
 */
export default function ForgotPasswordModal({ companyId, onBack, primaryColor = '#2563EB' }) {
  const [step, setStep] = useState('email'); // 'email' | 'reset'
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Email obrigatório');
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('customerAuth', {
        company_id: companyId,
        action: 'request_password_reset',
        email: email.trim().toLowerCase(),
      });

      if (!res?.data?.success) {
        // Resposta genérica por segurança (anti-enumeração)
        setSuccess('Se o email existe, você receberá um link em alguns minutos.');
        setTimeout(() => setStep('reset'), 2000);
        return;
      }

      setSuccess('Link de redefinição enviado para seu email. Verifique a caixa de entrada.');
      setStep('reset');
    } catch (err) {
      console.error('[ForgotPasswordModal] error:', err);
      setError(err.message || 'Erro ao enviar link. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!resetToken.trim()) {
      setError('Token obrigatório');
      return;
    }
    if (newPassword.length < 8) {
      setError('Senha deve ter no mínimo 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Senhas não conferem');
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('customerAuth', {
        company_id: companyId,
        action: 'reset_password',
        email: email.trim().toLowerCase(),
        reset_token: resetToken.trim(),
        new_password: newPassword,
      });

      if (!res?.data?.success) {
        setError(res?.data?.error || 'Falha ao redefinir senha. Link pode ter expirado.');
        return;
      }

      setSuccess('Senha redefinida com sucesso! Você será redirecionado para login...');
      setTimeout(() => onBack(), 2000);
    } catch (err) {
      console.error('[ForgotPasswordModal] reset error:', err);
      setError(err.message || 'Erro ao redefinir. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'email') {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-black text-[#1B1C1E] mb-2">Recuperar senha</h3>
          <p className="text-sm text-gray-500">Digite seu email para receber um link de redefinição</p>
        </div>

        <form onSubmit={handleRequestReset} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white focus:outline-none focus:border-black/30"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg p-3">
              <Mail className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Enviando...' : 'Enviar link'}
          </button>
        </form>

        <button
          type="button"
          onClick={onBack}
          className="w-full py-2 text-sm font-semibold text-gray-600 hover:text-[#1B1C1E] underline-offset-2 hover:underline transition-colors"
          disabled={loading}
        >
          Voltar
        </button>
      </div>
    );
  }

  // Step: reset
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-black text-[#1B1C1E] mb-2">Redefinir senha</h3>
        <p className="text-sm text-gray-500">Cole o token do email e defina uma nova senha</p>
      </div>

      <form onSubmit={handleResetPassword} className="space-y-4">
        {/* Token */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-2">Token (do email)</label>
          <input
            type="text"
            value={resetToken}
            onChange={(e) => setResetToken(e.target.value)}
            placeholder="Cole o código do email aqui"
            className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white focus:outline-none focus:border-black/30 font-mono text-xs"
            disabled={loading}
          />
        </div>

        {/* Nova Senha */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-2">Nova Senha</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white focus:outline-none focus:border-black/30"
            disabled={loading}
          />
        </div>

        {/* Confirmar */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-2">Confirmar Senha</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirme a senha"
            className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white focus:outline-none focus:border-black/30"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg p-3">
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ backgroundColor: primaryColor }}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Redefinindo...' : 'Redefinir Senha'}
        </button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="w-full py-2 text-sm font-semibold text-gray-600 hover:text-[#1B1C1E] underline-offset-2 hover:underline transition-colors"
        disabled={loading}
      >
        Voltar
      </button>
    </div>
  );
}