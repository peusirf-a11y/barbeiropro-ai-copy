/**
 * DemoDashboard — Usa EXATAMENTE os mesmos componentes do AppDashboard.
 * Apenas a fonte dos dados é demo.
 */
import DemoLayout from '@/components/layout/DemoLayout.jsx';
import { useMemo } from 'react';
import { Calendar, Users, DollarSign, TrendingUp, Repeat } from 'lucide-react';
import { format, startOfMonth, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import KpiCard from '@/components/dashboard/KpiCard';
import RevenueChart from '@/components/dashboard/RevenueChart';
import ProfessionalRanking from '@/components/dashboard/ProfessionalRanking';
import QuickActions from '@/components/dashboard/QuickActions';
import InsightsCard from '@/components/dashboard/InsightsCard';
import TodayAgendaList from '@/components/dashboard/TodayAgendaList';
import { toast } from 'sonner';

import {
  demoCompany,
  demoAppointments,
  demoFinancial,
  demoSubscriptions,
} from '@/lib/demoData';

export default function DemoDashboard() {
  const now = new Date();
  const todayStr = now.toDateString();
  const todayKey = format(startOfDay(now), 'yyyy-MM-dd');

  const todayAppts = demoAppointments.filter(a => new Date(a.scheduled_at).toDateString() === todayStr);

  const monthStart = startOfMonth(now);
  const monthAppts = demoAppointments.filter(a => new Date(a.scheduled_at) >= monthStart);
  const completedMonth = monthAppts.filter(a => a.status === 'concluido');
  const revenue = demoFinancial.filter(f => f.type === 'entrada' && new Date(f.date) >= monthStart).reduce((s, f) => s + (f.amount || 0), 0);
  const avgTicket = completedMonth.length > 0 ? revenue / completedMonth.length : 0;

  const todayRevenue = demoFinancial
    .filter(f => f.type === 'entrada' && (f.date || '').startsWith(todayKey))
    .reduce((s, f) => s + (f.amount || 0), 0);

  const todayCustomers = useMemo(() => {
    const set = new Set();
    todayAppts.forEach(a => {
      if (a.status === 'concluido' && (a.customer_id || a.customer_name)) {
        set.add(a.customer_id || a.customer_name);
      }
    });
    return set.size;
  }, [todayAppts]);

  const topPros = useMemo(() => {
    const map = {};
    demoAppointments.filter(a => a.status === 'concluido').forEach(a => {
      if (!a.professional_name) return;
      map[a.professional_name] = (map[a.professional_name] || 0) + 1;
    });
    const baseline = { 'Carlos Henrique': 24, 'Rafael Torres': 18, 'Lucas Mendes': 12 };
    Object.entries(baseline).forEach(([n, v]) => { map[n] = (map[n] || 0) + v; });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, []);

  const mrr = demoSubscriptions.reduce((s, sub) => s + (sub.plan_price_snapshot || 0), 0);

  const alerts = [
    {
      id: 'vip_inactive',
      level: 'medium',
      title: '3 clientes VIP sem retorno há +21 dias',
      desc: 'Seus melhores clientes estão sumindo. Use o AI Growth para reativá-los.',
      href: '/demo/ai-growth',
      icon: 'zap',
    },
    {
      id: 'general_inactive',
      level: 'medium',
      title: '12 clientes não retornam há +60 dias',
      desc: 'Crie uma campanha de reativação para trazê-los de volta.',
      href: '/demo/ai-growth',
      icon: 'warning',
    },
  ];

  return (
    <DemoLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-black text-[#111827] tracking-tight">Dashboard</h1>
          <p className="text-[#6B7280] text-sm mt-1 capitalize">
            {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })} · {demoCompany.name}
          </p>
        </div>

        <div className="mb-6">
          <QuickActions showFinance />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
          <KpiCard
            label="Faturamento (hoje)"
            value={`R$ ${todayRevenue.toFixed(2).replace('.', ',')}`}
            sub="Entradas confirmadas"
            icon={DollarSign}
            tone="green"
          />
          <KpiCard
            label="Agendamentos (hoje)"
            value={todayAppts.length}
            sub={`${todayAppts.filter(a => a.status === 'concluido').length} concluídos`}
            icon={Calendar}
            tone="blue"
          />
          <KpiCard
            label="Clientes atendidos"
            value={todayCustomers}
            sub="Hoje"
            icon={Users}
            tone="blue"
          />
          <KpiCard
            label="Ticket médio"
            value={`R$ ${avgTicket.toFixed(2).replace('.', ',')}`}
            sub="Mês corrente"
            icon={TrendingUp}
            tone="amber"
          />
        </div>

        {/* KPIs de Assinaturas */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 mb-6">
          <KpiCard
            label="Assinantes ativos"
            value={demoSubscriptions.length}
            sub="Todos em dia"
            icon={Repeat}
            tone="green"
          />
          <KpiCard
            label="MRR"
            value={`R$ ${mrr.toFixed(2).replace('.', ',')}`}
            sub="Receita recorrente mensal"
            icon={TrendingUp}
            tone="blue"
          />
          <KpiCard
            label="ARR projetado"
            value={`R$ ${(mrr * 12).toFixed(2).replace('.', ',')}`}
            sub="MRR × 12 meses"
            icon={DollarSign}
            tone="green"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6">
          <div className="lg:col-span-2">
            <RevenueChart financial={demoFinancial} />
          </div>
          <div>
            <ProfessionalRanking data={topPros} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6">
          <div className="lg:col-span-2">
            <TodayAgendaList appointments={todayAppts} />
          </div>
          <div className="space-y-4 lg:space-y-6">
            <InsightsCard alerts={alerts} />
          </div>
        </div>
      </div>
    </DemoLayout>
  );
}