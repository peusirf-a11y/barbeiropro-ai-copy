// MasterCriticalAlerts — banner de alertas críticos no topo do dashboard.
// Lê métricas e destaca os 3-4 itens que exigem ação imediata.
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Wallet, AlertCircle, ChevronRight } from 'lucide-react';

const TONES = {
  red: 'border-red-200 bg-red-50 text-red-900',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  blue: 'border-blue-200 bg-blue-50 text-blue-900',
};

const ICON_TONE = {
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
};

export default function MasterCriticalAlerts() {
  const { data } = useQuery({
    queryKey: ['master-metrics'],
    queryFn: async () => (await base44.functions.invoke('getMasterMetrics', {})).data,
    refetchInterval: 60_000,
  });

  if (!data) return null;

  const alerts = [];

  if (data.past_due > 0) {
    alerts.push({
      tone: 'red',
      icon: AlertCircle,
      title: `${data.past_due} ${data.past_due === 1 ? 'assinatura vencida' : 'assinaturas vencidas'}`,
      desc: `R$ ${Number(data.past_due_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })} em risco`,
      to: '/master/assinaturas',
    });
  }

  if (data.trial_ending_soon > 0) {
    alerts.push({
      tone: 'amber',
      icon: Clock,
      title: `${data.trial_ending_soon} ${data.trial_ending_soon === 1 ? 'trial expira' : 'trials expiram'} em 3 dias`,
      desc: 'Acompanhe conversão',
      to: '/master/barbearias?status=trialing',
    });
  }

  if (data.pending_subaccounts > 0) {
    alerts.push({
      tone: 'amber',
      icon: Wallet,
      title: `${data.pending_subaccounts} ${data.pending_subaccounts === 1 ? 'subconta Asaas pendente' : 'subcontas Asaas pendentes'}`,
      desc: 'Aguardando KYC',
      to: '/master/barbearias?subaccount=pending',
    });
  }

  if (data.rejected_subaccounts > 0) {
    alerts.push({
      tone: 'red',
      icon: AlertTriangle,
      title: `${data.rejected_subaccounts} ${data.rejected_subaccounts === 1 ? 'subconta rejeitada' : 'subcontas rejeitadas'}`,
      desc: 'Revisão manual necessária',
      to: '/master/barbearias?subaccount=rejected',
    });
  }

  if (data.pending_partners > 0) {
    alerts.push({
      tone: 'blue',
      icon: AlertCircle,
      title: `${data.pending_partners} ${data.pending_partners === 1 ? 'parceiro aguardando' : 'parceiros aguardando'} aprovação`,
      desc: 'Programa de indicações',
      to: '/master/partners',
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="p-4 sm:p-5 border-b border-border flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-red-50 ring-1 ring-red-100 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-red-600" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-lg tracking-tight">Alertas críticos</h2>
          <p className="text-[11px] text-muted-foreground">Itens que exigem ação imediata</p>
        </div>
        <span className="ml-auto text-[11px] font-bold px-2 py-0.5 bg-red-500 text-white rounded-full shadow-[0_2px_6px_rgba(239,68,68,0.4)]">
          {alerts.length}
        </span>
      </div>
      <div className="divide-y divide-border">
        {alerts.map((a, i) => {
          const Icon = a.icon;
          return (
            <Link
              key={i}
              to={a.to}
              className={`flex items-center gap-3 p-4 border-l-4 ${TONES[a.tone]} hover:brightness-95 transition-all`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ICON_TONE[a.tone]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{a.title}</div>
                <div className="text-[11px] opacity-80 mt-0.5">{a.desc}</div>
              </div>
              <ChevronRight className="w-4 h-4 opacity-60 flex-shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}