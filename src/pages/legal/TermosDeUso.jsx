import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Scale, ShieldCheck } from 'lucide-react';
import BrandMark from '@/components/BrandMark';
import Footer from '@/components/Footer';

export default function TermosDeUso() {
  return (
    <div className="min-h-screen bg-[#050816] text-white font-inter flex flex-col justify-between">
      <header className="bg-[#050816]/85 backdrop-blur-xl border-b border-white/10 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/landing" aria-label="Ir para a página inicial do O CORTE">
            <BrandMark size={32} tone="dark" />
          </Link>
          <Link
            to="/landing"
            className="text-xs sm:text-sm font-semibold text-white/70 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Voltar</span>
          </Link>
        </div>
      </header>

      <article className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 flex-1">
        <div className="mb-8">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#2563EB]/15 border border-[#60A5FA]/30 text-[#93C5FD] mb-3">
            Documento Institucional · ocorte.app
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
            Termos de Uso
          </h1>
          <p className="text-xs text-white/50">
            Última atualização: 28 de outubro de 2026 · Plataforma O CORTE (https://ocorte.app)
          </p>
        </div>

        <Section title="1. Aceitação dos Termos">
          Ao criar uma conta ou utilizar a plataforma <strong>O CORTE</strong> (acessível em{' '}
          <a href="https://ocorte.app" className="text-[#93C5FD] hover:underline">
            https://ocorte.app
          </a>
          ), você concorda integralmente com estes Termos de Uso e com nossa{' '}
          <Link to="/privacidade" className="text-[#93C5FD] hover:underline">
            Política de Privacidade
          </Link>
          . Caso não concorde com qualquer disposição aqui prevista, recomendamos que não utilize o serviço.
        </Section>

        <Section title="2. Descrição do Serviço">
          <strong>O CORTE</strong> é uma plataforma SaaS de gestão para barbearias que oferece agenda online, gestão de clientes, controle financeiro e comissões, clubes de assinatura recorrente, link público de agendamento, envio de comunicações via WhatsApp e relatórios gerenciais.
        </Section>

        <Section title="3. Cadastro e Responsabilidades">
          O assinante é responsável por manter as informações da sua conta precisas e atualizadas, bem como pelo sigilo de suas credenciais de acesso, pelo conteúdo cadastrado em sua área (clientes, serviços, profissionais) e pelas comunicações enviadas aos seus clientes através da plataforma.
        </Section>

        <Section title="4. Planos, Teste Grátis e Pagamentos">
          O CORTE oferece planos de assinatura com cobrança recorrente. O período de avaliação gratuita é de 7 (sete) dias para novos cadastros elegíveis. Você pode gerenciar ou solicitar o cancelamento da sua assinatura a qualquer momento diretamente pelo painel ou através do nosso suporte oficial.
        </Section>

        <Section title="5. Cancelamento e Reembolso">
          O cancelamento pode ser efetuado a qualquer momento pelo painel de assinatura, sem multa ou fidelidade contratual, interrompendo cobranças futuras. Dúvidas ou solicitações financeiras específicas devem ser encaminhadas para{' '}
          <a href="mailto:suporte@ocorte.app" className="text-[#93C5FD] hover:underline font-medium">
            suporte@ocorte.app
          </a>
          .
        </Section>

        <Section title="6. Uso Aceitável">
          É expressamente proibido utilizar o O CORTE para envio de spam, mensagens não solicitadas a contatos sem consentimento, práticas ilícitas ou tentativas de comprometer a segurança e estabilidade da infraestrutura. O descumprimento poderá acarretar suspensão ou encerramento imediato da conta.
        </Section>

        <Section title="7. Comunicações via WhatsApp">
          A barbearia assinante é responsável por garantir que possui base legal e consentimento dos seus clientes para envio de lembretes e mensagens transacionais via WhatsApp. O CORTE atua exclusivamente como provedor tecnológico facilitador.
        </Section>

        <Section title="8. Disponibilidade e Atualizações">
          Empregamos padrões elevados de engenharia para manter a plataforma disponível 24/7. Manutenções preventivas ou evoluções técnicas poderão ocorrer periodicamente para aprimoramento contínuo do serviço.
        </Section>

        <Section title="9. Limitação de Responsabilidade">
          O CORTE não se responsabiliza por danos indiretos, lucros cessantes ou interrupções decorrentes de serviços de terceiros (operadoras de telecomunicação, gateways bancários ou APIs externas de mensageria) ou mau uso da conta pelo usuário.
        </Section>

        <Section title="10. Programa de Parceiros Oficial">
          Os participantes do Programa de Parceiros Oficial do O CORTE atuam como canais independentes de indicação comercial, recebendo comissão recorrente de 30% limitada ao teto de 12 mensalidades pagas por barbearia indicada ativa, respeitando o período de retenção antifraude (14 a 30 dias) e o valor mínimo de repasse mensal via Pix de R$ 50,00.
        </Section>

        {/* Seção de Encerramento Solicitada: Atendimento, Dúvidas e Legislação Aplicável */}
        <section
          aria-labelledby="termos-atendimento-heading"
          className="mt-10 rounded-3xl border border-[#60A5FA]/25 bg-gradient-to-br from-[#2563EB]/10 via-white/[0.03] to-white/[0.02] p-6 sm:p-8 shadow-xl"
        >
          <div className="flex items-start gap-3.5 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-[#2563EB]/20 border border-[#60A5FA]/35 flex items-center justify-center text-[#93C5FD] flex-shrink-0">
              <Scale className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="termos-atendimento-heading"
                className="text-lg sm:text-xl font-black text-white tracking-tight"
              >
                11. Atendimento, Dúvidas e Legislação Aplicável
              </h2>
              <p className="text-xs text-white/55 mt-0.5">
                Canal oficial de suporte, notificações contratuais e foro competente
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-white/75 leading-relaxed">
            <p>
              Estes Termos de Uso são regidos e interpretados exclusivamente de acordo com as leis da República Federativa do Brasil, incluindo o Marco Civil da Internet (Lei nº 12.965/2014) e a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).
            </p>
            <p>
              Para esclarecer dúvidas sobre estes Termos, solicitar suporte técnico, tratar de questões financeiras relativas à sua assinatura ou enviar notificações formais à plataforma <strong>O CORTE</strong> (
              <a
                href="https://ocorte.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#93C5FD] hover:underline font-medium"
              >
                https://ocorte.app
              </a>
              ), entre em contato diretamente pelo nosso canal oficial de atendimento:
            </p>
          </div>

          <div className="mt-5 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#93C5FD]">
                <Mail className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-white/45">
                  Central de Suporte e Atendimento
                </span>
                <a
                  href="mailto:suporte@ocorte.app"
                  className="text-sm sm:text-base font-bold text-white hover:text-[#93C5FD] transition-colors"
                >
                  suporte@ocorte.app
                </a>
              </div>
            </div>

            <a
              href="mailto:suporte@ocorte.app?subject=Atendimento%20-%20Termos%20de%20Uso%20O%20CORTE"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] hover:brightness-110 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/25 transition-all"
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
              <span>Falar com o Suporte</span>
            </a>
          </div>
        </section>
      </article>

      <Footer />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-6 rounded-2xl border border-white/8 bg-white/[0.025] p-5 sm:p-6">
      <h2 className="text-base sm:text-lg font-bold text-white mb-2">{title}</h2>
      <div className="text-sm text-white/70 leading-relaxed">{children}</div>
    </section>
  );
}