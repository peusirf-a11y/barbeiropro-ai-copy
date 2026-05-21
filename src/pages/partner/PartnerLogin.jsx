import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AppBackgroundLayer from '@/components/layout/AppBackgroundLayer';
import BrandMark from '@/components/BrandMark';
import { Loader2, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { setPartnerToken } from '@/hooks/usePartnerAuth';

export default function PartnerLogin() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tokenParam = params.get('token');

  // Magic link → verifica e loga
  useEffect(() => {
    if (!tokenParam) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await base44.functions.invoke('partnerAuth', { action: 'verify_magic_link', token: tokenParam });
        if (data?.success && data.token) {
          setPartnerToken(data.token);
          navigate('/parceiro/dashboard', { replace: true });
        } else {
          setError(data?.error === 'token_expired' ? 'Este link expirou. Solicite outro.' : 'Link inválido.');
          setLoading(false);
        }
      } catch (err) {
        setError(err?.message || 'Falha ao validar link.');
        setLoading(false);
      }
    })();
  }, [tokenParam, navigate]);

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    if (!email.trim()) { setError('Informe seu email.'); return; }
    setLoading(true);
    try {
      await base44.functions.invoke('partnerAuth', { action: 'request_magic_link', email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Erro ao enviar link.');
    } finally {
      setLoading(false);
    }
  };

  if (tokenParam && loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <AppBackgroundLayer />
        <div className="relative text-center text-white">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#60A5FA]" />
          <p className="text-sm text-white/70">Validando seu acesso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-white">
      <AppBackgroundLayer />
      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-6"><BrandMark size={40} tone="dark" /></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8">
          <h1 className="text-xl font-black mb-1 text-center">Painel de Parceiros</h1>
          <p className="text-xs text-white/55 text-center mb-6">Login passwordless via email.</p>

          {sent ? (
            <div className="text-center py-4">
              <CheckCircle className="w-10 h-10 mx-auto text-emerald-400 mb-3" />
              <div className="font-bold mb-1">Link enviado!</div>
              <p className="text-sm text-white/70">Verifique seu email. O link expira em 15 minutos.</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              {error && (
                <div className="bg-rose-500/10 border border-rose-400/30 text-rose-300 text-xs p-3 rounded-lg mb-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
                </div>
              )}
              <label className="block text-[11px] font-semibold text-white/60 mb-1">Seu email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 mb-4"
              />
              <button type="submit" disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white font-bold py-3 rounded-xl text-sm shadow-[0_8px_24px_rgba(37,99,235,0.4)] hover:brightness-110 active:scale-[0.99] disabled:opacity-60">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {loading ? 'Enviando...' : 'Enviar link de acesso'}
              </button>
            </form>
          )}
          <div className="mt-6 pt-4 border-t border-white/8 text-center">
            <Link to="/parceiro" className="text-xs text-white/55 hover:text-white">Ainda não é parceiro? Cadastre-se →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}