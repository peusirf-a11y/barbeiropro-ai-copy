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
    queryFn: () => base44.entities.Customer.filter({ company_id: companyId }, '-created_date', 2000),
    enabled: !!companyId,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments-conv', companyId],
    queryFn: () => base44.entities.Appointment.filter({ company_id: companyId, status: 'concluido' }, '-scheduled_at', 5000),
    enabled: !!companyId,
  });

  if (plans.length === 0) return null;

  // Calcula visitas/mês e gasto médio por cliente nos últimos 180d
  const visitsByCustomer = {};
  const spentByCustomer = {};
  appointments.forEach(a => {
    if (a.scheduled_at < sinceISO || !a.customer_id) return;
    visitsByCustomer[a.customer_id] = (visitsByCustomer[a.customer_id] || 0) + 1;
    spentByCustomer[a.customer_id] = (spentByCustomer[a.customer_id] || 0) + (a.price || 0);
  });

  const subscriberIds = new Set(subscriptions.map(s => s.customer_id));
  const cheapestPlanPrice = Math.min(...plans.map(p => p.price_monthly || Infinity));

  // Cliente é "elegível" quando: visitas/mês × ticket médio > preço do plano mais barato
  let eligibleCount = 0;
  let convertedFromEligible = 0;
  let potentialMRRFromEligibleNonSubscribers = 0;

  customers.forEach(c => {
    const visits = visitsByCustomer[c.id] || 0;
    if (visits < 2) return; // sem dados suficientes
    const visitsPerMonth = visits / MONTHS_IN_WINDOW;
    const ticket = (spentByCustomer[c.id] || 0) / visits;
    const monthlyAvulso = visitsPerMonth * ticket;

    if (monthlyAvulso > cheapestPlanPrice) {
      eligibleCount++;
      if (subscriberIds.has(c.id)) {
        convertedFromEligible++;
      } else {
        // Pega o plano mais próximo do gasto mensal (estimativa de receita potencial)
        const targetPlan = plans
          .filter(p => p.price_monthly <= monthlyAvulso)
          .sort((a, b) => b.price_monthly - a.price_monthly)[0];
        if (targetPlan) potentialMRRFromEligibleNonSubscribers += targetPlan.price_monthly;
      }
    }
  });

  const conversionRate = eligibleCount > 0 ? (convertedFromEligible / eligibleCount) * 100 : 0;
  const eligibilityRate = customers.length > 0 ? (eligibleCount / customers.length) * 100 : 0;
  const currentMRR = subscriptions.reduce((s, sub) => s + (sub.plan_price_snapshot || 0), 0);
  const potentialMRR = currentMRR + potentialMRRFromEligibleNonSubscribers;

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-fuchsia-600" />
        <h3 className="text-sm font-bold text-[#111827]">Conversão em planos</h3>
        <span className="text-[10px] font-semibold bg-fuchsia-100 text-fuchsia-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Crítico</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <ConversionCard
          icon={Users}
          label="Clientes elegíveis"
          value={`${eligibleCount}`}
          sublabel={`${Math.round(eligibilityRate)}% da base`}
          color="text-blue-600"
        />
        <ConversionCard
          icon={Target}
          label="Taxa de conversão"
          value={`${Math.round(conversionRate)}%`}
          sublabel={`${convertedFromEligible} de ${eligibleCount} elegíveis`}
          color={conversionRate >= 30 ? 'text-emerald-600' : conversionRate >= 10 ? 'text-amber-600' : 'text-red-600'}
        />
        <ConversionCard
          icon={TrendingUp}
          label="MRR atual"
          value={`R$${Math.round(currentMRR)}`}
          sublabel={`${subscriptions.length} ${subscriptions.length === 1 ? 'assinante' : 'assinantes'}`}
          color="text-emerald-600"
        />
        <ConversionCard
          icon={TrendingUp}
          label="MRR potencial"
          value={`R$${Math.round(potentialMRR)}`}
          sublabel={`+R$${Math.round(potentialMRRFromEligibleNonSubscribers)} se converter todos`}
          color="text-violet-600"
        />
      </div>

      {/* Barra de progresso */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-500">Conversão de elegíveis em assinantes</span>
          <span className="font-bold text-[#111827]">{Math.round(conversionRate)}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
            style={{ width: `${Math.min(100, conversionRate)}%` }}
          />
        </div>
      </div>

      {/* Alerta quando conversão < 10% */}
      {conversionRate < 10 && eligibleCount >= 5 && (
        <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-900">
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
    <div className="bg-gradient-to-br from-gray-50 to-white border border-black/5 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">{sublabel}</div>
    </div>
  );
}