// Dashboard do Master — visão geral do sistema com KPIs, alertas, saúde e funcionalidades.
import MasterMetrics from '@/components/master/MasterMetrics';
import SystemAlertsList from '@/components/master/SystemAlertsList';
import SystemHealth from '@/components/master/SystemHealth';
import PlatformFeatures from '@/components/master/PlatformFeatures';
import StripeEnvMismatchBanner from '@/components/master/StripeEnvMismatchBanner';

export default function MasterDashboard() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-2xl font-black text-[#111827] tracking-tight">Visão geral do sistema</h2>
        <p className="text-sm text-[#6B7280] mt-1">Indicadores em tempo real do O CORTE SaaS.</p>
      </div>
      <StripeEnvMismatchBanner />
      <MasterMetrics />
      <SystemAlertsList />
      <PlatformFeatures />
      <SystemHealth />
    </div>
  );
}