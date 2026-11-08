// Dashboard do Master — Centro de Comando do O CORTE.
// Hierarquia: alertas críticos → métricas por categoria → feed de atividades → alertas do sistema → features.
import { Link } from 'react-router-dom';
import { Gauge, ArrowRight } from 'lucide-react';
import MasterCriticalAlerts from '@/components/master/MasterCriticalAlerts';
import MasterMetrics from '@/components/master/MasterMetrics';
import SystemAlertsList from '@/components/master/SystemAlertsList';
import PlatformFeatures from '@/components/master/PlatformFeatures';
import MasterActivityFeed from '@/components/master/feed/MasterActivityFeed';

export default function MasterDashboard() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Centro de Comando</h2>
          <p className="text-sm text-muted-foreground mt-1">Visão executiva do ecossistema O CORTE em tempo real.</p>
        </div>
        <Link
          to="/master/observability"
          data-testid="dashboard-observability-link"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 text-xs font-bold transition-colors"
        >
          <Gauge className="w-4 h-4" />
          <span>Observabilidade (24h) · Latency: 24 ms</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <MasterCriticalAlerts />
      <MasterMetrics />
      <MasterActivityFeed />
      <SystemAlertsList />
      <PlatformFeatures />
    </div>
  );
}