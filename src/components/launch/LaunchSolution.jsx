// Seção "Tudo centralizado em um único sistema" — grid das 6 áreas
import { motion } from 'framer-motion';
import { CalendarCheck, Users, Wallet, Scissors, BarChart3, CreditCard, LayoutGrid } from 'lucide-react';
import SectionBadge from '@/components/landing/SectionBadge';

const SOLUTIONS = [
  {
    icon: CalendarCheck,
    title: 'Agenda Inteligente',
    desc: 'Bloqueios, encaixes, lembretes automáticos e agendamento público pelo seu link.',
    accent: 'from-blue-500/20 to-blue-500/0',
    iconBg: 'bg-blue-500/15 border-blue-400/25 text-blue-300',
  },
  {
    icon: Users,
    title: 'Gestão de Clientes',
    desc: 'Histórico, frequência, plano ativo e classificação automática (VIP, em risco, fiel).',
    accent: 'from-violet-500/20 to-violet-500/0',
    iconBg: 'bg-violet-500/15 border-violet-400/25 text-violet-300',
  },
  {
    icon: Wallet,
    title: 'Controle Financeiro',
    desc: 'Caixa diário, comissões, sangria, suprimento e DRE — tudo em tempo real.',
    accent: 'from-emerald-500/20 to-emerald-500/0',
    iconBg: 'bg-emerald-500/15 border-emerald-400/25 text-emerald-300',
  },
  {
    icon: Scissors,
    title: 'Gestão da Equipe',
    desc: 'Cadastro de barbeiros, escala, comissões individuais e ranking de performance.',
    accent: 'from-amber-500/20 to-amber-500/0',
    iconBg: 'bg-amber-500/15 border-amber-400/25 text-amber-300',
  },
  {
    icon: BarChart3,
    title: 'Relatórios',
    desc: 'Faturamento, ticket médio, retenção e indicadores que cabem na tela do celular.',
    accent: 'from-cyan-500/20 to-cyan-500/0',
    iconBg: 'bg-cyan-500/15 border-cyan-400/25 text-cyan-300',
  },
  {
    icon: CreditCard,
    title: 'Pagamentos Integrados',
    desc: 'Pix, cartão e assinaturas direto na plataforma. Sem maquininha extra, sem planilha.',
    accent: 'from-pink-500/20 to-pink-500/0',
    iconBg: 'bg-pink-500/15 border-pink-400/25 text-pink-300',
  },
];

export default function LaunchSolution() {
  return (
    <section className="relative py-24 px-5 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="flex justify-center mb-5">
            <SectionBadge icon={LayoutGrid}>A solução</SectionBadge>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.02em] mb-4">
            <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
              Tudo centralizado em um único sistema
            </span>
          </h2>
          <p className="text-base text-white/60">
            Seis pilares conectados entre si para sua barbearia operar como uma empresa de verdade.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {SOLUTIONS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="group relative rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-6 hover:border-[#60A5FA]/30 hover:bg-white/[0.04] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${s.accent} opacity-50 group-hover:opacity-100 transition-opacity`} />
              <div className="relative">
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${s.iconBg}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-1.5">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="font-bold text-white text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}