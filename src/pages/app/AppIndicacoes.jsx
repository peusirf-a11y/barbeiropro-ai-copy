// Página simples de Lead Loop — empresa gera link único de indicação.
// Recompensa: 7 dias extras de trial quando indicado se cadastra (handling no checkout/webhook fica para depois).
import AppLayout from '@/components/layout/AppLayout';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Gift, Copy, CheckCircle2, Loader2, Share2 } from 'lucide-react';
import AppPageHeader from '@/components/app/AppPageHeader';

export default function AppIndicacoes() {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['referral-link'],
    queryFn: async () => {
      const res = await base44.functions.invoke('createReferralLink', {});
      return res?.data?.success ? res.data : null;
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => base44.functions.invoke('createReferralLink', {}),
    onSuccess: () => refetch(),
  });

  const handleCopy = () => {
    if (!data?.url) return;
    navigator.clipboard.writeText(data.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!data?.url) return;
    const text = `Conheça o BarberTrimly — usa esse link e ganha 7 dias grátis: ${data.url}`;
    if (navigator.share) navigator.share({ title: 'BarberTrimly', text, url: data.url }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-3xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Indique e ganhe"
          subtitle="Compartilhe seu link e ganhe recompensas para você e sua barbearia"
          icon={Gift}
        />

        <div className="bg-gradient-to-br from-[#2563EB] to-[#60A5FA] rounded-2xl p-6 text-white mb-6 shadow-[0_8px_24px_rgba(37,99,235,0.25)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Sua recompensa</div>
              <div className="text-lg font-bold">+7 dias grátis por indicação</div>
            </div>
          </div>
          <p className="text-sm opacity-90 leading-relaxed">
            A cada barbearia que se cadastrar usando seu link, você ganha 7 dias extras de assinatura.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 p-5 sm:p-6 shadow-[var(--shadow-sm)]">
          <h2 className="font-bold text-[#111827] mb-3">Seu link de indicação</h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : !data?.url ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-3">Não foi possível gerar seu link.</p>
              <button
                onClick={() => refreshMutation.mutate()}
                className="text-sm text-[#2563EB] font-semibold hover:underline"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 bg-[#FAFBFC] border border-black/5 rounded-xl px-3 py-2.5 mb-4">
                <code className="flex-1 text-xs sm:text-sm text-[#111827] truncate">{data.url}</code>
                <button
                  onClick={handleCopy}
                  className="bg-white border border-black/10 hover:border-[#2563EB] hover:text-[#2563EB] text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 flex-shrink-0 transition-all"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>

              <button
                onClick={handleShare}
                className="w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.35)] transition-all"
              >
                <Share2 className="w-4 h-4" />
                Compartilhar no WhatsApp
              </button>

              <p className="text-[11px] text-gray-400 text-center mt-3">
                Código: <code className="font-bold text-gray-500">{data.code}</code>
              </p>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}