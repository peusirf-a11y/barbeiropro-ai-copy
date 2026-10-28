import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck, Lock } from 'lucide-react';
import BrandMark from '@/components/BrandMark';
import Footer from '@/components/Footer';

export default function PoliticaDePrivacidade() {
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
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Conformidade LGPD (Lei nº 13.709/2018)
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
            Política de Privacidade
          </h1>
          <p className="text-xs text-white/50">
            Última atualização: 28 de outubro de 2026 · Plataforma O CORTE (https://ocorte.app)
          </p>
        </div>

        <Section title="1. Quem Somos e Papéis no Tratamento de Dados">
          <strong>O CORTE</strong> (
          <a href="https://ocorte.app" className="text-[#93C5FD] hover:underline">
            https://ocorte.app
          </a>
          ) é uma plataforma SaaS de gestão para barbearias. Atuamos como <strong>Controladores</strong> dos dados pessoais fornecidos pelos titulares de contas de barbearias e parceiros comerciais ao se cadastrarem na plataforma, e como <strong>Operadores</strong> em relação aos dados de clientes finais inseridos pelas barbearias assinantes.
        </Section>

        <Section title="2. Dados Pessoais Coletados">
          <p className="mb-2">
            <strong>Dos gestores, profissionais e parceiros:</strong> nome completo ou razão social, e-mail, telefone/WhatsApp, documento fiscal (quando aplicável), chave Pix para repasses e dados cadastrais do estabelecimento. Dados de pagamento de assinatura são processados de forma criptografada via gateway homologado (Asaas).
          </p>
          <p className="mb-2">
            <strong>Dos clientes das barbearias:</strong> nome, telefone/WhatsApp, e-mail e histórico de agendamentos/assinaturas registrados para execução dos serviços da barbearia.
          </p>
          <p>
            <strong>Dados técnicos e de segurança:</strong> endereço IP, registros de data/hora de acesso e identificadores de sessão para auditoria e prevenção a fraudes.
          </p>
        </Section>

        <Section title="3. Finalidades do Tratamento">
          Utilizamos os dados estritamente para: disponibilizar e manter as funcionalidades contratadas no <strong>O CORTE</strong>, processar cobranças e repasses, autenticar usuários com segurança, enviar notificações operacionais e permitir o agendamento online pelos clientes das barbearias.
        </Section>

        <Section title="4. Bases Legais (Art. 7º da LGPD)">
          O tratamento de dados fundamenta-se na <strong>execução de contrato</strong> (prestação dos serviços da plataforma), no <strong>cumprimento de obrigação legal ou regulatória</strong> (guarda de registros fiscais e de conexão), no <strong>legítimo interesse</strong> (segurança da informação e prevenção a fraudes) e no <strong>consentimento</strong> quando aplicável.
        </Section>

        <Section title="5. Compartilhamento Seguro com Operadores">
          Compartilhamos dados apenas com provedores de infraestrutura essenciais para a operação da plataforma:
          <ul className="list-disc list-inside mt-2 space-y-1 text-white/75">
            <li>
              <strong>Asaas:</strong> processamento seguro de pagamentos via Pix, boleto e cartão de crédito.
            </li>
            <li>
              <strong>Provedores de Nuvem e Banco de Dados (Supabase / Cloud):</strong> armazenamento criptografado com isolamento por barbearia (Row Level Security).
            </li>
          </ul>
          <span className="block mt-3 font-semibold text-emerald-300">
            O CORTE jamais comercializa ou cede dados pessoais a terceiros para fins publicitários.
          </span>
        </Section>

        <Section title="6. Segurança e Retenção de Dados">
          Todos os dados trafegam sob criptografia TLS/HTTPS e são armazenados em ambientes com controle estrito de acesso multi-tenant. Mantemos os dados enquanto a conta permanecer ativa e, após o encerramento, apenas pelo período exigido pela legislação fiscal e pelo Marco Civil da Internet, procedendo à exclusão ou anonimização segura na sequência.
        </Section>

        <Section title="7. Direitos dos Titulares de Dados (Art. 18 da LGPD)">
          Você possui o direito de solicitar a qualquer momento:
          <ul className="list-disc list-inside mt-2 space-y-1 text-white/75">
            <li>Confirmação da existência de tratamento e acesso aos seus dados pessoais;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
            <li>Portabilidade dos dados e informações sobre compartilhamento;</li>
            <li>Eliminação dos dados pessoais tratados com base no consentimento e revogação do consentimento.</li>
          </ul>
        </Section>

        {/* Seção de Encerramento Solicitada: Canal do Encarregado de Dados e Exercício de Direitos */}
        <section
          aria-labelledby="lgpd-dpo-heading"
          className="mt-10 rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-white/[0.03] to-[#2563EB]/10 p-6 sm:p-8 shadow-xl"
        >
          <div className="flex items-start gap-3.5 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/35 flex items-center justify-center text-emerald-300 flex-shrink-0">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="lgpd-dpo-heading"
                className="text-lg sm:text-xl font-black text-white tracking-tight"
              >
                8. Canal do Encarregado de Dados (DPO) e Exercício de Direitos
              </h2>
              <p className="text-xs text-white/55 mt-0.5">
                Atendimento às requisições da LGPD (Lei nº 13.709/2018) e proteção à privacidade
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-white/75 leading-relaxed">
            <p>
              Em conformidade com o Art. 41 da Lei Geral de Proteção de Dados Pessoais (LGPD), a plataforma <strong>O CORTE</strong> (
              <a
                href="https://ocorte.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#93C5FD] hover:underline font-medium"
              >
                https://ocorte.app
              </a>
              ) disponibiliza um canal direto com o Encarregado pelo Tratamento de Dados Pessoais (DPO) para recebimento de comunicações de titulares e da Autoridade Nacional de Proteção de Dados (ANPD).
            </p>
            <p>
              Para exercer qualquer um dos seus direitos previstos no Art. 18 da LGPD (acesso, retificação, portabilidade, revogação de consentimento ou exclusão definitiva de dados), envie sua solicitação formal para o nosso e-mail oficial de privacidade e atendimento:
            </p>
          </div>

          <div className="mt-5 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-emerald-300">
                <Mail className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-white/45">
                  E-mail Oficial de Contato & LGPD
                </span>
                <a
                  href="mailto:suporte@ocorte.app"
                  className="text-sm sm:text-base font-bold text-white hover:text-emerald-300 transition-colors"
                >
                  suporte@ocorte.app
                </a>
              </div>
            </div>

            <a
              href="mailto:suporte@ocorte.app?subject=Solicita%C3%A7%C3%A3o%20LGPD%20-%20Privacidade%20O%20CORTE"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all"
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
              <span>Solicitar Atendimento LGPD</span>
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