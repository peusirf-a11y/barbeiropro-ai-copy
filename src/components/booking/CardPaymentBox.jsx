// Caixa de pagamento por cartão usando Stripe Elements (PaymentElement).
// Em caso de falha, mantém o mesmo client_secret para retry sem perder o slot.

import { useState, useEffect } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle, CreditCard } from 'lucide-react';

let stripePromiseCache = null;
let stripePromiseAccount = null;
function getStripe(stripeAccount, publishableKey) {
  if (!publishableKey) return null;
  if (!stripePromiseCache || stripePromiseAccount !== stripeAccount) {
    stripePromiseCache = loadStripe(publishableKey, { stripeAccount });
    stripePromiseAccount = stripeAccount;
  }
  return stripePromiseCache;
}

function CardForm({ primaryColor, onSucceeded }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || 'Verifique os dados do cartão.');
      setSubmitting(false);
      return;
    }

    const { error: payErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (payErr) {
      setError(payErr.message || 'Pagamento recusado. Tente outro cartão.');
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      onSucceeded?.();
    } else {
      setError('Pagamento pendente. Aguarde a confirmação.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-black/8 p-5">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-4 h-4 text-gray-400" />
        <span className="text-[11px] uppercase font-bold text-gray-500 tracking-wide">Dados do cartão</span>
      </div>

      <PaymentElement options={{ layout: 'tabs' }} />

      {error && (
        <div className="mt-3 flex items-start gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !stripe}
        className="mt-4 w-full text-white font-bold py-3 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: primaryColor }}
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Processando…</span>
        ) : 'Pagar agora'}
      </button>
      <p className="text-[11px] text-gray-400 text-center mt-2">Pagamento processado com segurança pelo Stripe.</p>
    </form>
  );
}

export default function CardPaymentBox({ clientSecret, stripeAccount, primaryColor, onSucceeded }) {
  const [pubKey, setPubKey] = useState('');
  useEffect(() => {
    base44.functions.invoke('getStripePublishableKey', {})
      .then(r => setPubKey(r?.data?.publishable_key || ''))
      .catch(() => {});
  }, []);

  if (!clientSecret || !pubKey) {
    return (
      <div className="bg-white rounded-2xl border border-black/8 p-5 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
      </div>
    );
  }
  const stripe = getStripe(stripeAccount, pubKey);
  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: primaryColor || '#2563EB',
            borderRadius: '10px',
          },
        },
        locale: 'pt-BR',
      }}
    >
      <CardForm primaryColor={primaryColor} onSucceeded={onSucceeded} />
    </Elements>
  );
}