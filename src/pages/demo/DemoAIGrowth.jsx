/**
 * DemoAIGrowth — Cópia EXATA do AppAIGrowth com dados demo.
 * Apenas AppLayout → DemoLayout e dados reais → demoData.
 * Mesma lógica de insights: inactiveCustomers, vipInactive, weakHours, unsoldServices.
 */
import DemoLayout from '@/components/layout/DemoLayout.jsx';
import { useState } from 'react';
import { Zap, Copy, AlertCircle, TrendingUp, Star, CheckCircle, Sparkles } from 'lucide-react';
import { differenceInDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import AppPageHeader from '@/components/app/AppPageHeader';
import { demoCustomers, demoAppointments, demoServices } from '@/lib/demoData';

export default function DemoAIGrowth() {
  const [copied, setCopied] = useState(null);
  const now = new Date();

  // Mesma lógica exata do AppAIGrowth
  const inactiveCustomers = demoCustomers.filter(c => {
    if (!c.last_appointment_at) return false;
    return differenceInDays(now, new Date(c.last_appointment_at)) > 30;
  });

  const vipInactive = demoCustomers.filter(c => {
    if (c.status !== 'vip') return false;
    if (!c.last_appointment_at) return false;
    return differenceInDays(now, new Date(c.last_appointment_at)) > 21;
  });

  const hourCounts = {};
  demoAppointments.filter(a => {
    const d = new Date(a.scheduled_at);
    return d >= startOfMonth(subMonths(now, 1)) && d <= endOfMonth(subMonths(now, 1));
  }).forEach(a => {
    const h = new Date(a.scheduled_at).getHours();
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  });
  const weakHours = Object.entries(hourCounts).filter(([, v]) => v < 2).map(([h]) => `${h}:00`);

  const thisMonthAppts = demoAppointments.filter(a => {
    const d = new Date(a.scheduled_at);
    return d >= startOfMonth(now) && d <= endOfMonth(now);
  });
  const soldServiceIds = new Set(thisMonthAppts.map(a => a.service_id));
  const unsoldServices = demoServices.filter(s => s.active && !soldServiceIds.has(s.id));

  const companyName = 'Studio 47';

  const insights = [
    ...(vipInactive.length > 0 ? [{
      id: 'vip',
      title: `${vipInactive.length} cliente${vipInactive.length > 1 ? 's' : ''} VIP sem retorno há +21 dias`,
      description: 'Seus clientes mais valiosos estão com visita atrasada. Eles merecem atenção especial e mensagem personalizada.',
      priority: 'alta',
      count: vipInactive.length,
      icon: Star,
      iconColor: 'text-yellow-500 dark:text-amber-400',
      iconBg: 'bg-yellow-50 dark:bg-amber-500/15',
      message: `Olá [Nome]! 🌟 Aqui é do ${companyName}. Seu espaço preferido está esperando por você! Temos horários disponíveis essa semana — é só confirmar aqui ou me chamar no WhatsApp. Sua satisfação é nossa prioridade! ✂️`,
    }] : []),
    ...(inactiveCustomers.length > 0 ? [{
      id: 'inactive',
      title: `${inactiveCustomers.length} cliente${inactiveCustomers.length > 1 ? 's' : ''} sem visita há +30 dias`,
      description: 'Clientes que costumavam visitar com regularidade pararam de aparecer. Momento ideal para reativar com uma mensagem direta.',
      priority: 'alta',
      count: inactiveCustomers.length,
      icon: AlertCircle,
      iconColor: 'text-orange-500 dark:text-orange-400',
      iconBg: 'bg-orange-50 dark:bg-orange-500/15',
      message: `Oi [Nome]! Já faz um tempinho que não te vemos aqui. 😄 Que tal garantir seu horário essa semana? A agenda está aberta e te esperamos! Bora agendar? ✂️`,
    }] : []),
    ...(weakHours.length > 0 ? [{
      id: 'weak_hours',
      title: `Horários com pouca demanda: ${weakHours.slice(0, 3).join(', ')}`,
      description: 'Esses horários tiveram menos de 2 agendamentos no mês passado. Considere promoções para preencher a agenda.',
      priority: 'media',
      count: weakHours.length,
      icon: TrendingUp,
      iconColor: 'text-blue-500 dark:text-blue-400',
      iconBg: 'bg-blue-50 dark:bg-blue-500/15',
      message: `Ei, [Nome]! 🕐 Que tal aproveitar um horário especial? Estamos com disponibilidade em ${weakHours.slice(0, 2).join(' e ')} com condição diferenciada. Me chama pra agendar! ✂️`,
    }] : []),
    ...(unsoldServices.length > 0 ? [{
      id: 'unsold',
      title: `${unsoldServices.length} serviço${unsoldServices.length > 1 ? 's' : ''} sem agendamento este mês`,
      description: `Serviço${unsoldServices.length > 1 ? 's' : ''} ativo${unsoldServices.length > 1 ? 's' : ''} sem nenhum agendamento no mês atual: ${unsoldServices.slice(0, 2).map(s => s.name).join(', ')}`,
      priority: 'media',
      count: unsoldServices.length,
      icon: Zap,
      iconColor: 'text-purple-500 dark:text-purple-400',
      iconBg: 'bg-purple-50 dark:bg-purple-500/15',
      message: `Oi [Nome]! 💈 Você já conheceu nosso ${unsoldServices[0]?.name}? É um dos favoritos da casa e temos horários disponíveis essa semana. Me chama pra marcar!`,
    }] : []),
  ];

  const handleCopy = (id, msg) => {
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2500);
    });
  };

  return (
    <DemoLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <AppPageHeader
          title="AI Growth Engine"
          subtitle="Insights automáticos baseados nos dados reais da sua barbearia"
          icon={Sparkles}
        />

        {insights.length > 0 ? (
          <div className="grid gap-5">
            {insights.map(insight => (
              <div key={insight.id} className="bg-white dark:bg-[#0B1121]/90 rounded-2xl border border-[#E5E7EF] dark:border-white/[0.08] p-6 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200">
                <div className="flex items-start gap-4 mb-5">
                  <div className={`w-11 h-11 ${insight.iconBg} ring-1 ring-black/5 dark:ring-white/10 rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <insight.icon className={`w-5 h-5 ${insight.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-[#111827] dark:text-white">{insight.title}</h3>
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${insight.priority === 'alta' ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300' : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>
                        {insight.priority === 'alta' ? '🔴 Alta' : '🟡 Média'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{insight.description}</p>
                  </div>
                  <div className="text-2xl font-black text-[#2563EB] dark:text-[#60A5FA] flex-shrink-0 tracking-tight">{insight.count}</div>
                </div>
                <div className="bg-[#FAFBFC] dark:bg-white/[0.03] rounded-xl p-4 border border-[#E5E7EF] dark:border-white/[0.08]">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">💬 Mensagem sugerida para WhatsApp</div>
                  <p className="text-sm text-slate-700 dark:text-slate-200 italic mb-3">"{insight.message}"</p>
                  <button
                    onClick={() => handleCopy(insight.id, insight.message)}
                    className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl transition-all ${copied === insight.id ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-400/30' : 'bg-[#2563EB] text-white hover:bg-[#1d4ed8] shadow-[0_4px_12px_rgba(37,99,235,0.25)]'}`}
                  >
                    {copied === insight.id
                      ? <><CheckCircle className="w-3.5 h-3.5" />Copiado!</>
                      : <><Copy className="w-3.5 h-3.5" />Copiar mensagem</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0B1121]/90 rounded-2xl border border-[#E5E7EF] dark:border-white/[0.08] p-16 text-center shadow-[var(--shadow-sm)]">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/15 ring-1 ring-emerald-100 dark:ring-emerald-400/25 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="font-bold text-[#111827] dark:text-white mb-2">Tudo certo por enquanto!</h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm max-w-sm mx-auto">
              Nenhum alerta crítico no momento. Continue registrando atendimentos para análises mais precisas.
            </p>
          </div>
        )}
      </div>
    </DemoLayout>
  );
}