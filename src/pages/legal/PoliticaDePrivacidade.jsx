import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Logo from '@/components/Logo';

export default function PoliticaDePrivacidade() {
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

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-black text-[#0F172A] mb-2">Política de Privacidade</h1>
        <p className="text-xs text-gray-400 mb-8">Última atualização: 27 de abril de 2026 · Em conformidade com a LGPD (Lei 13.709/2018)</p>

        <Section title="1. Quem somos">
          O CORTE é uma plataforma SaaS de gestão para barbearias. Somos os controladores dos dados que você nos fornece ao se cadastrar. Em relação aos dados dos clientes da sua barbearia, atuamos como operadores — você é o controlador.
        </Section>

        <Section title="2. Dados que coletamos">
          <strong>Do dono da barbearia:</strong> nome, email, telefone/WhatsApp, dados da empresa (nome, endereço, slug, logo) e dados de pagamento (processados via Asaas, não armazenamos cartão).<br /><br />
          <strong>Dos clientes da barbearia:</strong> nome, telefone, email, histórico de agendamentos e preferências — cadastrados pela própria barbearia.<br /><br />
          <strong>Automaticamente:</strong> logs de uso, IP, navegador, e dados de telemetria para garantir o funcionamento do serviço.
        </Section>

        <Section title="3. Como usamos os dados">
          Usamos seus dados exclusivamente para: prover o serviço contratado, processar pagamentos, enviar comunicações operacionais (boas-vindas, faturas, alertas de cobrança), enviar mensagens automatizadas aos clientes da barbearia (quando configurado por você) e gerar relatórios estatísticos da sua operação.
        </Section>

        <Section title="4. Base legal (LGPD)">
          Tratamos dados com base em: <strong>execução de contrato</strong> (para prover o serviço), <strong>consentimento</strong> (para comunicações de marketing) e <strong>legítimo interesse</strong> (segurança e prevenção a fraudes).
        </Section>

        <Section title="5. Compartilhamento com terceiros">
          Compartilhamos dados estritamente com fornecedores essenciais à operação:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong>Asaas</strong> — processamento de pagamentos (PIX, cartão, boleto)</li>
            <li><strong>Evolution API</strong> — envio de mensagens via WhatsApp</li>
            <li><strong>Base44</strong> — infraestrutura de hospedagem e banco de dados</li>
          </ul>
          <span className="block mt-3">Não vendemos seus dados para terceiros, jamais.</span>
        </Section>

        <Section title="6. Armazenamento e segurança">
          Os dados ficam armazenados em servidores na nuvem com criptografia em trânsito (HTTPS) e em repouso. Aplicamos controles de acesso e isolamento por tenant (multi-tenant) para garantir que cada barbearia acesse apenas seus próprios dados.
        </Section>

        <Section title="7. Por quanto tempo guardamos">
          Mantemos seus dados enquanto sua conta estiver ativa. Após cancelamento, dados são mantidos por até 12 meses para fins legais e fiscais, depois são excluídos ou anonimizados.
        </Section>

        <Section title="8. Seus direitos (LGPD Art. 18)">
          Você pode, a qualquer momento, solicitar:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Acesso aos seus dados</li>
            <li>Correção de dados incorretos</li>
            <li>Exclusão dos seus dados (direito ao esquecimento)</li>
            <li>Portabilidade dos dados</li>
            <li>Revogação do consentimento</li>
            <li>Informação sobre com quem compartilhamos seus dados</li>
          </ul>
          <span className="block mt-3">Para exercer qualquer direito, entre em contato pelo email cadastrado.</span>
        </Section>

        <Section title="9. Cookies">
          Usamos cookies essenciais para autenticação e funcionamento do sistema. Não usamos cookies de rastreamento publicitário.
        </Section>

        <Section title="10. Mensagens automatizadas via WhatsApp">
          Quando você ativa o envio automático de mensagens, atuamos como operador. A responsabilidade pelo consentimento dos destinatários é sua. Recomendamos coletar consentimento expresso ao cadastrar clientes.
        </Section>

        <Section title="11. Crianças">
          O CORTE não é destinado a menores de 18 anos. Não coletamos intencionalmente dados de menores.
        </Section>

        <Section title="12. Alterações desta política">
          Podemos atualizar esta política. Mudanças relevantes serão comunicadas por email com pelo menos 15 dias de antecedência.
        </Section>

        <Section title="13. Encarregado de dados (DPO)">
          Para questões de privacidade e LGPD, entre em contato pelo email cadastrado em sua conta.
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
      <div className="text-sm text-gray-600 leading-relaxed">{children}</div>
    </section>
  );
}