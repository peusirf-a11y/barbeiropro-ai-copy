import { Navigate } from 'react-router-dom';
import { useCurrentPartner, getPartnerToken } from '@/hooks/usePartnerAuth';
import AppBackgroundLayer from '@/components/layout/AppBackgroundLayer';

export default function PartnerGuard({ children }) {
  const { partner, isLoading } = useCurrentPartner();
  const token = getPartnerToken();

  console.log('PartnerGuard checou sessão:', { partner, token, isAuthenticated: !!partner });

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#070D1E]">
        <AppBackgroundLayer />
        <div className="relative w-8 h-8 border-4 border-[#60A5FA]/20 border-t-[#60A5FA] rounded-full animate-spin" />
      </div>
    );
  }

  if (!partner) {
    return <Navigate to="/parceiro/login" replace />;
  }

  if (partner.status === 'suspended' || partner.status === 'blocked' || partner.status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-white bg-[#070D1E]">
        <AppBackgroundLayer />
        <div className="relative max-w-md w-full rounded-2xl border border-rose-400/30 bg-rose-500/10 backdrop-blur-xl p-6 text-center space-y-3">
          <div className="text-xl font-black text-rose-300">Acesso Indisponível</div>
          <p className="text-xs text-white/70 leading-relaxed">
            Seu cadastro de parceiro foi desativado ou recusado pela administração.
          </p>
          <a
            href="/parceiro/login"
            className="inline-block mt-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
          >
            Voltar para o Login
          </a>
        </div>
      </div>
    );
  }

  return children;
}