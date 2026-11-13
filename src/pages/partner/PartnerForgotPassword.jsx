import { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AppBackgroundLayer from '@/components/layout/AppBackgroundLayer';
import BrandMark from '@/components/BrandMark';
import { Loader2, Mail, CheckCircle, AlertCircle } from 'lucide-react';

export default function PartnerForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [resetUrl, setResetUrl] = useState('');

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    if (!email.trim()) { setError('Informe seu email.'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('partnerAuth', {
        action: 'request_password_reset',
        email: email.trim().toLowerCase(),
      });
      const data = res?.data || {};
      if (data.reset_url || data.reset_token) {
        setResetUrl(data.reset_url || `/parceiro/login?token=${data.reset_token}`);
      }
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Erro ao solicitar.');
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
          <h1 className="text-xl font-black mb-1 text-center text-[#171827] dark:text-white">Esqueci minha senha</h1>
          <p className="text-xs text-[#55596A] dark:text-white/55 text-center mb-6">Enviaremos um link para redefinir.</p>

          {sent ? (
            <div className="text-center py-4 space-y-4">
              <CheckCircle className="w-10 h-10 mx-auto text-emerald-500" strokeWidth={1.75} />
              <div className="font-bold text-[#171827] dark:text-white">Link de redefinição gerado!</div>
              <p className="text-sm text-[#55596A] dark:text-white/70">
                Se houver uma conta para esse email, enviamos o link de redefinição de senha.
              </p>
              {resetUrl && (
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-left space-y-2">
                  <p className="text-xs font-bold text-[#2563EB] dark:text-blue-300">💡 Link de Redefinição (Preview):</p>
                  <p className="text-xs text-[#55596A] dark:text-white/70">Clique abaixo para criar uma nova senha:</p>
                  <a href={resetUrl} className="inline-flex items-center justify-center w-full py-2.5 px-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-lg transition-colors">
                    Redefinir Minha Senha Agora →
                  </a>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={submit}>
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-lg mb-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={1.75} />{error}
                </div>
              )}
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.04] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 mb-4 transition-all"
              />
              <button type="submit" disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold py-2.5 rounded-xl text-sm shadow-sm disabled:opacity-60 transition-all cursor-pointer">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" strokeWidth={1.75} />}
                {loading ? 'Enviando...' : 'Enviar link'}
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