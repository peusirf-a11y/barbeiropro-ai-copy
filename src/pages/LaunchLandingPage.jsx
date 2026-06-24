// Landing de LANÇAMENTO — segunda landing premium do O CORTE.
//
// Reutiliza o mesmo padrão visual da landing principal (PremiumBackground,
// PremiumNav, PremiumFooter, GlowButton, SectionBadge) e adiciona seções
// dedicadas à conversão da oferta de R$ 49/mês por 6 meses.
//
// Para alternar entre /landing default e launch, ver `landing_mode` na FeatureFlag.

import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

import PremiumBackground from '@/components/landing/PremiumBackground';
import PremiumNav from '@/components/landing/PremiumNav';
import PremiumFooter from '@/components/landing/PremiumFooter';

import LaunchHero from '@/components/launch/LaunchHero';
import LaunchProblems from '@/components/launch/LaunchProblems';
import LaunchSolution from '@/components/launch/LaunchSolution';
import LaunchBenefits from '@/components/launch/LaunchBenefits';
import LaunchOffer from '@/components/launch/LaunchOffer';
import LaunchSocialProof from '@/components/launch/LaunchSocialProof';
import LaunchFAQ from '@/components/launch/LaunchFAQ';
import LaunchFinalCTA from '@/components/launch/LaunchFinalCTA';

const VAGAS_TOTAIS = 10;

export default function LaunchLandingPage() {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();
  const [vagasRestantes, setVagasRestantes] = useState(VAGAS_TOTAIS);

  // SEO + título
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'O CORTE — Oferta de Lançamento · R$ 49/mês';
    const prevDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute(
      'content',
      'O sistema completo para modernizar sua barbearia. Agendamentos online, controle financeiro, equipe e pagamentos por R$ 49/mês durante 6 meses — oferta para os 10 primeiros clientes.'
    );
    return () => {
      document.title = prevTitle;
      if (prevDesc) metaDesc.setAttribute('content', prevDesc);
    };
  }, []);

  // Calcula vagas restantes a partir das companies já criadas com plano pago.
  // Limite real defendido no servidor pela cobrança — aqui é só para mostrar
  // o contador na UI. Tolerante a falhas: se quebrar, mostramos VAGAS_TOTAIS.
  useEffect(() => {
    (async () => {
      try {
        const companies = await base44.entities.Company.filter({ status: 'active' }, '-created_date', 50);
        const usadas = Math.min(companies.length, VAGAS_TOTAIS);
        setVagasRestantes(Math.max(0, VAGAS_TOTAIS - usadas));
      } catch (e) {
        console.warn('[LaunchLandingPage] não consegui calcular vagas restantes:', e?.message);
      }
    })();
  }, []);

  // Usuário já logado: super admin → /master, demais → /app/dashboard.
  if (!isLoadingAuth && isAuthenticated && user) {
    if (user.is_super_admin) return <Navigate to="/master" replace />;
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <div className="relative min-h-screen text-white font-inter antialiased selection:bg-[#2563EB]/40 selection:text-white">
      <PremiumBackground />
      <PremiumNav />
      <main className="relative">
        <LaunchHero vagasRestantes={vagasRestantes} vagasTotais={VAGAS_TOTAIS} />
        <LaunchProblems />
        <LaunchSolution />
        <LaunchBenefits />
        <LaunchOffer vagasRestantes={vagasRestantes} />
        <LaunchSocialProof />
        <LaunchFAQ />
        <LaunchFinalCTA />
      </main>
      <PremiumFooter />
    </div>
  );
}