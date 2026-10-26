// Landing premium dark cinematográfica — composta por componentes modulares.
// Quando a FeatureFlag global `landing_mode` está ativa, exibe a LaunchLandingPage.
import { useEffect, useState } from 'react';
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

function getInitialLandingMode() {
  if (typeof window === 'undefined') return null;
  try {
    const direct = localStorage.getItem('ocorte_landing_mode');
    if (direct === 'launch' || direct === 'default') return direct;
    const rawFlags = localStorage.getItem('barberpass_local_feature_flags');
    if (rawFlags) {
      const flags = JSON.parse(rawFlags);
      const match = Array.isArray(flags) && flags.find((f) => f && f.key === 'landing_mode');
      if (match) return match.enabled ? 'launch' : 'default';
    }
  } catch (_) {}
  return null;
}

export default function LandingPage() {
  const [landingMode, setLandingMode] = useState(() => getInitialLandingMode()); // null | 'default' | 'launch'

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

  // Lê a flag `landing_mode` via endpoint público / Supabase
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await base44.functions.invoke('getLandingMode', {});
        if (mounted) {
          setLandingMode(data?.mode === 'launch' ? 'launch' : 'default');
        }
      } catch {
        if (mounted) {
          setLandingMode((prev) => prev || 'default');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (landingMode === null) {
    return <div className="min-h-screen bg-[#070B14]" />;
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