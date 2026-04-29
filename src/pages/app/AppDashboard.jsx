import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useTeamRole } from '@/lib/useTeamRole';
import { canViewFinance } from '@/lib/rolePermissions';
import { useState, useEffect, useMemo } from 'react';
import { Calendar, Users, DollarSign, TrendingUp } from 'lucide-react';
import { format, startOfMonth, startOfDay, differenceInMinutes, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ActivationHealthCard from '@/components/dashboard/ActivationHealthCard';
import KpiCard from '@/components/dashboard/KpiCard';
import RevenueChart from '@/components/dashboard/RevenueChart';
import ProfessionalRanking from '@/components/dashboard/ProfessionalRanking';
import QuickActions from '@/components/dashboard/QuickActions';
import InsightsCard from '@/components/dashboard/InsightsCard';
import TodayAgendaList from '@/components/dashboard/TodayAgendaList';

export default function AppDashboard() {
  const { company, companyId, isLoading: loadingCompany } = useCompany();
  const { data: teamRole } = useTeamRole();
  const isBarbeiro = teamRole?.role === 'barbeiro';
  const myProId = teamRole?.professional_id || null;
  const showFinance = canViewFinance(teamRole?.role);
  const [alerts, setAlerts] = useState([]);

  const apptFilter = isBarbeiro && myProId
    ? { company_id: companyId, professional_id: myProId }
    : { company_id: companyId };

  const { data: appointments = [], isLoading: loadingAppts } = useQuery({
    queryKey: ['appointments', companyId, isBarbeiro ? myProId : 'all'],
    queryFn: () => base44.entities.Appointment.filter(apptFilter, '-scheduled_at', 200),
    enabled: !!companyId && (!isBarbeiro || !!myProId),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: () => base44.entities.Customer.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  // Barbeiro não acessa financeiro — query disabled.
  const { data: financial = [] } = useQuery({
    queryKey: ['financial', companyId],
    queryFn: () => base44.entities.FinancialEntry.filter({ company_id: companyId }),
    enabled: !!companyId && showFinance,
  });

  const now = new Date();
  const todayStr = now.toDateString();
  const todayKey = format(startOfDay(now), 'yyyy-MM-dd');

  const todayAppts = appointments.filter(a => new Date(a.scheduled_at).toDateString() === todayStr);

  const monthStart = startOfMonth(now);
  const monthAppts = appointments.filter(a => new Date(a.scheduled_at) >= monthStart);
  const completedMonth = monthAppts.filter(a => a.status === 'concluido');
  const revenue = financial.filter(f => f.type === 'entrada' && new Date(f.date) >= monthStart).reduce((s, f) => s + (f.amount || 0), 0);
  const avgTicket = completedMonth.length > 0 ? revenue / completedMonth.length : 0;

  // Faturamento de hoje (entradas com date = hoje)
  const todayRevenue = financial
    .filter(f => f.type === 'entrada' && (f.date || '').startsWith(todayKey))
    .reduce((s, f) => s + (f.amount || 0), 0);

  // Clientes únicos atendidos hoje (com base em appointments concluídos hoje)
  const todayCustomers = useMemo(() => {
    const set = new Set();
    todayAppts.forEach(a => {
      if (a.status === 'concluido' && (a.customer_id || a.customer_name)) {
        set.add(a.customer_id || a.customer_name);
      }
    });
    return set.size;
  }, [todayAppts]);

  // Top professionals (mês)
  const topPros = useMemo(() => {
    const map = {};
    completedMonth.forEach(a => {
      if (!a.professional_name) return;
      map[a.professional_name] = (map[a.professional_name] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [completedMonth]);

  // AI bottleneck detection
  useEffect(() => {
    if (!appointments.length && !customers.length) return;
    const detected = [];

    const pendingOld = todayAppts.filter(a =>
      a.status === 'agendado' &&
      differenceInMinutes(now, new Date(a.scheduled_at)) > 120
    );
    if (pendingOld.length > 0) {
      detected.push({
        id: 'pending_old',
        level: 'high',
        title: `${pendingOld.length} agendamento${pendingOld.length > 1 ? 's' : ''} sem confirmação há +2h`,
        desc: 'Clientes podem estar esperando. Confirme ou entre em contato.',
        href: '/app/agenda',
        icon: 'clock',
      });
    }

    const cancelledToday = todayAppts.filter(a => a.status === 'cancelado' || a.status === 'faltou');
    const cancelRate = todayAppts.length > 0 ? cancelledToday.length / todayAppts.length : 0;
    if (cancelRate >= 0.3 && cancelledToday.length >= 2) {
      detected.push({
        id: 'high_cancel',
        level: 'high',
        title: `Taxa de cancelamento alta hoje: ${Math.round(cancelRate * 100)}%`,
        desc: `${cancelledToday.length} cancelamentos/faltas registrados. Verifique os horários vagos.`,
        href: '/app/agenda',
        icon: 'warning',
      });
    }

    const vipInactive = customers.filter(c => {
      if (c.status !== 'vip' || !c.last_appointment_at) return false;
      return differenceInDays(now, new Date(c.last_appointment_at)) > 21;
    });
    if (vipInactive.length > 0) {
      detected.push({
        id: 'vip_inactive',
        level: 'medium',
        title: `${vipInactive.length} cliente${vipInactive.length > 1 ? 's' : ''} VIP sem retorno há +21 dias`,
        desc: 'Seus melhores clientes estão sumindo. Use o AI Growth para reativá-los.',
        href: '/app/ai-growth',
        icon: 'zap',
      });
    }

    // Clientes inativos em geral (não-VIP) sem retorno há +60 dias
    const generalInactive = customers.filter(c => {
      if (c.status === 'vip') return false;
      if (!c.last_appointment_at) return false;
      return differenceInDays(now, new Date(c.last_appointment_at)) > 60;
    });
    if (generalInactive.length >= 5) {
      detected.push({
        id: 'general_inactive',
        level: 'medium',
        title: `${generalInactive.length} clientes não retornam há +60 dias`,
        desc: 'Crie uma campanha de reativação para trazê-los de volta.',
        href: '/app/retencao',
        icon: 'warning',
      });
    }

    if (!loadingAppts && todayAppts.length === 0) {
      detected.push({
        id: 'empty_today',
        level: 'medium',
        title: 'Agenda vazia hoje',
        desc: 'Nenhum agendamento para hoje. Compartilhe seu link público para receber mais clientes.',
        href: '/app/configuracoes',
        icon: 'warning',
      });
    }

    setAlerts(detected);
  }, [appointments, customers, loadingAppts]);

  const isLoading = loadingCompany || loadingAppts;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-black text-[#111827] tracking-tight">Dashboard</h1>
          <p className="text-[#6B7280] text-sm mt-1 capitalize">
            {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })} · {company?.name || 'Sua barbearia'}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <QuickActions showFinance={showFinance} />
        </div>

        {/* KPI Cards principais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
          {showFinance && (
            <KpiCard
              label="Faturamento (hoje)"
              value={`R$ ${todayRevenue.toFixed(2).replace('.', ',')}`}
              sub="Entradas confirmadas"
              icon={DollarSign}
              tone="green"
            />
          )}
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
            tone="violet"
          />
          {showFinance && (
            <KpiCard
              label="Ticket médio"
              value={`R$ ${avgTicket.toFixed(2).replace('.', ',')}`}
              sub="Mês corrente"
              icon={TrendingUp}
              tone="amber"
            />
          )}
          {!showFinance && (
            <KpiCard
              label="Total clientes"
              value={customers.length}
              sub="Cadastrados"
              icon={Users}
              tone="blue"
            />
          )}
        </div>

        {/* Gráfico + Ranking */}
        {showFinance && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6">
            <div className="lg:col-span-2">
              <RevenueChart financial={financial} />
            </div>
            <div>
              <ProfessionalRanking data={topPros} />
            </div>
          </div>
        )}

        {!showFinance && topPros.length > 0 && (
          <div className="mb-6">
            <ProfessionalRanking data={topPros} />
          </div>
        )}

        {/* Insights + Agenda do dia */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6">
          <div className="lg:col-span-2">
            <TodayAgendaList appointments={todayAppts} />
          </div>
          <div className="space-y-4 lg:space-y-6">
            <InsightsCard alerts={alerts} />
            <ActivationHealthCard />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}