import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, Loader2, Mail } from 'lucide-react';

// Fase 3 — Fluxo de "Esqueci a senha"
//
// IMPORTANTE: o reset em si NÃO acontece aqui. Este modal apenas dispara o
// email com link mágico. O link aponta para `/cliente/:slug/login?reset_token=...&email=...`
// que abre o `CustomerLoginPage` em modo `reset` e troca a senha lá.
//
// Por quê? Tokens de reset por email são uso-único, expiram em 1h, e o
// fluxo deeplink é o padrão da indústria — pedir pro usuário copiar token
// e colar em outro lugar é UX ruim e mais propenso a erro de digitação.
export default function ForgotPasswordModal({ companyId, onBack, primaryColor = '#2563EB' }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const inputClass = "w-full px-4 py-3 border border-white/10 rounded-xl text-sm bg-white/5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30";

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Email obrigatório'); return; }
    setLoading(true);
    try {
      // `request_reset` é o nome canônico. O backend também aceita o alias
      // `request_password_reset` por retrocompat, mas usamos o novo aqui.
      await base44.functions.invoke('customerAuth', {
        company_id: companyId,
        action: 'request_reset',
        email: email.trim().toLowerCase(),
      });
      // Backend sempre retorna sucesso (anti-enumeração) — não vazamos
      // se o email existe ou não.
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
          <h3 className="text-lg font-black text-white mb-1">Verifique seu email</h3>
          <p className="text-sm text-white/40">Se este email tiver cadastro, enviamos um link de redefinição.</p>
        </div>
        <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <Mail className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-200/90 leading-relaxed">
            Abra o email e clique no link para criar uma nova senha. Não esqueça de conferir o <strong>spam</strong>.
          </div>
        </div>
        <button type="button" onClick={onBack}
          className="w-full py-3 rounded-xl font-bold text-white/80 border border-white/15 hover:bg-white/5 transition-colors">
          Voltar ao login
        </button>
      </div>
    );
  }

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