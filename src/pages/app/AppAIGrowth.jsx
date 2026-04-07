import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Zap, Copy, AlertCircle, TrendingUp, Star, Users } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export default function AppAIGrowth() {
  const [copied, setCopied] = useState(null);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => base44.entities.Appointment.list(),
  });

  const now = new Date();

  // Generate AI insights from real data
  const inactiveCustomers = customers.filter(c => {
    if (!c.last_appointment_at) return false;
    return differenceInDays(now, new Date(c.last_appointment_at)) > 30;
  });

  const vipInactive = customers.filter(c => {
    if (c.status !== 'vip') return false;
    if (!c.last_appointment_at) return false;
    return differenceInDays(now, new Date(c.last_appointment_at)) > 21;
  });

  const insights = [
    ...(inactiveCustomers.length > 0 ? [{
      id: 'inactive',
      type: 'reativacao',
      title: `${inactiveCustomers.length} clientes sem visita há +30 dias`,
      description: 'Esses clientes costumavam visitar com regularidade mas pararam. Momento ideal para reativar.',
      priority: 'alta',
      count: inactiveCustomers.length,
      icon: AlertCircle,
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-50',
      message: 'Oi [Nome]! Já faz um tempinho que não te vemos aqui na barbearia. Que tal garantir seu horário essa semana? A agenda está aberta 😄',
    }] : []),
    ...(vipInactive.length > 0 ? [{
      id: 'vip',
      type: 'vip_ausente',
      title: `${vipInactive.length} clientes VIP sem retorno em 21 dias`,
      description: 'Seus clientes mais valiosos estão com visita atrasada. Eles merecem atenção especial.',
      priority: 'alta',
      count: vipInactive.length,
      icon: Star,
      iconColor: 'text-yellow-500',
      iconBg: 'bg-yellow-50',
      message: 'Olá [Nome]! Seu espaço preferido está esperando por você. Temos horários disponíveis essa semana, é só confirmar aqui!',
    }] : []),
    ...(appointments.length > 3 ? [{
      id: 'growth',
      type: 'crescimento',
      title: 'Baseado nos seus dados, aqui estão oportunidades de crescimento',
      description: `Você tem ${appointments.length} agendamentos registrados. Continue acompanhando para insights mais precisos.`,
      priority: 'media',
      count: appointments.length,
      icon: TrendingUp,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-50',
      message: 'Ei! Quer conhecer nossos combos exclusivos? Corte + Barba com condição especial essa semana. Agende pelo link!',
    }] : []),
  ];

  const handleCopy = (id, msg) => {
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-yellow-900" />
            </div>
            <h1 className="text-2xl font-black text-[#1B1C1E]">AI Growth Engine</h1>
          </div>
          <p className="text-gray-500 text-sm">Insights automáticos para crescer sua barbearia</p>
        </div>

        {insights.length > 0 ? (
          <div className="grid gap-5">
            {insights.map(insight => (
              <div key={insight.id} className="bg-white rounded-2xl border border-black/8 p-6">
                <div className="flex items-start gap-4 mb-5">
                  <div className={`w-10 h-10 ${insight.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <insight.icon className={`w-5 h-5 ${insight.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-[#1B1C1E]">{insight.title}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${insight.priority === 'alta' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {insight.priority.charAt(0).toUpperCase() + insight.priority.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{insight.description}</p>
                  </div>
                  <div className="text-2xl font-black text-[#1B3A4B]">{insight.count}</div>
                </div>
                <div className="bg-[#F8F7F3] rounded-xl p-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mensagem sugerida</div>
                  <p className="text-sm text-gray-700 italic mb-3">"{insight.message}"</p>
                  <button onClick={() => handleCopy(insight.id, insight.message)}
                    className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${copied === insight.id ? 'bg-green-100 text-green-700' : 'bg-[#1B3A4B] text-white hover:bg-[#1B3A4B]/90'}`}>
                    <Copy className="w-3.5 h-3.5" />
                    {copied === insight.id ? 'Copiado!' : 'Copiar mensagem'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-black/8 p-12 text-center">
            <div className="w-12 h-12 bg-[#1B3A4B]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-[#1B3A4B]" />
            </div>
            <h3 className="font-bold text-[#1B1C1E] mb-2">Sem insights por enquanto</h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">Adicione clientes e agendamentos para que a IA possa analisar e gerar insights de crescimento.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}