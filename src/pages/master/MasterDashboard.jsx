// MasterDashboard.jsx — Centro de Comando Executivo (Super Admin)
// Estilização Premium Business SaaS + Business Intelligence
import { Link } from 'react-router-dom';
import { Gauge, ArrowRight, ShieldCheck } from 'lucide-react';
import MasterCriticalAlerts from '@/components/master/MasterCriticalAlerts';
import MasterMetrics from '@/components/master/MasterMetrics';
import SystemAlertsList from '@/components/master/SystemAlertsList';
import PlatformFeatures from '@/components/master/PlatformFeatures';
import MasterActivityFeed from '@/components/master/feed/MasterActivityFeed';

export default function MasterDashboard() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Banner de Identidade Executiva */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#59658F]/15 text-[#59658F] dark:text-[#B5D7E8] border border-[#59658F]/25 uppercase tracking-widest">
              Business Intelligence
            </span>
            <span className="text-xs text-[#55596A] dark:text-[#8F9BBF] flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.75} /> Modo Seguro Ativo
            </span>
          </div>
          <h2 className="text-2xl font-black text-[#171827] dark:text-white tracking-tight">
            Centro de Comando da Plataforma
          </h2>
          <p className="text-xs text-[#55596A] dark:text-[#8F9BBF] mt-0.5">
            Métricas agregadas, telemetria em tempo real e orquestração de tenants.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            to="/master/observability"
            data-testid="dashboard-observability-link"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#EFF6FF] dark:bg-blue-950/40 border border-[#DBEAFE] dark:border-blue-800/50 text-[#2563EB] dark:text-blue-300 hover:bg-[#DBEAFE]/60 text-xs font-bold transition-all shadow-subtle group"
          >
            <Gauge className="w-4 h-4 text-[#2563EB] group-hover:rotate-12 transition-transform" strokeWidth={1.75} />
            <span className="tabular-nums">Observabilidade · 24ms</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={1.75} />
          </Link>
        </div>
      </div>

      <MasterCriticalAlerts />
      <MasterMetrics />
      <MasterActivityFeed />
      <SystemAlertsList />
      <PlatformFeatures />
    </div>
  );
}