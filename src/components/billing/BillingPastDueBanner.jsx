// Banner persistente exibido quando subscription_status=past_due.
// CTA: regularizar via Stripe Customer Portal.
import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function BillingPastDueBanner() {
  const [loading, setLoading] = useState(false);

  const handleManage = async () => {
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('createCustomerPortalSession', {
        return_url: window.location.href,
      });
      if (data?.url) window.location.href = data.url;
      else setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
        <span className="text-sm text-amber-900">
          <strong>Sua assinatura está pendente.</strong> Regularize para liberar relatórios e financeiro.
        </span>
      </div>
      <button
        onClick={handleManage}
        disabled={loading}
        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        Regularizar agora
      </button>
    </div>
  );
}