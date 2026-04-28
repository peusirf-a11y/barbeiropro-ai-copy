// Página simples de Lead Loop — empresa gera link único de indicação.
// Recompensa: 7 dias extras de trial quando indicado se cadastra (handling no checkout/webhook fica para depois).
import AppLayout from '@/components/layout/AppLayout';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Gift, Copy, CheckCircle2, Loader2, Share2 } from 'lucide-react';

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
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-3xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-black text-[#0F172A]">Indique e ganhe</h1>
          <p className="text-gray-500 text-sm mt-1">Compartilhe seu link e ganhe recompensas para você e sua barbearia</p>
        </div>

        <div className="bg-gradient-to-br from-[#2563EB] to-[#60A5FA] rounded-2xl p-6 text-white mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide opacity-80">Sua recompensa</div>
              <div className="text-lg font-bold">+7 dias grátis por indicação</div>
            </div>
          </div>
          <p className="text-sm opacity-90 leading-relaxed">
            A cada barbearia que se cadastrar usando seu link, você ganha 7 dias extras de assinatura.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-black/8 p-5 sm:p-6">
          <h2 className="font-bold text-[#0F172A] mb-3">Seu link de indicação</h2>

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
              <div className="flex items-center gap-2 bg-gray-50 border border-black/10 rounded-xl px-3 py-2.5 mb-4">
                <code className="flex-1 text-xs sm:text-sm text-[#0F172A] truncate">{data.url}</code>
                <button
                  onClick={handleCopy}
                  className="bg-white border border-black/10 hover:border-[#2563EB] hover:text-[#2563EB] text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 flex-shrink-0"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>

              <button
                onClick={handleShare}
                className="w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
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