// StripeEnvMismatchBanner — P0.4
// Banner vermelho crítico no MasterDashboard quando o webhook do Stripe recebe
// eventos em ambiente errado (livemode mismatch). Cada mismatch significa que
// um pagamento real pode NÃO ter sido processado.
//
// Conta SystemAlert.type='stripe_env_mismatch' das últimas 24h. Esconde quando 0.

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertOctagon, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StripeEnvMismatchBanner() {
  const { data: alerts = [] } = useQuery({
    queryKey: ['stripe-env-mismatch-24h'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      return base44.entities.SystemAlert.filter(
        { type: 'stripe_env_mismatch', created_date: { $gte: since } },
        '-created_date',
        50,
      );
    },
    refetchInterval: 60_000, // refresh a cada 1min — alerta crítico
    staleTime: 30_000,
  });

  if (!alerts.length) return null;

  const latest = alerts[0];
  const appEnv = latest?.metadata?.app_environment || '?';
  const eventLive = latest?.metadata?.event_livemode;
  const eventEnv = eventLive === true ? 'live' : eventLive === false ? 'test' : '?';

  return (
    <div className="bg-gradient-to-r from-red-50 to-red-50/60 border-2 border-red-300 rounded-2xl p-5 shadow-[var(--shadow-md)]">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-red-100 ring-1 ring-red-200 flex items-center justify-center flex-shrink-0">
          <AlertOctagon className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-black text-red-900 text-base tracking-tight">
              Stripe em ambiente errado
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600 text-white">
              {alerts.length} {alerts.length === 1 ? 'evento' : 'eventos'} / 24h
            </span>
          </div>
          <p className="text-sm text-red-800 leading-relaxed">
            O app está rodando em <strong>{appEnv}</strong> mas recebeu webhooks <strong>{eventEnv}</strong>.
            Pagamentos NÃO foram processados. Verifique <code className="text-[12px] bg-red-100 px-1.5 py-0.5 rounded font-mono">STRIPE_ENVIRONMENT</code> e a URL do webhook no painel Stripe.
          </p>
          <Link
            to="/master/configuracoes"
            className="inline-flex items-center gap-1.5 mt-3 text-sm font-bold text-red-700 hover:text-red-900 transition-colors"
          >
            Revisar configuração <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}