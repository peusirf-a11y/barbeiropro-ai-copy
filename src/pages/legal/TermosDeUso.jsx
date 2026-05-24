import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Logo from '@/components/Logo';

export default function TermosDeUso() {
  return (
    <div className="min-h-screen bg-[#F8F7F3] font-inter">
      <header className="bg-white border-b border-black/5 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center overflow-hidden">
              <Logo size={32} className="rounded-none" />
            </div>
            <span className="font-bold text-[15px] text-[#0F172A]">O CORTE</span>
          </Link>
          <Link to="/" className="text-xs text-gray-500 hover:text-[#2563EB] flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Voltar
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 prose prose-sm sm:prose">
        <h1 className="text-3xl font-black text-[#0F172A] mb-2">Termos de Uso</h1>
        <p className="text-xs text-gray-400 mb-8">Última atualização: 27 de abril de 2026</p>

        <Section title="1. Aceitação">
          Ao criar uma conta no O CORTE, você concorda integralmente com estes Termos de Uso e com nossa Política de Privacidade. Se não concordar, não utilize o serviço.
        </Section>

        <Section title="2. Descrição do serviço">
          O CORTE é uma plataforma SaaS de gestão para barbearias que oferece: agenda online, gestão de clientes, controle financeiro, link público de agendamento, envio automatizado de mensagens via WhatsApp e relatórios.
        </Section>

        <Section title="3. Cadastro e responsabilidades">
          Você é responsável por manter as informações da sua conta corretas e atualizadas, pelo conteúdo cadastrado em sua área (clientes, serviços, profissionais) e pelas comunicações enviadas aos seus clientes através da plataforma.
        </Section>

        <Section title="4. Planos e pagamentos">
          O CORTE oferece planos pagos com cobrança recorrente (mensal). O período de teste grátis é de 7 dias, após o qual a cobrança é processada automaticamente no cartão cadastrado. Você pode cancelar a qualquer momento pelo painel — o acesso continua até o fim do período pago.
          Em caso de inadimplência (cobrança recusada), o acesso pode ser pausado até a regularização.
        </Section>

        <Section title="5. Cancelamento e reembolso">
          O cancelamento pode ser feito a qualquer momento direto pelo painel de assinatura. Não há multa ou fidelidade. Reembolsos não são automáticos — entre em contato pelo email cadastrado.
        </Section>

        <Section title="6. Uso aceitável">
          É proibido usar o O CORTE para: enviar spam, mensagens não solicitadas a contatos sem consentimento, atividades ilegais, ou tentativas de quebrar a segurança da plataforma. O descumprimento pode resultar em bloqueio imediato sem reembolso.
        </Section>

        <Section title="7. Mensagens automatizadas (WhatsApp)">
          Você é responsável por garantir que possui consentimento dos seus clientes para receber comunicações via WhatsApp. O CORTE atua como ferramenta facilitadora — a responsabilidade legal pelo conteúdo e envio é sua.
        </Section>

        <Section title="8. Disponibilidade do serviço">
          Buscamos manter o serviço disponível 24/7, mas não garantimos 100% de uptime. Manutenções programadas serão comunicadas com antecedência sempre que possível.
        </Section>

        <Section title="9. Limitação de responsabilidade">
          O CORTE não se responsabiliza por perdas indiretas, lucros cessantes ou danos decorrentes da indisponibilidade temporária do serviço, falha de envio de mensagens por terceiros (Evolution API, provedores de WhatsApp) ou uso indevido da plataforma pelo cliente.
        </Section>

        <Section title="10. Alterações destes termos">
          Podemos atualizar estes termos a qualquer momento. Mudanças significativas serão comunicadas por email com pelo menos 15 dias de antecedência.
        </Section>

        <Section title="11. Lei aplicável e foro">
          Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer questões.
        </Section>

        <Section title="12. Contato">
          Dúvidas? Entre em contato pelo email cadastrado em sua conta.
        </Section>
      </article>

      <footer className="py-8 px-6 border-t border-black/5 bg-white">
        <div className="max-w-4xl mx-auto text-center text-xs text-gray-400">
          <Link to="/politica-de-privacidade" className="hover:text-[#2563EB] mr-4">Política de Privacidade</Link>
          <Link to="/termos-de-uso" className="hover:text-[#2563EB]">Termos de Uso</Link>
          <p className="mt-2">© {new Date().getFullYear()} O CORTE</p>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold text-[#0F172A] mb-2">{title}</h2>
      <p className="text-sm text-gray-600 leading-relaxed">{children}</p>
    </section>
  );
}