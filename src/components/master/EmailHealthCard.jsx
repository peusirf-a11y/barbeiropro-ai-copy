import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Mail, Send, CheckCircle, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const HEALTH_CONFIG = {
  healthy:  { label: 'Provedor Online',     color: 'text-emerald-500',  bg: 'bg-emerald-500/10',  border: 'border-emerald-500/30',  dot: 'bg-emerald-500',  icon: CheckCircle },
  degraded: { label: 'Falhas detectadas',   color: 'text-amber-500',    bg: 'bg-amber-500/10',    border: 'border-amber-500/30',    dot: 'bg-amber-500',    icon: AlertTriangle },
  down:     { label: 'Provedor com erro',   color: 'text-red-500',      bg: 'bg-red-500/10',      border: 'border-red-500/30',      dot: 'bg-red-500',      icon: AlertCircle },
  unknown:  { label: 'Sem envios recentes', color: 'text-muted-foreground', bg: 'bg-muted/30',    border: 'border-border',          dot: 'bg-muted-foreground', icon: Mail },
};

export default function EmailHealthCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['email-health'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEmailHealth', {});
      return res?.data || res;
    },
    refetchInterval: 30000,
  });

  const health = data?.health || 'unknown';
  const cfg = HEALTH_CONFIG[health];
  const Icon = cfg.icon;

  const handleSendTest = async () => {
    setSending(true);
    try {
      const res = await base44.functions.invoke('sendDiagnosticEmail', {});
      const result = res?.data || res;
      if (result?.ok) {
        toast({
          title: 'E-mail de teste enviado!',
          description: 'Verifique sua caixa de entrada (e o spam).',
        });
      } else {
        toast({
          title: 'Falha no envio',
          description: result?.error || 'Erro desconhecido. Veja os logs abaixo.',
          variant: 'destructive',
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['email-health'] });
      await queryClient.invalidateQueries({ queryKey: ['email-logs'] });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-5`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-card border ${cfg.border} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${cfg.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
              <h3 className={`font-bold text-sm ${cfg.color}`}>{cfg.label}</h3>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Saúde do envio de e-mails (provedor: base44_core)</div>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 hover:bg-muted rounded-lg text-muted-foreground"
          title="Atualizar"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Enviados" value={data?.stats?.sent ?? '—'} color="text-emerald-500" />
        <Stat label="Falhas"   value={data?.stats?.failed ?? '—'} color="text-red-500" />
        <Stat label="Total"    value={data?.stats?.total ?? '—'} color="text-foreground" />
      </div>

      {data?.last_error && (
        <div className="bg-background rounded-lg border border-red-500/30 p-3 mb-4 text-xs">
          <div className="text-red-500 font-semibold mb-1">Último erro registrado:</div>
          <div className="text-foreground/80 font-mono break-all">{data.last_error}</div>
        </div>
      )}

      <button
        onClick={handleSendTest}
        disabled={sending}
        className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors"
      >
        {sending ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /> Enviando…</>
        ) : (
          <><Send className="w-4 h-4" /> Enviar e-mail de teste</>
        )}
      </button>

      <div className="mt-3 bg-card/70 border border-border rounded-lg p-3 text-[11px] text-muted-foreground leading-relaxed">
        <strong className="text-foreground/80">Não recebeu?</strong> Status <code className="bg-muted px-1 rounded">sent</code> significa que o provedor aceitou a mensagem.
        Verifique a pasta <strong>Spam</strong> e a aba <strong>Promoções</strong> do Gmail — remetentes do <code className="bg-muted px-1 rounded">base44.app</code> caem lá no primeiro contato.
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="bg-card rounded-lg border border-border p-3">
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}