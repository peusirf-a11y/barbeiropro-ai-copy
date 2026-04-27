import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CreditCard, LogOut, Loader2, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';

export default function AssinaturaBloqueada() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleManage = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('createCustomerPortalSession', {
        return_url: `${window.location.origin}/app/dashboard`,
      });
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setError(data?.error || 'Não foi possível abrir o portal de assinatura.');
        setLoading(false);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Erro ao abrir portal.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F3] font-inter flex flex-col">
      <header className="bg-white border-b border-black/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center overflow-hidden">
              <Logo size={32} className="rounded-none" />
            </div>
            <span className="font-bold text-[15px] text-[#0F172A]">BarberTrimly</span>
          </Link>
          <button
            onClick={() => base44.auth.logout()}
            className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="max-w-lg w-full bg-white rounded-3xl border border-black/8 p-8 sm:p-10 text-center shadow-card-lg">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-9 h-9 text-amber-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] mb-3">
            Acesso pausado
          </h1>
          <p className="text-gray-500 mb-6 leading-relaxed">
            Sua assinatura está com pendência de pagamento. Para continuar usando o BarberTrimly, regularize sua assinatura.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
            <div className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1.5">
              O que aconteceu?
            </div>
            <p className="text-sm text-amber-900 leading-relaxed">
              Não conseguimos processar a cobrança do seu plano. Pode ser cartão expirado, sem saldo ou cancelado.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleManage}
            disabled={loading}
            className="w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-brand flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {loading ? 'Abrindo portal...' : 'Regularizar assinatura'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>

          <p className="text-xs text-gray-400 mt-4">
            Você será redirecionado para o portal seguro do Stripe para atualizar seus dados de pagamento.
          </p>
        </div>
      </div>
    </div>
  );
}