// Grid de benefícios — cards glass com hover glow azul.
import { motion } from 'framer-motion';
import { Calendar, MessageSquare, Sparkles, Repeat, DollarSign, BarChart2, Megaphone, MessageCircle, Shield, Building2 } from 'lucide-react';
import SectionBadge from './SectionBadge';

const BENEFITS = [
  { icon: Calendar, title: 'Agenda inteligente', desc: 'Drag & drop, status em tempo real, multi-profissional e multi-unidade.' },
  { icon: MessageSquare, title: 'Confirmação automática', desc: 'WhatsApp dispara lembretes e confirmações sem você levantar um dedo.' },
  { icon: Sparkles, title: 'IA de retenção', desc: 'Detecta churn antes dele acontecer e sugere a ação certa.' },
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
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <div className="flex justify-center mb-5"><SectionBadge>Plataforma completa</SectionBadge></div>
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.02em] mb-5">
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Tudo que sua barbearia precisa.
            </span>
            <br />
            <span className="text-white/40">Num só sistema.</span>
          </h2>
          <p className="text-white/50 text-base md:text-lg">
            Operação, marketing, recorrência e IA — integrados nativamente.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BENEFITS.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ delay: i * 0.04, duration: 0.5 }}
              className="group relative rounded-2xl border border-white/8 bg-white/[0.02] backdrop-blur-sm p-6 overflow-hidden transition-all duration-300 hover:border-[#60A5FA]/30 hover:bg-white/[0.04]"
            >
              {/* Glow no hover */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-[#2563EB]/0 via-[#60A5FA]/0 to-[#2563EB]/0 group-hover:from-[#2563EB]/20 group-hover:via-[#60A5FA]/10 group-hover:to-transparent transition-all duration-500 opacity-0 group-hover:opacity-100" />

              <div className="relative">
                <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#1E3A8A] to-[#0F172A] border border-white/10 flex items-center justify-center mb-4 shadow-lg shadow-[#2563EB]/20">
                  <b.icon className="w-5 h-5 text-[#93C5FD]" />
                  <div className="absolute inset-0 rounded-xl bg-[#60A5FA]/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-white font-bold text-base mb-1.5">{b.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{b.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}