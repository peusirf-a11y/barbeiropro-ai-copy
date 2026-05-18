// Card que mostra clientes elegíveis automaticamente a VIP.
// Sugestão apenas — dono aprova clicando em "Promover a VIP" ou dispensa.
// Some quando não há candidatos.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Crown, Sparkles, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function VipCandidatesCard({ companyId }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['vip-candidates', companyId],
    queryFn: () => base44.functions.invoke('evaluateVipCandidates', { company_id: companyId }).then(r => r.data),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5min
  });

  const promoteMutation = useMutation({
    mutationFn: (customerId) => base44.entities.Customer.update(customerId, { status: 'vip' }),
    onSuccess: (_, customerId) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['vip-candidates'] });
      toast({ title: '👑 Cliente promovido a VIP!', description: 'O selo VIP já aparece no perfil.' });
    },
    onError: (err) => toast({ title: 'Erro ao promover', description: err.message, variant: 'destructive' }),
  });

  const dismissMutation = useMutation({
    mutationFn: (customerId) => base44.entities.Customer.update(customerId, { vip_dismissed_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vip-candidates'] });
      toast({ title: 'Sugestão dispensada', description: 'Não vamos sugerir esse cliente nos próximos 60 dias.' });
    },
  });

  if (isLoading || !data?.candidates?.length) return null;

  const candidates = data.candidates;
  const top = expanded ? candidates : candidates.slice(0, 0);

  return (
    <div className="relative bg-gradient-to-br from-amber-500/10 via-white/[0.025] to-amber-500/5 border border-amber-400/25 rounded-2xl p-5 mb-5 backdrop-blur-md animate-fade-in overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-transparent pointer-events-none" />
      <button
        onClick={() => setExpanded(v => !v)}
        className="relative w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center ring-1 ring-amber-300/50 flex-shrink-0">
            <span className="absolute inset-0 rounded-xl bg-amber-400/40 blur-md opacity-70" aria-hidden="true" />
            <Crown className="relative w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white">Clientes elegíveis para VIP</h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-amber-400/20 text-amber-100 px-2 py-0.5 rounded-full border border-amber-400/40">
                <Sparkles className="w-3 h-3" /> Sugestão
              </span>
            </div>
            <p className="text-xs text-white/55 mt-0.5">
              {candidates.length} cliente{candidates.length > 1 ? 's' : ''} com perfil VIP — você decide quem promove.
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-white/50" /> : <ChevronDown className="w-5 h-5 text-white/50" />}
      </button>

      {expanded && (
        <div className="relative mt-4 space-y-2.5">
          {top.map((cand) => {
            const isPromoting = promoteMutation.isPending && promoteMutation.variables === cand.customer.id;
            const isDismissing = dismissMutation.isPending && dismissMutation.variables === cand.customer.id;
            return (
              <div
                key={cand.customer.id}
                className="bg-white/[0.04] border border-amber-400/20 rounded-xl p-3 flex items-center gap-3 flex-wrap sm:flex-nowrap backdrop-blur-sm"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold flex-shrink-0 ring-1 ring-amber-300/40">
                  {(cand.customer.name || '?')[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-white truncate">{cand.customer.name}</span>
                    <span className="text-[10px] font-bold bg-amber-400/20 text-amber-100 border border-amber-400/40 px-1.5 py-0.5 rounded">
                      Score {cand.score}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/60 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                    {cand.reasons.map((r, i) => (
                      <span key={i} className="inline-flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-amber-400" />{r}
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] text-white/40 mt-1">
                    Receita gerada: R$ {cand.metrics.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    {' · '}
                    Ticket médio: R$ {cand.metrics.customerAvg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto sm:ml-0 flex-shrink-0">
                  <button
                    onClick={() => dismissMutation.mutate(cand.customer.id)}
                    disabled={isPromoting || isDismissing}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-50 transition-colors"
                    title="Dispensar sugestão por 60 dias"
                  >
                    <X className="w-3.5 h-3.5" /> Dispensar
                  </button>
                  <button
                    onClick={() => promoteMutation.mutate(cand.customer.id)}
                    disabled={isPromoting || isDismissing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-br from-amber-500 to-amber-600 hover:brightness-110 disabled:opacity-50 shadow-[0_8px_24px_rgba(217,119,6,0.35)] ring-1 ring-amber-300/40"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {isPromoting ? 'Promovendo...' : 'Promover a VIP'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}