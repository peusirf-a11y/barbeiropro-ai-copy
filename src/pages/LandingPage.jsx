// Landing premium dark cinematográfica — composta por componentes modulares.
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
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

export default function LandingPage() {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();

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