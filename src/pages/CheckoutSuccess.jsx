import { Link } from 'react-router-dom';
import { CheckCircle, ArrowRight, Mail } from 'lucide-react';
import Logo from '@/components/Logo';
import { base44 } from '@/api/base44Client';

export default function CheckoutSuccess() {
  const handleAccessApp = async () => {
    const authed = await base44.auth.isAuthenticated();
    if (authed) {
      window.location.href = '/app/dashboard';
    } else {
      base44.auth.redirectToLogin('/app/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F3] font-inter flex flex-col">
      <header className="bg-white border-b border-black/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center overflow-hidden">
              <Logo size={32} className="rounded-none" />
            </div>
            <span className="font-bold text-[15px] text-[#0F172A]">BarberTrimly</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="max-w-lg w-full bg-white rounded-3xl border border-black/8 p-8 sm:p-10 text-center shadow-card-lg">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] mb-3">Tudo pronto! 🎉</h1>
          <p className="text-gray-500 mb-6 leading-relaxed">
            Sua assinatura foi confirmada e sua conta está sendo criada. Você ganhou <strong>7 dias grátis</strong> para configurar tudo com calma.
          </p>

          <div className="bg-[#F8F7F3] rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              <Mail className="w-3.5 h-3.5" /> Próximos passos
            </div>
            <ol className="text-sm text-gray-700 space-y-1.5 list-decimal list-inside">
              <li>Acesse o painel com seu email cadastrado</li>
              <li>Complete o onboarding da sua barbearia</li>
              <li>Comece a receber agendamentos</li>
            </ol>
          </div>

          <button
            onClick={handleAccessApp}
            className="w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-brand flex items-center justify-center gap-2"
          >
            Acessar meu painel <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-xs text-gray-400 mt-4">
            Dúvidas? Entre em contato com o suporte pelo email cadastrado.
          </p>
        </div>
      </div>
    </div>
  );
}