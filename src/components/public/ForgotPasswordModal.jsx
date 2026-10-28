import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, Loader2, Mail } from 'lucide-react';
import { usePublicTheme } from '@/hooks/usePublicTheme';

export default function ForgotPasswordModal({ companyId, onBack, primaryColor = '#2563EB' }) {
  const { tw } = usePublicTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState('');

  const inputClass = `w-full px-4 py-3 border rounded-xl text-sm focus:outline-none ${tw.input}`;

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Email obrigatório'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('customerAuth', {
        company_id: companyId,
        action: 'request_reset',
        email: email.trim().toLowerCase(),
      });
      const data = res?.data || {};
      if (data.reset_url || data.reset_token) {
        setResetUrl(data.reset_url || `/cliente/demo/login?mode=reset&reset_token=${data.reset_token}&email=${encodeURIComponent(email.trim().toLowerCase())}`);
      }
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Erro ao enviar link. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className={`text-lg font-black ${tw.text} mb-1`}>Link de redefinição pronto!</h3>
          <p className={`text-sm ${tw.textMuted}`}>Se este email tiver cadastro, o pedido de redefinição foi registrado.</p>
        </div>
        {resetUrl && (
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-left space-y-2">
            <p className="text-xs font-bold text-blue-400">💡 Link de Redefinição (Preview):</p>
            <p className={`text-xs ${tw.textMuted}`}>Clique no botão para redefinir sua senha diretamente:</p>
            <a href={resetUrl}
              className="inline-flex items-center justify-center w-full py-2.5 px-3 text-xs font-bold rounded-lg transition-colors"
              style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}>
              <span style={{ color: '#FFFFFF' }}>Redefinir Minha Senha Agora →</span>
            </a>
          </div>
        )}
        <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <Mail className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className={`text-sm ${tw.textMuted} leading-relaxed`}>
            Se preferir por e-mail, abra sua caixa de entrada. Lembre-se de conferir o <strong>spam</strong>.
          </div>
        </div>
        <button type="button" onClick={onBack}
          className={`w-full py-3 rounded-xl font-bold transition-colors ${tw.secondaryBtn}`}>
          Voltar ao login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-lg font-black ${tw.text} mb-1`}>Recuperar senha</h3>
        <p className={`text-sm ${tw.textMuted}`}>Digite seu email para receber um link de redefinição</p>
      </div>
      <form onSubmit={handleRequestReset} className="space-y-4">
        <div>
          <label className={`text-xs font-semibold ${tw.textMuted} block mb-2`}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com" className={inputClass} disabled={loading} autoFocus />
        </div>
        {error && (
          <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-xl font-bold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#FFFFFF' }} />}
          <span style={{ color: '#FFFFFF' }}>{loading ? 'Enviando...' : 'Enviar link'}</span>
        </button>
      </form>
      <button type="button" onClick={onBack}
        className={`w-full py-2 text-sm font-semibold ${tw.textMuted} hover:opacity-70 transition-colors`} disabled={loading}>
        Voltar
      </button>
    </div>
  );
}