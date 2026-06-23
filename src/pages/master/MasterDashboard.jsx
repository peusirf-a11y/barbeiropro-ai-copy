// Dashboard do Master — Centro de Comando do O CORTE.
// Hierarquia: alertas críticos → métricas por categoria → alertas do sistema → saúde & features.
import MasterCriticalAlerts from '@/components/master/MasterCriticalAlerts';
import MasterMetrics from '@/components/master/MasterMetrics';
import SystemAlertsList from '@/components/master/SystemAlertsList';
import SystemHealth from '@/components/master/SystemHealth';
import PlatformFeatures from '@/components/master/PlatformFeatures';
import MasterActivityFeed from '@/components/master/feed/MasterActivityFeed';

export default function MasterDashboard() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-2xl font-black text-foreground tracking-tight">Centro de Comando</h2>
        <p className="text-sm text-muted-foreground mt-1">Visão executiva do ecossistema O CORTE em tempo real.</p>
      </div>

      <MasterCriticalAlerts />
      <MasterMetrics />
      <MasterActivityFeed />
      <SystemAlertsList />
      <PlatformFeatures />
      <SystemHealth />
    </div>
  );
}