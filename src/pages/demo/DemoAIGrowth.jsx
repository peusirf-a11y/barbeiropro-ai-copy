/**
 * DemoAIGrowth — Réplica exata do AppAIGrowth com dados demo.
 * Mesmos insights, mesmos cards, mesmas mensagens sugeridas.
 */
import DemoLayout from '@/components/layout/DemoLayout.jsx';
import { useState } from 'react';
import { Zap, Copy, AlertCircle, TrendingUp, Star, CheckCircle, Sparkles } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import AppPageHeader from '@/components/app/AppPageHeader';
import { demoCustomers, demoAppointments, demoServices } from '@/lib/demoData';
import { toast } from 'sonner';

export default function DemoAIGrowth() {
  const [copied, setCopied] = useState(null);
  const now = new Date();

  const inactiveCustomers = demoCustomers.filter(c => {
    if (!c.last_appointment_at) return false;
    return differenceInDays(now, new Date(c.last_appointment_at)) > 30;
  });

  const vipInactive = demoCustomers.filter(c => {
    if (c.status !== 'vip') return false;
    if (!c.last_appointment_at) return false;
    return differenceInDays(now, new Date(c.last_appointment_at)) > 21;
  });

  const companyName = 'Studio 47';

  const insights = [
    ...(vipInactive.length > 0 ? [{
      id: 'vip',
      title: `${vipInactive.length} cliente${vipInactive.length > 1 ? 's' : ''} VIP sem retorno há +21 dias`,
      description: 'Seus clientes mais valiosos estão com visita atrasada. Eles merecem atenção especial e mensagem personalizada.',
      priority: 'alta',
      count: vipInactive.length,
      icon: Star,
      iconColor: 'text-yellow-500',
      iconBg: 'bg-yellow-50',
      message: `Olá [Nome]! 🌟 Aqui é do ${companyName}. Seu espaço preferido está esperando por você! Temos horários disponíveis essa semana — é só confirmar. Sua satisfação é nossa prioridade! ✂️`,
    }] : []),
    ...(inactiveCustomers.length > 0 ? [{
      id: 'inactive',
      title: `${inactiveCustomers.length} cliente${inactiveCustomers.length > 1 ? 's' : ''} sem visita há +30 dias`,
      description: 'Clientes que costumavam visitar com regularidade pararam de aparecer. Momento ideal para reativar com uma mensagem direta.',
      priority: 'alta',
      count: inactiveCustomers.length,
      icon: AlertCircle,
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-50',
      message: `Oi [Nome]! Já faz um tempinho que não te vemos no ${companyName}. 😄 Que tal garantir seu horário essa semana? A agenda está aberta e te esperamos! Bora agendar? ✂️`,
    }] : []),
    {
      id: 'weak_hours',
      title: 'Horários com pouca demanda: 13:00, 14:00',
      description: 'Esses horários tiveram menos de 2 agendamentos no mês passado. Considere promoções para preencher a agenda.',
      priority: 'media',
      count: 2,
      icon: TrendingUp,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-50',
      message: `Ei, [Nome]! 🕐 Que tal aproveitar um horário especial? Estamos com disponibilidade às 13h e 14h com condição diferenciada. Me chama pra agendar! ✂️`,
    },
    {
      id: 'upsell',
      title: 'Hidratação vendida apenas 2x este mês',
      description: 'Serviço tem boa margem mas baixa demanda. Experimente oferecer como combo com corte.',
      priority: 'media',
      count: 2,
      icon: Zap,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-50',
      message: `Dica ${companyName}: que tal incluir nossa hidratação no seu próximo corte? 20 min extras que fazem toda a diferença! ✂️`,
    },
  ];

  const handleCopy = (id, msg) => {
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(id);
      toast.success('Mensagem copiada!');
      setTimeout(() => setCopied(null), 2500);
    });
  };

  return (
    <DemoLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <AppPageHeader
          title="AI Growth Engine"
          subtitle="Insights automáticos baseados nos dados da sua barbearia"
          icon={Sparkles}
        />

        <div className="grid gap-5">
          {insights.map(insight => (
            <div key={insight.id} className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200">
              <div className="flex items-start gap-4 mb-5">
                <div className={`w-11 h-11 ${insight.iconBg} ring-1 ring-black/5 rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <insight.icon className={`w-5 h-5 ${insight.iconColor}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-[#111827]">{insight.title}</h3>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${insight.priority === 'alta' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                      {insight.priority === 'alta' ? '🔴 Alta' : '🟡 Média'}
                    </span>
                  </div>
                  <p className="text-sm text-[#6B7280]">{insight.description}</p>
                </div>
                <div className="text-2xl font-black text-[#2563EB] flex-shrink-0 tracking-tight">{insight.count}</div>
              </div>
              <div className="bg-[#FAFBFC] rounded-xl p-4 border border-black/5">
                <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">💬 Mensagem sugerida para WhatsApp</div>
                <p className="text-sm text-gray-700 italic mb-3">"{insight.message}"</p>
                <button
                  onClick={() => handleCopy(insight.id, insight.message)}
                  className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl transition-all ${copied === insight.id ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-[#2563EB] text-white hover:bg-[#1d4ed8] shadow-[0_4px_12px_rgba(37,99,235,0.25)]'}`}
                >
                  {copied === insight.id
                    ? <><CheckCircle className="w-3.5 h-3.5" />Copiado!</>
                    : <><Copy className="w-3.5 h-3.5" />Copiar mensagem</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DemoLayout>
  );
}