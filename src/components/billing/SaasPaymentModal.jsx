// SaasPaymentModal.jsx — Modal de Pagamento de Assinatura SaaS O CORTE
// Plano Mensal: exclusivo Cartão de Crédito com renovação automática.
// Plano Anual: Cartão de Crédito parcelado em até 12x ou à vista via Pix.

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
  QrCode,
  Copy,
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
  const isYearly = cycle === 'yearly';
  const [paymentMethod, setPaymentMethod] = useState('CREDIT_CARD'); // 'CREDIT_CARD' | 'PIX' (PIX disponível no anual)
  const [installments, setInstallments] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paidSuccess, setPaidSuccess] = useState(false);
  const [pixData, setPixData] = useState(null);
  const [copiedPix, setCopiedPix] = useState(false);

  const [cardForm, setCardForm] = useState({
    name: '',
    cpf: '',
    number: '',
    expiry: '',
    cvv: '',
  });

  if (!plan) return null;

  const baseMonthly = Number(plan.price_monthly || plan.price || 89);
  const totalAmount = isYearly ? Math.round(baseMonthly * 12 * 0.8) : baseMonthly;
  const monthlyEquivalent = isYearly ? Math.round(totalAmount / 12) : baseMonthly;

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

  const handleGenerateYearlyPix = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await base44.functions.invoke('createAsaasSaasSubscription', {
        company_id: companyId,
        plan_id: plan.id,
        cycle: 'yearly',
        payment_method: 'PIX',
      });
      const data = res?.data;
      if (!data || !data.success || !data.pix) {
        throw new Error(data?.error || data?.message || 'Não foi possível gerar o QR Code Pix.');
      }
      setPixData(data.pix);
    } catch (err) {
      setError(err?.message || 'Erro ao gerar Pix para o plano anual.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (!pixData?.copy_paste) return;
    navigator.clipboard.writeText(pixData.copy_paste);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
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
        cycle: isYearly ? 'yearly' : 'monthly',
        payment_method: 'CREDIT_CARD',
        installment_count: isYearly ? Number(installments) : 1,
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
      title={isYearly ? `Migrar para o Plano Anual — ${plan.name}` : `Assinar ${plan.name} — Cartão de Crédito`}
      subtitle={
        isYearly
          ? 'Economize 2 meses (20% OFF) · Em até 12x no cartão de crédito ou à vista via Pix'
          : 'Renovação automática no cartão de crédito via Asaas'
      }
    >
      <div className="space-y-4 text-white">
        {paidSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-4 ring-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white">Assinatura Confirmada com Sucesso!</h3>
            <p className="text-xs text-white/70">
              O plano <strong className="text-white">{plan.name}</strong> foi ativado na sua barbearia.
            </p>
          </div>
        ) : (
          <>
            {/* Resumo do Plano */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
                  {isYearly ? 'Plano Anual (20% OFF)' : 'Plano Mensal'}
                </span>
                <span className="text-base font-black text-white">{plan.name}</span>
                <span className="text-xs text-white/50 block mt-0.5">
                  {isYearly
                    ? `De R$ ${baseMonthly}/mês por R$ ${monthlyEquivalent}/mês (Total R$ ${totalAmount}/ano)`
                    : 'Renovação mensal automática no cartão'}
                </span>
              </div>
              <div className="text-right">
                {isYearly && (
                  <span className="text-xs text-white/40 line-through block">
                    R$ {baseMonthly}/mês
                  </span>
                )}
                <span className="text-xl font-black text-emerald-400">
                  R$ {monthlyEquivalent}
                </span>
                <span className="text-xs text-white/50">/mês</span>
              </div>
            </div>

            {/* Seletor de Forma de Pagamento no Plano Anual (Cartão até 12x ou Pix à vista) */}
            {isYearly && (
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/[0.04] border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('CREDIT_CARD');
                    setError('');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'CREDIT_CARD'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Cartão em até 12x
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('PIX');
                    setError('');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'PIX'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  À vista via Pix
                </button>
              </div>
            )}

            {!isYearly && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Cobrança automática no cartão de crédito</strong>
                  <span>Sua assinatura é renovada automaticamente no cartão cadastrado via Asaas, sem necessidade de boletos.</span>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {isYearly && paymentMethod === 'PIX' ? (
              <div className="space-y-4 pt-1">
                {!pixData ? (
                  <div className="text-center space-y-3 py-4">
                    <p className="text-xs text-white/70">
                      Pague o plano anual à vista via Pix (<strong className="text-white">R$ {totalAmount}</strong>) e garanta 12 meses de acesso com 20% de desconto.
                    </p>
                    <button
                      type="button"
                      onClick={handleGenerateYearlyPix}
                      disabled={loading}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                      <span>{loading ? 'Gerando QR Code Pix...' : `Gerar QR Code Pix (R$ ${totalAmount})`}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 text-center">
                    {pixData.qr_code_base64 && (
                      <div className="bg-white p-3 rounded-xl inline-block mx-auto">
                        <img src={pixData.qr_code_base64} alt="QR Code Pix" className="w-44 h-44 mx-auto" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl p-2">
                      <input
                        type="text"
                        readOnly
                        value={pixData.copy_paste || ''}
                        className="flex-1 bg-transparent text-xs text-white font-mono px-2 focus:outline-none truncate"
                      />
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedPix ? 'Copiado!' : 'Copiar Pix'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Formulário de Cartão */
              <form onSubmit={handlePayWithCard} className="space-y-3.5 pt-1">
                {isYearly && (
                  <div>
                    <label className="text-[11px] font-bold text-white/70 uppercase block mb-1">
                      Parcelamento no Cartão
                    </label>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-white/15 text-white text-xs font-semibold focus:border-blue-400 focus:outline-none"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                        const val = (totalAmount / n).toFixed(2).replace('.', ',');
                        return (
                          <option key={n} value={n}>
                            {n}x de R$ {val} sem juros (Total R$ {totalAmount})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

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
                    <span>
                      {loading
                        ? 'Processando no Asaas...'
                        : isYearly
                        ? `Confirmar Plano Anual (${installments}x no Cartão)`
                        : 'Confirmar Cartão de Crédito'}
                    </span>
                  </button>
                </div>
              </form>
            )}

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
