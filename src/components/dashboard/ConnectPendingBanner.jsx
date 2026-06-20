// Banner persistente no dashboard quando a barbearia ainda não configurou
// recebimentos (sem subaccount Asaas aprovada). Não bloqueia o sistema —
// convida o dono a completar a configuração pra liberar o agendamento online pago.

import { Link } from 'react-router-dom';
import { CreditCard, ChevronRight } from 'lucide-react';

export default function ConnectPendingBanner({ company }) {
  if (!company) return null;
  // Subaccount ativa + PIX habilitado = nada a fazer.
  if (company.asaas_subaccount_status === 'active' && company.asaas_pix_enabled) return null;
  // Barbearias legadas em modo manual continuam funcionando — não exibimos o banner.
  if (company.asaas_split_mode === 'manual' && company.asaas_pix_enabled) return null;

  const hasAccount = !!company.asaas_subaccount_id;
  const isPending = hasAccount && company.asaas_subaccount_status === 'pending';
  const isRejected = hasAccount && company.asaas_subaccount_status === 'rejected';

  const title = isPending
    ? 'Cadastro Asaas aguardando aprovação'
    : isRejected
      ? 'Cadastro Asaas reprovado — revise os dados'
      : 'Pagamentos não configurados';
  const desc = isPending
    ? 'O Asaas está analisando seus dados. Geralmente leva até 24h úteis.'
    : isRejected
      ? 'Entre em contato com o suporte para revisar e reabrir o cadastro.'
      : 'Para receber pelo seu link de agendamento é necessário CNPJ (MEI também aceito) + conta Asaas ativa.';

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
        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-white/60 px-3 py-1.5 rounded-lg flex-shrink-0 group-hover:bg-white transition-colors">
          Configurar recebimentos
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </Link>
  );
}