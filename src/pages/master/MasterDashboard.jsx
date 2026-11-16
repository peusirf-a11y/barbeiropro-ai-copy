// MasterDashboard.jsx — Centro de Comando Executivo (Super Admin)
import { Link } from 'react-router-dom';
import { Gauge, ArrowRight, ShieldCheck } from 'lucide-react';
import { SpotlightCard } from '@/components/motion/MotionPrimitives';
import MasterCriticalAlerts from '@/components/master/MasterCriticalAlerts';
import MasterMetrics from '@/components/master/MasterMetrics';
import SystemAlertsList from '@/components/master/SystemAlertsList';
import PlatformFeatures from '@/components/master/PlatformFeatures';
import MasterActivityFeed from '@/components/master/feed/MasterActivityFeed';

export default function MasterDashboard() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Banner de Identidade Executiva */}
      <SpotlightCard
        variant="adaptive"
        hoverLift={false}
        className="rounded-2xl p-5 sm:p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 text-[11px] font-semibold tracking-wider uppercase text-[#59658F] dark:text-[#93C5FD]">
              <span>Business Intelligence</span>
              <span className="text-slate-400 dark:text-white/30">·</span>
              <span className="inline-flex items-center gap-1 normal-case tracking-normal text-[#55596A] dark:text-slate-300 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.75} /> Modo Seguro Ativo
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-[#171827] dark:text-white tracking-tight">
              Centro de Comando da Plataforma
            </h2>
            <p className="text-xs text-[#55596A] dark:text-slate-300/80 mt-1">
              Métricas agregadas, telemetria em tempo real e orquestração de tenants.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              to="/master/observability"
              data-testid="dashboard-observability-link"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/10 border border-[#DBEAFE] dark:border-blue-400/25 text-[#2563EB] dark:text-blue-300 hover:bg-[#DBEAFE]/60 dark:hover:bg-blue-500/20 text-xs font-bold transition-all duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] group"
            >
              <Gauge className="w-4 h-4 text-[#2563EB] dark:text-blue-400 group-hover:rotate-12 transition-transform" strokeWidth={1.75} />
              <span className="tabular-nums">Observabilidade · 24ms</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </SpotlightCard>

      <MasterCriticalAlerts />
      <MasterMetrics />
      <MasterActivityFeed />
      <SystemAlertsList />
      <PlatformFeatures />
    </div>
  );
}