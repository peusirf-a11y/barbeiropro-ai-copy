import { Navigate } from 'react-router-dom';
import { useCurrentPartner } from '@/hooks/usePartnerAuth';
import AppBackgroundLayer from '@/components/layout/AppBackgroundLayer';

export default function PartnerGuard({ children }) {
  const { partner, isLoading } = useCurrentPartner();

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <AppBackgroundLayer />
        <div className="relative w-8 h-8 border-4 border-[#60A5FA]/20 border-t-[#60A5FA] rounded-full animate-spin" />
      </div>
    );
  }
  if (!partner) return <Navigate to="/parceiro/login" replace />;
  if (partner.status === 'suspended') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-white">
        <AppBackgroundLayer />
        <div className="relative max-w-md w-full rounded-2xl border border-rose-400/30 bg-rose-500/10 backdrop-blur-xl p-6 text-center">
          <div className="text-xl font-black mb-2">Conta suspensa</div>
          <p className="text-sm text-white/70">Seu cadastro foi suspenso. Entre em contato com o suporte para mais informações.</p>
        </div>
      </div>
    );
  }
  return children;
}