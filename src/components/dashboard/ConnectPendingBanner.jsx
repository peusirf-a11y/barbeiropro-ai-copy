// Banner persistente no dashboard quando a conta Stripe Connect ainda não
// está totalmente liberada (sem charges_enabled). Não bloqueia o sistema —
// só convida o dono a completar o cadastro pra liberar pagamentos online.

import { Link } from 'react-router-dom';
import { CreditCard, ChevronRight } from 'lucide-react';

export default function ConnectPendingBanner({ company }) {
  if (!company) return null;
  // Só mostra para o dono (não confunde membros de equipe)
  // Se já está enabled, não exibe.
  if (company.stripe_connect_charges_enabled) return null;

  const hasAccount = !!company.stripe_connect_account_id;
  const title = hasAccount
    ? 'Complete seu cadastro Stripe para receber pagamentos'
    : 'Ative pagamentos online para sua barbearia';
  const desc = hasAccount
    ? 'Faltam alguns dados (documentos, dados bancários) no seu cadastro Stripe. Sem isso, o link público não aceita Pix nem cartão.'
    : 'Conecte sua conta Asaas e comece a receber via Pix e cartão direto na sua conta bancária.';

  return (
    <Link
      to="/app/configuracoes/pagamentos"
      className="block mb-6 group"
    >
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 hover:border-amber-300 hover:bg-amber-100/60 transition-all">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <CreditCard className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-amber-900 text-sm">{title}</div>
          <div className="text-xs text-amber-800 mt-0.5 leading-snug">{desc}</div>
        </div>
        <ChevronRight className="w-5 h-5 text-amber-700 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}