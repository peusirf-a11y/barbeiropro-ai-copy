// FAQ accordion premium
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, HelpCircle } from 'lucide-react';
import SectionBadge from '@/components/landing/SectionBadge';

const FAQ = [
  {
    q: 'Preciso instalar algo?',
    a: 'Não. O CORTE é 100% web — funciona direto no navegador, sem instalação. Você acessa pelo computador, tablet ou celular com o mesmo login.',
  },
  {
    q: 'Funciona no celular?',
    a: 'Sim, a plataforma foi desenhada mobile-first. Toda a operação cabe na palma da mão: agenda, caixa, clientes, relatórios.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim, sem multa e sem fidelidade. O cancelamento é feito direto no painel, com 1 clique.',
  },
  {
    q: 'Quanto tempo leva para configurar?',
    a: 'Cerca de 5 a 10 minutos. Você cadastra a barbearia, adiciona serviços, equipe e horários de atendimento — e já sai operando.',
  },
  {
    q: 'Preciso ter CNPJ?',
    a: 'Sim, o O CORTE atende barbearias formalizadas (CNPJ — MEI, ME ou outras). Isso garante segurança fiscal nos pagamentos integrados.',
  },
  {
    q: 'Existe suporte?',
    a: 'Sim. Suporte humano por WhatsApp e e-mail durante o horário comercial, com base de conhecimento e tutoriais disponíveis a qualquer hora.',
  },
];

function FAQItem({ q, a, open, onToggle }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.04] transition-colors"
      >
        <span className="text-[15px] font-semibold text-white">{q}</span>
        <span
          className={`flex-shrink-0 w-7 h-7 rounded-full border border-white/15 bg-white/[0.04] flex items-center justify-center transition-transform duration-300 ${
            open ? 'rotate-45 border-[#60A5FA]/40 bg-[#60A5FA]/10' : ''
          }`}
        >
          <Plus className="w-4 h-4 text-white/80" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 text-sm text-white/65 leading-relaxed">{a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LaunchFAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section className="relative py-24 px-5 md:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-5">
            <SectionBadge icon={HelpCircle}>Perguntas frequentes</SectionBadge>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.02em] mb-4">
            <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
              Tira-dúvidas rápido
            </span>
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <FAQItem
              key={item.q}
              q={item.q}
              a={item.a}
              open={open === i}
              onToggle={() => setOpen(open === i ? -1 : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}