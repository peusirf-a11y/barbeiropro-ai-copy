// Seção "Tudo centralizado em um único sistema" — grid das 6 áreas
import { motion } from 'framer-motion';
import { CalendarCheck, Users, Wallet, Scissors, BarChart3, CreditCard, LayoutGrid } from 'lucide-react';
import SectionBadge from '@/components/landing/SectionBadge';

const SOLUTIONS = [
  {
    icon: CalendarCheck,
    title: 'Agenda Inteligente',
    desc: 'Bloqueios, encaixes, lembretes automáticos e agendamento público pelo seu link.',
    accent: 'from-blue-500/10 dark:from-blue-500/20 to-transparent',
    iconBg: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/15 dark:border-blue-400/25 dark:text-blue-300',
  },
  {
    icon: Users,
    title: 'Gestão de Clientes',
    desc: 'Histórico, frequência, plano ativo e classificação automática (VIP, em risco, fiel).',
    accent: 'from-violet-500/10 dark:from-violet-500/20 to-transparent',
    iconBg: 'bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-500/15 dark:border-violet-400/25 dark:text-violet-300',
  },
  {
    icon: Wallet,
    title: 'Controle Financeiro',
    desc: 'Caixa diário, comissões, sangria, suprimento e DRE — tudo em tempo real.',
    accent: 'from-emerald-500/10 dark:from-emerald-500/20 to-transparent',
    iconBg: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-400/25 dark:text-emerald-300',
  },
  {
    icon: Scissors,
    title: 'Gestão da Equipe',
    desc: 'Cadastro de barbeiros, escala, comissões individuais e ranking de performance.',
    accent: 'from-amber-500/10 dark:from-amber-500/20 to-transparent',
    iconBg: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/15 dark:border-amber-400/25 dark:text-amber-300',
  },
  {
    icon: BarChart3,
    title: 'Relatórios',
    desc: 'Faturamento, ticket médio, retenção e indicadores que cabem na tela do celular.',
    accent: 'from-cyan-500/10 dark:from-cyan-500/20 to-transparent',
    iconBg: 'bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-500/15 dark:border-cyan-400/25 dark:text-cyan-300',
  },
  {
    icon: CreditCard,
    title: 'Pagamentos Integrados',
    desc: 'Pix, cartão e assinaturas direto na plataforma. Sem maquininha extra, sem planilha.',
    accent: 'from-pink-500/10 dark:from-pink-500/20 to-transparent',
    iconBg: 'bg-pink-50 border-pink-200 text-pink-700 dark:bg-pink-500/15 dark:border-pink-400/25 dark:text-pink-300',
  },
];

export default function LaunchSolution() {
  return (
    <section id="solucao" className="relative py-24 px-5 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="flex justify-center mb-5">
            <SectionBadge icon={LayoutGrid}>A solução</SectionBadge>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.02em] mb-4">
            <span className="bg-gradient-to-b from-slate-900 to-slate-700 dark:from-white dark:to-white/70 bg-clip-text text-transparent">
              Tudo centralizado em um único sistema
            </span>
          </h2>
          <p className="text-base text-slate-600 dark:text-white/60">
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
              className="group relative rounded-2xl border border-slate-200/90 dark:border-white/8 bg-white dark:bg-white/[0.025] backdrop-blur-md p-6 hover:border-blue-300 dark:hover:border-[#60A5FA]/30 hover:shadow-md dark:hover:bg-white/[0.04] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden shadow-xs dark:shadow-none"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${s.accent} opacity-40 dark:opacity-50 group-hover:opacity-100 transition-opacity`} />
              <div className="relative">
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${s.iconBg}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/45 mb-1.5">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-slate-600 dark:text-white/60 leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}