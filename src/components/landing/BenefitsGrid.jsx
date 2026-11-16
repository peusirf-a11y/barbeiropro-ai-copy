// Grid Bento de benefícios — SpotlightCard + BlurReveal + hierarquia assimétrica (TasteSkill + React Bits).
import { Calendar, MessageSquare, Sparkles, Repeat, DollarSign, BarChart2, Megaphone, MessageCircle, Shield, Building2 } from 'lucide-react';
import SectionBadge from './SectionBadge';
import { BlurReveal, SpotlightCard } from '@/components/motion/MotionPrimitives';

const BENEFITS = [
  { icon: Calendar, title: 'Agenda inteligente', desc: 'Drag & drop, status em tempo real, multi-profissional e multi-unidade com bloqueio automático de conflitos.', featured: true },
  { icon: MessageSquare, title: 'Confirmação automática', desc: 'WhatsApp dispara lembretes e confirmações sem você levantar um dedo.' },
  { icon: Sparkles, title: 'IA de retenção', desc: 'Detecta churn antes dele acontecer e sugere a abordagem comercial ideal para cada cliente.', featured: true },
  { icon: Repeat, title: 'Planos mensais', desc: 'Sua barbearia vira SaaS: clientes pagando todo mês no automático.' },
  { icon: DollarSign, title: 'Financeiro completo', desc: 'Caixa, DRE, comissões, fluxo de pagamentos — tudo conciliado.' },
  { icon: BarChart2, title: 'Relatórios avançados', desc: 'Ticket médio, recorrência, ranking de barbeiros e mais.' },
  { icon: Megaphone, title: 'Campanhas automáticas', desc: 'Reativação de inativos no piloto automático via WhatsApp.' },
  { icon: MessageCircle, title: 'Automação WhatsApp', desc: 'Mensagens transacionais, marketing e suporte centralizados.' },
  { icon: Shield, title: 'LGPD nativa', desc: 'Auditoria, consentimentos e exportação de dados conforme a lei.' },
  { icon: Building2, title: 'Multi-unidade', desc: 'Gerencie filiais com permissões granulares por equipe.' },
];

export default function BenefitsGrid() {
  return (
    <section id="beneficios" className="relative py-24 md:py-32 px-5 md:px-8">
      <div className="max-w-7xl mx-auto">
        <BlurReveal inView className="text-center mb-16 max-w-2xl mx-auto">
          <div className="flex justify-center mb-5"><SectionBadge>Plataforma completa</SectionBadge></div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.025em] mb-5">
            <span className="bg-gradient-to-b from-slate-900 to-slate-700 dark:from-white dark:to-white/75 bg-clip-text text-transparent">
              Tudo que sua barbearia precisa.
            </span>
            <br />
            <span className="text-[#2563EB] dark:text-slate-400">Num só sistema.</span>
          </h2>
          <p className="text-slate-600 dark:text-slate-300/75 text-base md:text-lg">
            Operação, marketing, recorrência e IA — integrados nativamente.
          </p>
        </BlurReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BENEFITS.map((b, i) => (
            <BlurReveal
              key={b.title}
              inView
              delay={i * 0.03}
              y={14}
              className={b.featured ? 'lg:col-span-2' : ''}
            >
              <SpotlightCard className="rounded-2xl p-6 h-full">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] dark:from-[#1E3A8A] dark:to-[#0F172A] border border-blue-500/20 dark:border-white/10 flex items-center justify-center shadow-md shadow-blue-600/15 dark:shadow-lg dark:shadow-[#2563EB]/20">
                    <b.icon className="w-5 h-5 text-white dark:text-[#93C5FD]" strokeWidth={1.75} />
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400/70 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="text-slate-900 dark:text-white font-bold text-base mb-1.5">{b.title}</h3>
                <p className="text-slate-600 dark:text-slate-300/75 text-sm leading-relaxed">{b.desc}</p>
              </SpotlightCard>
            </BlurReveal>
          ))}
        </div>
      </div>
    </section>
  );
}