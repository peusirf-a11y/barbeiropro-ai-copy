/**
 * DemoAIGrowth — AI Growth Engine idêntico ao AppAIGrowth.
 */
import DemoLayout from '@/components/layout/DemoLayout';
import { demoAIInsights, demoCustomers } from '@/lib/demoData';
import { Zap, Copy, AlertCircle, TrendingUp, Star, Package, Users, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const typeConfig = {
  reativacao:    { icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50', label: 'Reativação' },
  horario_fraco: { icon: TrendingUp,  color: 'text-blue-500',   bg: 'bg-blue-50',   label: 'Horário Fraco' },
  vip_ausente:   { icon: Star,        color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'VIP Ausente' },
  servico_baixo: { icon: Package,     color: 'text-purple-500', bg: 'bg-purple-50', label: 'Serviço Baixo' },
};

const priorityBadge = {
  alta:  'bg-red-100 text-red-700',
  media: 'bg-yellow-100 text-yellow-700',
  baixa: 'bg-gray-100 text-gray-600',
};

const lifecycleStats = [
  { label: 'Fiéis',       count: demoCustomers.filter(c => c.lifecycle_status === 'fiel').length,            color: 'bg-green-100 text-green-700' },
  { label: 'Em risco',    count: demoCustomers.filter(c => c.lifecycle_status === 'em_risco').length,         color: 'bg-orange-100 text-orange-700' },
  { label: 'Inativos',    count: demoCustomers.filter(c => c.lifecycle_status === 'inativo').length,          color: 'bg-gray-100 text-gray-600' },
  { label: 'Perdidos',    count: demoCustomers.filter(c => c.lifecycle_status === 'perdido').length,          color: 'bg-red-100 text-red-600' },
  { label: '1ª Visita',   count: demoCustomers.filter(c => c.lifecycle_status === 'primeira_visita').length,  color: 'bg-blue-100 text-blue-700' },
];

export default function DemoAIGrowth() {
  const [copied, setCopied] = useState(null);
  const [sent, setSent] = useState({});

  const handleCopy = (id, msg) => {
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleSend = (id) => {
    toast.success('Mensagem enviada! (simulação — sem WhatsApp real no modo demo)', { duration: 3000 });
    setSent(p => ({ ...p, [id]: true }));
  };

  return (
    <DemoLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-yellow-400 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-yellow-900" />
            </div>
            <h1 className="text-2xl font-black text-[#1B1C1E]">AI Growth Engine</h1>
          </div>
          <p className="text-gray-500 text-sm">Insights automáticos para crescer sua barbearia</p>
        </div>

        {/* Como funciona */}
        <div className="bg-[#2563EB]/5 border border-[#2563EB]/20 rounded-2xl p-5 mb-6 flex items-start gap-4">
          <Zap className="w-5 h-5 text-[#2563EB] mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-[#1B1C1E] text-sm mb-1">Como funciona</div>
            <p className="text-sm text-gray-600">A IA analisa automaticamente seus clientes, frequência de visitas, horários de pico e serviços. Em seguida, gera insights acionáveis com mensagens prontas para você enviar via WhatsApp e recuperar receita perdida.</p>
          </div>
        </div>

        {/* Ciclo de vida dos clientes */}
        <div className="bg-white rounded-2xl border border-black/5 p-5 mb-6 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-[#2563EB]" />
            <h2 className="font-bold text-[#1B1C1E]">Ciclo de vida dos clientes</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {lifecycleStats.map(s => (
              <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
                <div className="text-2xl font-black">{s.count}</div>
                <div className="text-xs font-semibold mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Insights */}
        <div className="grid gap-5">
          {demoAIInsights.map(insight => {
            const cfg = typeConfig[insight.type];
            return (
              <div key={insight.id} className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
                <div className="flex items-start gap-4 mb-5">
                  <div className={`w-11 h-11 ${cfg.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-[#1B1C1E]">{insight.title}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityBadge[insight.priority]}`}>
                        {insight.priority.charAt(0).toUpperCase() + insight.priority.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{insight.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-3xl font-black text-[#2563EB]">{insight.count}</div>
                    <div className="text-xs text-gray-400">{cfg.label}</div>
                  </div>
                </div>

                <div className="bg-[#F8F7F3] rounded-xl p-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mensagem sugerida pela IA</div>
                  <p className="text-sm text-gray-700 italic mb-3">"{insight.message}"</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleCopy(insight.id, insight.message)}
                      className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                        copied === insight.id ? 'bg-green-100 text-green-700' : 'bg-[#2563EB] text-white hover:bg-[#1d4ed8]'
                      }`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied === insight.id ? 'Copiado!' : 'Copiar mensagem'}
                    </button>
                    <button
                      onClick={() => handleSend(insight.id)}
                      className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                        sent[insight.id] ? 'bg-green-100 text-green-700' : 'bg-[#25D366] text-white hover:bg-[#22c55e]'
                      }`}
                    >
                      {sent[insight.id]
                        ? <><CheckCircle className="w-3.5 h-3.5" />Enviado!</>
                        : <>💬 Enviar via WhatsApp</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DemoLayout>
  );
}