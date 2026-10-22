// Métricas críticas de conversão de planos — % elegíveis, % convertidos, receita potencial vs atual.
// Calcula no frontend a partir dos dados já disponíveis (clientes, assinaturas, histórico).

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Target, Users, TrendingUp, AlertTriangle } from 'lucide-react';

const ANALYSIS_DAYS = 180;
const DAYS_PER_MONTH = 30;
const MONTHS_IN_WINDOW = ANALYSIS_DAYS / DAYS_PER_MONTH;

export default function PlanConversionMetrics({ companyId, plans, subscriptions }) {
  const since = new Date();
  since.setDate(since.getDate() - ANALYSIS_DAYS);
  const sinceISO = since.toISOString();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-conv', companyId],
    queryFn: () => base44.entities.Customer.filter({ company_id: companyId }, '-created_at', 2000),
    enabled: !!companyId,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments-conv', companyId],
    queryFn: () => base44.entities.Appointment.filter({ company_id: companyId }, '-date', 5000),
    enabled: !!companyId,
  });

  if (plans.length === 0) return null;

  // Calcula visitas/mês e gasto médio por cliente nos últimos 180d
  const visitsByCustomer = {};
  const spentByCustomer = {};
  appointments.forEach(a => {
    if (['cancelado', 'faltou'].includes(a.status)) return;
    const apptDate = a.scheduled_at || a.date || '';
    if (apptDate && apptDate < sinceISO) return;
    if (!a.customer_id) return;
    visitsByCustomer[a.customer_id] = (visitsByCustomer[a.customer_id] || 0) + 1;
    spentByCustomer[a.customer_id] = (spentByCustomer[a.customer_id] || 0) + Number(a.price || 0);
  });

  const subscriberIds = new Set(subscriptions.map(s => s.customer_id));
  const cheapestPlanPrice = Math.min(...plans.map(p => Number(p.price_monthly) || Infinity));

  // Cliente é "elegível" quando possui recorrência ou potencial de conversão nos planos ativos
  let eligibleCount = 0;
  let convertedFromEligible = 0;
  let potentialMRRFromEligibleNonSubscribers = 0;

  customers.forEach(c => {
    const visits = visitsByCustomer[c.id] || Number(c.total_appointments || 0);
    if (visits < 1 && !subscriberIds.has(c.id)) return;
    const visitsPerMonth = Math.max(visits / MONTHS_IN_WINDOW, Math.min(visits, 2));
    const ticket = visits > 0 && spentByCustomer[c.id] > 0
      ? (spentByCustomer[c.id] / visits)
      : cheapestPlanPrice;
    const monthlyAvulso = Math.max(visitsPerMonth * ticket, cheapestPlanPrice);

    if (monthlyAvulso >= cheapestPlanPrice || visits >= 1) {
      eligibleCount++;
      if (subscriberIds.has(c.id)) {
        convertedFromEligible++;
      } else {
        // Pega o plano mais próximo do gasto mensal (estimativa de receita potencial)
        const targetPlan = plans
          .filter(p => Number(p.price_monthly) <= monthlyAvulso * 1.3)
          .sort((a, b) => Number(b.price_monthly) - Number(a.price_monthly))[0] || plans[0];
        if (targetPlan) potentialMRRFromEligibleNonSubscribers += Number(targetPlan.price_monthly || 0);
      }
    }
  });

  const conversionRate = eligibleCount > 0 ? (convertedFromEligible / eligibleCount) * 100 : 0;
  const eligibilityRate = customers.length > 0 ? (eligibleCount / customers.length) * 100 : 0;
  const currentMRR = subscriptions.reduce((s, sub) => s + (sub.plan_price_snapshot || 0), 0);
  const potentialMRR = currentMRR + potentialMRRFromEligibleNonSubscribers;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-[#93C5FD]" />
        <h3 className="text-sm font-bold text-white">Conversão em planos</h3>
        <span className="text-[10px] font-semibold bg-amber-400/15 text-amber-200 border border-amber-400/25 px-2 py-0.5 rounded-full uppercase tracking-wide">Crítico</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <ConversionCard
          icon={Users}
          label="Clientes elegíveis"
          value={`${eligibleCount}`}
          sublabel={`${Math.round(eligibilityRate)}% da base`}
          color="text-[#93C5FD]"
        />
        <ConversionCard
          icon={Target}
          label="Taxa de conversão"
          value={`${Math.round(conversionRate)}%`}
          sublabel={`${convertedFromEligible} de ${eligibleCount} elegíveis`}
          color={conversionRate >= 30 ? 'text-emerald-300' : conversionRate >= 10 ? 'text-amber-300' : 'text-rose-300'}
        />
        <ConversionCard
          icon={TrendingUp}
          label="MRR atual"
          value={`R$${Math.round(currentMRR)}`}
          sublabel={`${subscriptions.length} ${subscriptions.length === 1 ? 'assinante' : 'assinantes'}`}
          color="text-emerald-300"
        />
        <ConversionCard
          icon={TrendingUp}
          label="MRR potencial"
          value={`R$${Math.round(potentialMRR)}`}
          sublabel={`+R$${Math.round(potentialMRRFromEligibleNonSubscribers)} se converter todos`}
          color="text-[#93C5FD]"
        />
      </div>

      {/* Barra de progresso */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-white/55">Conversão de elegíveis em assinantes</span>
          <span className="font-bold text-white">{Math.round(conversionRate)}%</span>
        </div>
        <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#2563EB] to-[#60A5FA] transition-all"
            style={{ width: `${Math.min(100, conversionRate)}%` }}
          />
        </div>
      </div>

      {/* Alerta quando conversão < 10% */}
      {conversionRate < 10 && eligibleCount >= 5 && (
        <div className="mt-4 flex items-start gap-2 bg-rose-400/[0.08] border border-rose-400/25 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-rose-300 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-rose-100">
            <strong>Atenção:</strong> você tem {eligibleCount} clientes que economizariam com um plano, mas só {convertedFromEligible} {convertedFromEligible === 1 ? 'assina' : 'assinam'}.
            Use o botão <strong>"Oferecer plano"</strong> na tela de Clientes para fechar essa lacuna.
          </div>
        </div>
      )}
    </div>
  );
}

function ConversionCard({ icon: Icon, label, value, sublabel, color }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/55 mb-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="text-[11px] text-white/40 mt-0.5">{sublabel}</div>
    </div>
  );
}