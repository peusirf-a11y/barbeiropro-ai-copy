// Card no painel admin (Configurações) para conectar/gerenciar Stripe Connect.
// É a porta de entrada para a barbearia receber pagamentos pelo link público.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEffect } from 'react';
import { CreditCard, CheckCircle2, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';

export default function StripeConnectCard({ company }) {
  const queryClient = useQueryClient();

  // Sincroniza o status ao montar (e quando volta do redirect com ?stripe_connect=return)
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['connect-status', company?.id],
    queryFn: () => base44.functions.invoke('getConnectAccountStatus', { company_id: company.id })
      .then(r => r.data),
    enabled: !!company?.id,
    refetchOnWindowFocus: true,
  });

  // Detecta retorno do onboarding e reidrata
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_connect') === 'return' || params.get('stripe_connect') === 'refresh') {
      refetch().then(() => queryClient.invalidateQueries({ queryKey: ['companies'] }));
      // Limpa a URL
      const url = new URL(window.location.href);
      url.searchParams.delete('stripe_connect');
      window.history.replaceState({}, '', url.toString());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('createConnectOnboardingLink', {
        company_id: company.id,
        return_url: window.location.origin + window.location.pathname,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
  });

  const errorMsg = connectMutation.error?.message || '';
  const isConnectNotEnabled = errorMsg.includes('signed up for Connect');
  const isPlatformProfileMissing = errorMsg.includes('responsibilities of managing losses') || errorMsg.includes('platform-profile');

  const isConnected = status?.connected && status?.charges_enabled;
  const isPending = status?.connected && !status?.charges_enabled;
  const pixMissing = isConnected && status?.pix_enabled === false;

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
      {/* Banner de modo de teste — sempre visível enquanto operamos com chaves sk_test_ */}
      <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500 text-white uppercase tracking-wide">Test</span>
        <span className="text-xs text-amber-900 font-medium">Modo de teste ativo — nenhum pagamento real será processado.</span>
      </div>

      <div className="flex items-start gap-4 mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isConnected ? 'bg-emerald-50' : 'bg-blue-50'
        }`}>
          <CreditCard className={`w-5 h-5 ${isConnected ? 'text-emerald-600' : 'text-[#2563EB]'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-[#111827]">Receber pagamentos online</h2>
            {isConnected && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> Ativo
              </span>
            )}
            {isPending && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle className="w-3 h-3" /> Pendente
              </span>
            )}
          </div>
          <p className="text-sm text-[#6B7280] mt-1">
            Seu link público <strong className="text-[#111827]">só funciona</strong> com pagamento online ativo. Conecte sua conta Stripe para receber via Pix e cartão direto na sua conta bancária.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Verificando status…
        </div>
      )}

      {!isLoading && !status?.connected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-amber-900">Pagamento online ainda não configurado</div>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Enquanto você não conectar o Stripe, qualquer cliente que abrir seu link público verá uma mensagem de "Indisponível". Conecte agora — leva uns 5 minutos.
              </p>
            </div>
          </div>
        </div>
      )}

      {isPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="text-sm font-bold text-amber-900 mb-1">Cadastro Stripe incompleto</div>
          <p className="text-xs text-amber-800 leading-relaxed">
            Você criou a conta mas ainda faltam dados (documentos, dados bancários). Clique em "Continuar cadastro" para finalizar. Sem isso, pagamentos ficam bloqueados.
          </p>
        </div>
      )}

      {isConnected && !pixMissing && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
          <div className="text-sm font-bold text-emerald-900 mb-1">Tudo pronto ✓</div>
          <p className="text-xs text-emerald-800 leading-relaxed">
            Sua barbearia está aceitando pagamentos via Pix e cartão pelo link público. O dinheiro cai direto na sua conta Stripe.
          </p>
        </div>
      )}

      {pixMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-bold text-amber-900 mb-1">Pix ainda não está ativo</div>
              <p className="text-xs text-amber-800 leading-relaxed mb-2">
                Cartão já está funcionando. Pra liberar Pix (aprovação na hora, sem taxa de cartão), você precisa ativar manualmente no seu painel da Stripe — leva uns 2 minutos:
              </p>
              <ol className="text-xs text-amber-800 list-decimal pl-4 space-y-0.5 mb-3">
                <li>Acesse o <strong>Stripe Express Dashboard</strong> (botão abaixo)</li>
                <li>Vá em <strong>Configurações → Métodos de pagamento</strong></li>
                <li>Ative o <strong>Pix</strong></li>
                <li>Volte aqui e clique em "Atualizar status"</li>
              </ol>
              <a
                href="https://connect.stripe.com/express_login"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-600"
              >
                <ExternalLink className="w-3 h-3" />
                Abrir Stripe Express
              </a>
            </div>
          </div>
        </div>
      )}

      {connectMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          {isConnectNotEnabled ? (
            <>
              <div className="text-sm font-bold text-red-900 mb-1">Stripe Connect ainda não está ativado</div>
              <p className="text-xs text-red-800 leading-relaxed mb-2">
                A plataforma de pagamentos da BarberTrimly ainda não foi habilitada na conta Stripe. Para resolver, o administrador da BarberTrimly precisa:
              </p>
              <ol className="text-xs text-red-800 list-decimal pl-4 space-y-0.5 mb-2">
                <li>Acessar <a href="https://dashboard.stripe.com/connect/overview" target="_blank" rel="noopener noreferrer" className="font-semibold underline">dashboard.stripe.com/connect/overview</a></li>
                <li>Clicar em "Get started" e ativar o Connect</li>
                <li>Voltar aqui e tentar novamente</li>
              </ol>
            </>
          ) : isPlatformProfileMissing ? (
            <>
              <div className="text-sm font-bold text-red-900 mb-1">Falta completar o perfil da plataforma no Stripe</div>
              <p className="text-xs text-red-800 leading-relaxed mb-2">
                O Stripe exige que o administrador da BarberTrimly preencha o perfil da plataforma e defina quem assume responsabilidade por perdas/chargebacks antes de criar contas conectadas. Passos:
              </p>
              <ol className="text-xs text-red-800 list-decimal pl-4 space-y-0.5 mb-2">
                <li>Acessar <a href="https://dashboard.stripe.com/settings/connect/platform-profile" target="_blank" rel="noopener noreferrer" className="font-semibold underline">dashboard.stripe.com/settings/connect/platform-profile</a></li>
                <li>Preencher o perfil (tipo de usuários, o que vendem, volume estimado)</li>
                <li>Definir responsabilidade por perdas (geralmente a plataforma assume)</li>
                <li>Salvar e tentar conectar novamente aqui</li>
              </ol>
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-red-900 mb-1">Não foi possível conectar</div>
              <p className="text-xs text-red-800 leading-relaxed">{errorMsg || 'Tente novamente em alguns instantes.'}</p>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!status?.connected && (
          <button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="inline-flex items-center gap-2 bg-[#2563EB] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 transition-all shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
          >
            {connectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Conectar Stripe
          </button>
        )}
        {isPending && (
          <button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="inline-flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-600 disabled:opacity-50 transition-all"
          >
            {connectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            Continuar cadastro
          </button>
        )}
        {status?.connected && (
          <>
            <a
              href={`https://dashboard.stripe.com/${status.account_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 border border-black/10"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Painel Stripe
            </a>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 border border-black/10"
            >
              Atualizar status
            </button>
          </>
        )}
      </div>
    </div>
  );
}