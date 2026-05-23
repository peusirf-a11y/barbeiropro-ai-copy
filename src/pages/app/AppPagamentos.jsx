// Página dedicada para o dono da barbearia conectar sua conta Stripe (Stripe Connect)
// e receber pagamentos online direto na sua conta bancária.
// Reutiliza o StripeConnectCard que já encapsula toda a lógica de onboarding.

import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { CreditCard, ShieldCheck, Banknote, Zap } from 'lucide-react';
import AppPageHeader from '@/components/app/AppPageHeader';
import StripeConnectCard from '@/components/billing/StripeConnectCard';
import AsaasSplitCard from '@/components/billing/AsaasSplitCard';

export default function AppPagamentos() {
  const { user } = useAuth();
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });
  const company = companies.find(c => c.owner_email === user?.email) || companies[0];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Pagamentos online"
          subtitle="Ative sua conta Asaas e receba PIX direto, com repasse automático em cada transação"
          icon={CreditCard}
        />

        {isLoading && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.35)] animate-pulse">
            <div className="h-6 w-48 bg-white/10 rounded mb-3" />
            <div className="h-4 w-full bg-white/10 rounded" />
          </div>
        )}

        {company && <AsaasSplitCard company={company} />}
        {company && <StripeConnectCard company={company} />}

        {/* Benefícios — explica por que conectar */}
        <div className="grid sm:grid-cols-3 gap-3 mt-6">
          <Benefit
            icon={Banknote}
            title="Dinheiro na sua conta"
            description="O valor cai direto na sua conta bancária via Stripe — sem intermediários."
          />
          <Benefit
            icon={ShieldCheck}
            title="Reservas garantidas"
            description="Cliente paga antes de bloquear o horário. Acabaram os no-shows."
          />
          <Benefit
            icon={Zap}
            title="Pix e cartão"
            description="Receba via Pix instantâneo ou cartão de crédito direto pelo seu link."
          />
        </div>

        {/* FAQ enxuto */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <h2 className="font-bold text-white mb-4">Perguntas frequentes</h2>
          <div className="space-y-4">
            <Faq q="Quanto custa para usar?">
              A BarberTrimly não cobra nada extra. Apenas as taxas padrão do Stripe (~3,99% no cartão e ~0,99% no Pix) são descontadas automaticamente de cada cobrança.
            </Faq>
            <Faq q="Em quanto tempo recebo o dinheiro?">
              Pix cai em poucos minutos. Cartão segue o ciclo padrão da Stripe (geralmente 1–7 dias úteis após a cobrança).
            </Faq>
            <Faq q="Preciso ter CNPJ?">
              Não. A Stripe aceita CPF para cadastro como autônomo / MEI / pessoa física.
            </Faq>
            <Faq q="E se o cliente não pagar?">
              O horário fica reservado por 15 minutos enquanto ele paga. Se o pagamento não for concluído, o slot é liberado automaticamente.
            </Faq>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Benefit({ icon: Icon, title, description }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
      <div className="w-10 h-10 rounded-xl bg-blue-400/12 ring-1 ring-blue-400/25 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-[#93C5FD]" />
      </div>
      <div className="text-sm font-bold text-white mb-1">{title}</div>
      <p className="text-xs text-white/55 leading-relaxed">{description}</p>
    </div>
  );
}

function Faq({ q, children }) {
  return (
    <div>
      <div className="text-sm font-bold text-white mb-1">{q}</div>
      <p className="text-sm text-white/60 leading-relaxed">{children}</p>
    </div>
  );
}