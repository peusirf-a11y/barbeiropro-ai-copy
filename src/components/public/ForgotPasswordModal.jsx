import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, Loader2, Check, Mail } from 'lucide-react';

export default function ForgotPasswordModal({ companyId, onBack, primaryColor = '#2563EB' }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const inputClass = "w-full px-4 py-3 border border-white/10 rounded-xl text-sm bg-white/5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30";

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!email.trim()) { setError('Email obrigatório'); return; }
    setLoading(true);
    try {
      await base44.functions.invoke('customerAuth', {
        company_id: companyId,
        action: 'request_password_reset',
        email: email.trim().toLowerCase(),
      });
      setSuccess('Se o email existe, você receberá um link em alguns minutos.');
      setTimeout(() => setStep('reset'), 2000);
    } catch (err) {
      setError(err.message || 'Erro ao enviar link. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!resetToken.trim()) { setError('Token obrigatório'); return; }
    if (newPassword.length < 8) { setError('Senha deve ter no mínimo 8 caracteres'); return; }
    if (newPassword !== confirmPassword) { setError('Senhas não conferem'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('customerAuth', {
        company_id: companyId,
        action: 'reset_password',
        email: email.trim().toLowerCase(),
        reset_token: resetToken.trim(),
        new_password: newPassword,
      });
      if (!res?.data?.success) { setError(res?.data?.error || 'Falha ao redefinir senha. Link pode ter expirado.'); return; }
      setSuccess('Senha redefinida com sucesso!');
      setTimeout(() => onBack(), 2000);
    } catch (err) {
      setError(err.message || 'Erro ao redefinir. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'email') {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-black text-white mb-1">Recuperar senha</h3>
          <p className="text-sm text-white/40">Digite seu email para receber um link de redefinição</p>
        </div>
        <form onSubmit={handleRequestReset} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-white/50 block mb-2">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com" className={inputClass} disabled={loading} autoFocus />
          </div>
          {error && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <Mail className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{success}</span>
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Enviando...' : 'Enviar link'}
          </button>
        </form>
        <button type="button" onClick={onBack}
          className="w-full py-2 text-sm font-semibold text-white/40 hover:text-white/70 transition-colors" disabled={loading}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-black text-white mb-1">Redefinir senha</h3>
        <p className="text-sm text-white/40">Cole o token do email e defina uma nova senha</p>
      </div>
      <form onSubmit={handleResetPassword} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-white/50 block mb-2">Token (do email)</label>
          <input type="text" value={resetToken} onChange={(e) => setResetToken(e.target.value)}
            placeholder="Cole o código do email aqui"
            className={`${inputClass} font-mono text-xs`} disabled={loading} />
        </div>
        <div>
          <label className="text-xs font-semibold text-white/50 block mb-2">Nova Senha</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres" className={inputClass} disabled={loading} />
        </div>
        <div>
          <label className="text-xs font-semibold text-white/50 block mb-2">Confirmar Senha</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirme a senha" className={inputClass} disabled={loading} />
        </div>
        {error && (
          <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{success}</span>
          </div>
        )}
        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: primaryColor }}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Redefinindo...' : 'Redefinir Senha'}
        </button>
      </form>
      <button type="button" onClick={onBack}
        className="w-full py-2 text-sm font-semibold text-white/40 hover:text-white/70 transition-colors" disabled={loading}>
        Voltar
      </button>
    </div>
  );
}