// Landing premium dark cinematográfica — composta por componentes modulares.
// Quando a FeatureFlag global `landing_mode` está ativa, exibe a LaunchLandingPage.
import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { isSuperAdmin } from '@/lib/permissions';
import { base44 } from '@/api/base44Client';
import LaunchLandingPage from './LaunchLandingPage';
import PremiumBackground from '@/components/landing/PremiumBackground';
import PremiumNav from '@/components/landing/PremiumNav';
import PremiumHero from '@/components/landing/PremiumHero';
import AnimatedStats from '@/components/landing/AnimatedStats';
import BenefitsGrid from '@/components/landing/BenefitsGrid';
import AISection from '@/components/landing/AISection';
import RecurrenceSection from '@/components/landing/RecurrenceSection';
import ResultsBand from '@/components/landing/ResultsBand';
import ComparisonTable from '@/components/landing/ComparisonTable';
import PremiumTestimonials from '@/components/landing/PremiumTestimonials';
import PremiumCTA from '@/components/landing/PremiumCTA';
import PremiumFooter from '@/components/landing/PremiumFooter';

import { captureReferralFromUrl } from '@/lib/referralTracking';

export default function LandingPage() {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();
  const [landingMode, setLandingMode] = useState(null); // null | 'default' | 'launch'

  // Captura código de indicação do parceiro (?ref=)
  useEffect(() => {
    try {
      captureReferralFromUrl();
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const refParam = params.get('ref');
        if (refParam) {
          localStorage.setItem('partner_ref', refParam.trim());
        }
      }
    } catch (_) {}
  }, []);

  // Lê a flag `landing_mode` via endpoint público
  useEffect(() => {
    (async () => {
      try {
        const { data } = await base44.functions.invoke('getLandingMode', {});
        setLandingMode(data?.mode === 'launch' ? 'launch' : 'default');
      } catch {
        setLandingMode('default');
      }
    })();
  }, []);

  // Usuário já logado: super admin → /master/dashboard, demais → /app/dashboard.
  if (!isLoadingAuth && isAuthenticated && user) {
    if (isSuperAdmin(user)) return <Navigate to="/master/dashboard" replace />;
    return <Navigate to="/app/dashboard" replace />;
  }

  if (landingMode === 'launch') return <LaunchLandingPage />;

  return (
    <div className="relative min-h-screen text-white font-inter antialiased selection:bg-[#2563EB]/40 selection:text-white">
      <PremiumBackground />
      <PremiumNav />
      <main className="relative">
        <PremiumHero />
        <AnimatedStats />
        <BenefitsGrid />
        <AISection />
        <RecurrenceSection />
        <ResultsBand />
        <ComparisonTable />
        <PremiumTestimonials />
        <PremiumCTA />
      </main>
      <PremiumFooter />
    </div>
  );
}