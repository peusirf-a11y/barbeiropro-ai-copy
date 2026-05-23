// Dashboard do Master — visão geral do sistema com KPIs, alertas, saúde e funcionalidades.
import MasterMetrics from '@/components/master/MasterMetrics';
import SystemAlertsList from '@/components/master/SystemAlertsList';
import SystemHealth from '@/components/master/SystemHealth';
import PlatformFeatures from '@/components/master/PlatformFeatures';

export default function MasterDashboard() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-2xl font-black text-foreground tracking-tight">Visão geral do sistema</h2>
        <p className="text-sm text-muted-foreground mt-1">Indicadores em tempo real do O CORTE SaaS.</p>
      </div>
      <MasterMetrics />
      <SystemAlertsList />
      <PlatformFeatures />
      <SystemHealth />
    </div>
  );
}