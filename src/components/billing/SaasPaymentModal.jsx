// SaasPaymentModal.jsx — Modal de Pagamento de Assinatura SaaS O CORTE via Asaas (Conta Mãe)
// Permite que a barbearia escolha Mensal / Anual e pague via Pix ou Cartão de Crédito.
// Ao confirmar o pagamento, atualiza a barbearia para subscription_status = 'active'.

import { useState } from 'react';
import StandardModal from '@/components/ui/standard-modal';
import { base44 } from '@/api/base44Client';
import {
  QrCode,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Lock,
} from 'lucide-react';

export default function SaasPaymentModal({
  isOpen,
  onClose,
  plan,
  cycle = 'monthly',
  companyId,
  onSuccess,
}) {
  const [method, setMethod] = useState('pix'); // 'pix' | 'card'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pixData, setPixData] = useState(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [paidSuccess, setPaidSuccess] = useState(false);

  // Formulário do Cartão
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

  const handleGeneratePix = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('createAsaasSaasSubscription', {
        company_id: companyId,
        plan_id: plan.id,
        cycle: cycle === 'yearly' ? 'yearly' : 'monthly',
        payment_method: 'PIX',
      });
      const data = res?.data;
      if (data?.pix) {
        setPixData(data.pix);
      } else {
        setError('Não foi possível gerar o código Pix. Tente novamente.');
      }
    } catch (err) {
      setError(err?.message || 'Erro ao conectar com o Asaas.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPixPayment = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('confirmAsaasSaasPayment', {
        company_id: companyId,
        plan_id: plan.id,
      });
      if (res?.data?.success) {
        setPaidSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1800);
      } else {
        setError('Pagamento ainda não identificado no Asaas. Aguarde alguns segundos e tente novamente.');
      }
    } catch (err) {
      setError(err?.message || 'Erro ao confirmar pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayWithCard = async (e) => {
    e?.preventDefault();
    if (!cardForm.name.trim() || !cardForm.number || !cardForm.expiry || !cardForm.cvv) {
      setError('Preencha todos os dados do cartão.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('createAsaasSaasSubscription', {
        company_id: companyId,
        plan_id: plan.id,
        cycle: cycle === 'yearly' ? 'yearly' : 'monthly',
        payment_method: 'CREDIT_CARD',
        credit_card: {
          holderName: cardForm.name,
          number: cardForm.number.replace(/\D/g, ''),
          expiryMonth: cardForm.expiry.split('/')[0]?.trim(),
          expiryYear: cardForm.expiry.split('/')[1]?.trim(),
          ccv: cardForm.cvv.trim(),
        },
        holder_info: {
          name: cardForm.name,
          cpfCnpj: cardForm.cpf.replace(/\D/g, ''),
        },
      });

      // Confirma e ativa
      await base44.functions.invoke('confirmAsaasSaasPayment', {
        company_id: companyId,
        plan_id: plan.id,
      });

      setPaidSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1800);
    } catch (err) {
      setError(err?.message || 'Falha ao processar o cartão no Asaas.');
    } finally {
      setLoading(false);
    }
  };

  const copyPixCode = () => {
    if (pixData?.copy_paste) {
      navigator.clipboard.writeText(pixData.copy_paste);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2500);
    }
  };

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assinar ${plan.name}`}
      subtitle={`Ciclo ${cycle === 'yearly' ? 'Anual com 20% de desconto' : 'Mensal recorrente'}`}
    >
      <div className="space-y-5 text-white">
        {paidSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-4 ring-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white">Assinatura Ativada com Sucesso!</h3>
            <p className="text-sm text-white/70">
              Seu plano <strong className="text-white">{plan.name}</strong> está ativo. Todos os recursos da sua barbearia foram liberados.
            </p>
          </div>
        ) : (
          <>
            {/* Resumo do Plano */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">
                  Plano Escolhido
                </span>
                <span className="text-lg font-black text-white">{plan.name}</span>
                <span className="text-xs text-white/50 block mt-0.5">
                  {cycle === 'yearly' ? 'Cobrança anual de R$ ' + totalAmount : 'Cobrança mensal recorrente'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-400">
                  R$ {monthlyEquivalent}
                </span>
                <span className="text-xs text-white/50">/mês</span>
              </div>
            </div>

            {/* Seletor de Método de Pagamento */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => { setMethod('pix'); setPixData(null); }}
                className={`p-3.5 rounded-xl border flex items-center justify-center gap-2.5 font-bold text-xs transition-all cursor-pointer ${
                  method === 'pix'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 ring-2 ring-blue-500/30'
                    : 'bg-white/[0.02] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Pix Instantâneo</span>
              </button>
              <button
                type="button"
                onClick={() => setMethod('card')}
                className={`p-3.5 rounded-xl border flex items-center justify-center gap-2.5 font-bold text-xs transition-all cursor-pointer ${
                  method === 'card'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 ring-2 ring-blue-500/30'
                    : 'bg-white/[0.02] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Cartão de Crédito</span>
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Conteúdo PIX */}
            {method === 'pix' && (
              <div className="space-y-4">
                {!pixData ? (
                  <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 text-center space-y-4">
                    <QrCode className="w-10 h-10 text-blue-400 mx-auto" />
                    <div>
                      <p className="text-sm font-bold text-white">Gerar Qr Code e Código Pix</p>
                      <p className="text-xs text-white/60 mt-1">
                        Gere a cobrança via conta oficial Asaas da plataforma e ative sua assinatura em segundos.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGeneratePix}
                      disabled={loading}
                      className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 mx-auto disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-500/20"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      <span>{loading ? 'Gerando no Asaas...' : `Gerar Pix de R$ ${totalAmount}`}</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4 text-center">
                    <div className="inline-block p-3 rounded-2xl bg-white border border-white/20 shadow-md">
                      <img
                        src={pixData.qr_code_base64}
                        alt="QR Code Pix"
                        className="w-48 h-48 mx-auto rounded-lg"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-white/60 px-1">
                        <span>Código Pix Copia e Cola:</span>
                        <span className="text-[10px] text-emerald-400 font-mono">Expira em 24h</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={pixData.copy_paste}
                          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white/80 select-all"
                        />
                        <button
                          type="button"
                          onClick={copyPixCode}
                          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
                        >
                          {copiedPix ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedPix ? 'Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleConfirmPixPayment}
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>Já paguei, ativar meu plano</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Conteúdo CARTÃO */}
            {method === 'card' && (
              <form onSubmit={handlePayWithCard} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold text-white/60 uppercase block mb-1">
                    Nome Completo no Cartão
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: JOAO SOUZA SILVA"
                    value={cardForm.name}
                    onChange={(e) => setCardForm({ ...cardForm, name: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-white/60 uppercase block mb-1">
                      CPF / CNPJ do Titular
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="000.000.000-00"
                      value={cardForm.cpf}
                      onChange={(e) => setCardForm({ ...cardForm, cpf: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-white/60 uppercase block mb-1">
                      Número do Cartão
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={19}
                      placeholder="0000 0000 0000 0000"
                      value={cardForm.number}
                      onChange={(e) => setCardForm({ ...cardForm, number: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-white/60 uppercase block mb-1">
                      Validade (MM/AAAA)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={7}
                      placeholder="12/2028"
                      value={cardForm.expiry}
                      onChange={(e) => setCardForm({ ...cardForm, expiry: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-white/60 uppercase block mb-1">
                      CVV
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      placeholder="123"
                      value={cardForm.cvv}
                      onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    <span>{loading ? 'Processando com Asaas...' : `Pagar R$ ${totalAmount} e Ativar Plano`}</span>
                  </button>
                </div>
              </form>
            )}

            <div className="flex items-center justify-center gap-2 text-[11px] text-white/40 pt-2 border-t border-white/5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Processamento 100% seguro via Asaas Pagamentos</span>
            </div>
          </>
        )}
      </div>
    </StandardModal>
  );
}
