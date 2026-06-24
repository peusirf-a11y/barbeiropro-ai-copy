// Seção "Sua barbearia ainda perde tempo com isso?" — grid de dores
import { motion } from 'framer-motion';
import { MessageSquare, CalendarX, Wallet, UserX, UsersRound, FileX, AlertTriangle } from 'lucide-react';
import SectionBadge from '@/components/landing/SectionBadge';

const PROBLEMS = [
  { icon: MessageSquare, title: 'Agenda pelo WhatsApp', desc: 'Mensagens espalhadas, confirmações perdidas, agenda no caderno.' },
  { icon: CalendarX, title: 'Horários esquecidos', desc: 'Faltas, encaixes errados e bloqueios sem registro nenhum.' },
  { icon: Wallet, title: 'Falta de controle financeiro', desc: 'Não sabe quanto entrou, quanto saiu nem quanto sobrou no fim do mês.' },
  { icon: UserX, title: 'Clientes sem histórico', desc: 'Nenhum cadastro, nenhuma frequência, nenhum vínculo de fidelidade.' },
  { icon: UsersRound, title: 'Equipe sem acompanhamento', desc: 'Comissão no dedo, produtividade no chute, ranking inexistente.' },
  { icon: FileX, title: 'Relatórios inexistentes', desc: 'Decisões baseadas no “achômetro” em vez de dados reais.' },
];

export default function LaunchProblems() {
  return (
    <section className="relative py-24 px-5 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="flex justify-center mb-5">
            <SectionBadge icon={AlertTriangle}>Diagnóstico</SectionBadge>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.02em] mb-4">
            <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
              Sua barbearia ainda perde tempo com isso?
            </span>
          </h2>
          <p className="text-base text-white/60">
            Reconhece alguma dessas situações? Você não está sozinho — e tem como resolver.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROBLEMS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group relative rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 hover:border-rose-400/25 hover:bg-white/[0.04] transition-all duration-300"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-rose-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-400/20 flex items-center justify-center mb-3">
                  <p.icon className="w-4.5 h-4.5 text-rose-300" />
                </div>
                <h3 className="font-bold text-white text-[15px] mb-1.5">{p.title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{p.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}