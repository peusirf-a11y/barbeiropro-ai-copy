// SaasPaymentModal.jsx — Modal de Pagamento de Assinatura SaaS O CORTE via Cartão de Crédito
// Pagamento exclusivo com Cartão de Crédito, validação rigorosa no Asaas e 7 dias grátis.

import { useState } from 'react';
import StandardModal from '@/components/ui/standard-modal';
import { base44 } from '@/api/base44Client';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { maskCpfCnpj, detectCardBrand } from '@/components/booking/CardPaymentFormAsaas';

export default function SaasPaymentModal({
  isOpen,
  onClose,
  plan,
  cycle = 'monthly',
  companyId,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paidSuccess, setPaidSuccess] = useState(false);

  // Formulário exclusivo do Cartão de Crédito
  const [cardForm, setCardForm] = useState({
    name: '',
    cpf: '',
    number: '',
    expiry: '',
    cvv: '',
  });

  if (!plan) return null;

  const baseMonthly = Number(plan.price_monthly || plan.price || 89);
  const totalAmount = cycle === 'yearly' ? Math.round(baseMonthly * 12 * 0.8) : baseMonthly;
  const monthlyEquivalent = cycle === 'yearly' ? Math.round(totalAmount / 12) : baseMonthly;

  const cardBrand = detectCardBrand(cardForm.number);

  const maskCard = (v) => {
    const d = String(v || '').replace(/\D+/g, '').slice(0, 19);
    return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const maskExpiry = (v) => {
    const d = String(v || '').replace(/\D+/g, '').slice(0, 4);
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}/${d.slice(2)}`;
  };

  const handlePayWithCard = async (e) => {
    e?.preventDefault();
    setError('');

    const cleanNumber = cardForm.number.replace(/\D/g, '');
    const cleanDoc = cardForm.cpf.replace(/\D/g, '');

    if (!cardForm.name.trim() || cleanNumber.length < 13 || !cardForm.expiry || !cardForm.cvv) {
      setError('Preencha todos os dados obrigatórios do cartão.');
      return;
    }

    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      setError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido para o titular.');
      return;
    }

    if (cleanNumber.startsWith('9999')) {
      setError('Cartão não autorizado ou dados inválidos. Verifique as informações ou utilize outro cartão.');
      return;
    }

    setLoading(true);
    try {
      const [mm, yy] = cardForm.expiry.split('/');
      const expYearFull = yy?.length === 2 ? `20${yy}` : yy;

      const res = await base44.functions.invoke('createAsaasSaasSubscription', {
        company_id: companyId,
        plan_id: plan.id,
        cycle: cycle === 'yearly' ? 'yearly' : 'monthly',
        payment_method: 'CREDIT_CARD',
        credit_card: {
          holderName: cardForm.name.trim(),
          number: cleanNumber,
          expiryMonth: mm,
          expiryYear: expYearFull,
          ccv: cardForm.cvv.trim(),
        },
        holder_info: {
          name: cardForm.name.trim(),
          cpfCnpj: cleanDoc,
        },
      });

      const data = res?.data;
      if (!data || !data.success) {
        throw new Error(data?.error || data?.message || 'Cartão não autorizado ou dados inválidos. Verifique as informações ou utilize outro cartão.');
      }

      // Confirma e ativa no banco
      await base44.functions.invoke('confirmAsaasSaasPayment', {
        company_id: companyId,
        plan_id: plan.id,
      });

      setPaidSuccess(true);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.warn('[SaasPaymentModal] Erro ao validar cartão no Asaas:', err);
      setError(err?.message || 'Cartão não autorizado ou dados inválidos. Verifique as informações ou utilize outro cartão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assinar ${plan.name} — Cartão de Crédito`}
      subtitle="7 dias grátis · Cancele quando quiser · Primeira fatura em 7 dias"
    >
      <div className="space-y-4 text-white">
        {paidSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-4 ring-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white">Cartão Validado com Sucesso!</h3>
            <p className="text-xs text-white/70">
              Seu período de teste de 7 dias grátis no plano <strong className="text-white">{plan.name}</strong> foi ativado.
            </p>
          </div>
        ) : (
          <>
            {/* Resumo do Plano */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
                  Plano Selecionado
                </span>
                <span className="text-base font-black text-white">{plan.name}</span>
                <span className="text-xs text-white/50 block mt-0.5">
                  {cycle === 'yearly' ? 'Cobrança anual (R$ ' + totalAmount + '/ano)' : 'Cobrança mensal após os 7 dias'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-emerald-400">
                  R$ {monthlyEquivalent}
                </span>
                <span className="text-xs text-white/50">/mês</span>
              </div>
            </div>

            {/* Aviso de 7 dias grátis */}
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block">7 dias grátis com validação obrigatória</strong>
                <span>Nenhum valor será cobrado hoje. A primeira mensalidade só ocorrerá após 7 dias se a assinatura continuar ativa.</span>
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Formulário de Cartão */}
            <form onSubmit={handlePayWithCard} className="space-y-3.5 pt-1">
              <div>
                <label className="text-[11px] font-bold text-white/70 uppercase block mb-1">
                  Número do Cartão <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    placeholder="0000 0000 0000 0000"
                    value={cardForm.number}
                    onChange={(e) => setCardForm({ ...cardForm, number: maskCard(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono text-xs placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
                  />
                  {cardBrand && cardForm.number.length >= 2 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cardBrand.color}`}>
                        {cardBrand.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/70 uppercase block mb-1">
                  Nome Impresso no Cartão <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="EX: JOAO SOUZA SILVA"
                  value={cardForm.name}
                  onChange={(e) => setCardForm({ ...cardForm, name: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-white/70 uppercase block mb-1">
                    Validade (MM/AA) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    placeholder="MM/AA"
                    value={cardForm.expiry}
                    onChange={(e) => setCardForm({ ...cardForm, expiry: maskExpiry(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono text-xs placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-white/70 uppercase block mb-1">
                    CVV <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    placeholder="123"
                    value={cardForm.cvv}
                    onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono text-xs placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/70 uppercase block mb-1">
                  CPF ou CNPJ do Titular <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  maxLength={18}
                  value={cardForm.cpf}
                  onChange={(e) => setCardForm({ ...cardForm, cpf: maskCpfCnpj(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Lock className="w-4 h-4 text-white" />}
                  <span>{loading ? 'Validando cartão no Asaas...' : 'Iniciar 7 Dias Grátis com Cartão'}</span>
                </button>
              </div>
            </form>

            <div className="flex items-center justify-center gap-2 text-[10px] text-white/40 pt-2 border-t border-white/5">
              <CreditCard className="w-3.5 h-3.5 text-blue-400" />
              <span>Processamento direto e seguro via Asaas Pagamentos</span>
            </div>
          </>
        )}
      </div>
    </StandardModal>
  );
}
