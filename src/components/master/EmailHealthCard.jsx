import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabaseClient';
import { Mail, Send, CheckCircle, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const HEALTH_CONFIG = {
  healthy:        { label: 'Provedor Online',         color: 'text-emerald-500',  bg: 'bg-emerald-500/10',  border: 'border-emerald-500/30',  dot: 'bg-emerald-500',  icon: CheckCircle },
  degraded:       { label: 'Falhas detectadas',       color: 'text-amber-500',    bg: 'bg-amber-500/10',    border: 'border-amber-500/30',    dot: 'bg-amber-500',    icon: AlertTriangle },
  down:           { label: 'Provedor com erro',       color: 'text-red-500',      bg: 'bg-red-500/10',      border: 'border-red-500/30',      dot: 'bg-red-500',      icon: AlertCircle },
  not_configured: { label: 'Não configurado',         color: 'text-muted-foreground', bg: 'bg-muted/30',    border: 'border-border',          dot: 'bg-muted-foreground', icon: Mail },
  unknown:        { label: 'Sem envios recentes',     color: 'text-muted-foreground', bg: 'bg-muted/30',    border: 'border-border',          dot: 'bg-muted-foreground', icon: Mail },
};

export default function EmailHealthCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');

  useEffect(() => {
    let active = true;
    async function resolveDefaultAdminEmail() {
      try {
        const rawUser = localStorage.getItem('admin_logged_user');
        if (rawUser) {
          const parsed = JSON.parse(rawUser);
          if (parsed?.email && active) {
            setRecipientEmail(parsed.email);
            return;
          }
        }
      } catch (_) {}

      try {
        if (supabase) {
          const { data: sessionData } = await supabase.auth.getSession();
          const email = sessionData?.session?.user?.email;
          if (email && active) {
            setRecipientEmail(email);
            return;
          }
        }
      } catch (_) {}

      if (active) {
        setRecipientEmail('pedrojesantos@hotmail.com');
      }
    }
    resolveDefaultAdminEmail();
    return () => {
      active = false;
    };
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['email-health'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEmailHealth', {});
      return res?.data || res;
    },
    refetchInterval: 30000,
  });

  const health = data?.health || 'healthy';
  const cfg = HEALTH_CONFIG[health] || HEALTH_CONFIG.healthy;
  const Icon = cfg.icon;
  const providerLabel = data?.provider || 'Supabase Auth SMTP / Resend (ocorte.app)';

  const handleSendTest = async () => {
    const targetEmail = String(recipientEmail || '').trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      toast({
        title: 'E-mail inválido',
        description: 'Informe um endereço de e-mail válido para receber o disparo de diagnóstico.',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      const res = await base44.functions.invoke('sendDiagnosticEmail', {
        recipient: targetEmail,
      });
      const result = res?.data || res;
      if (result?.ok || result?.success) {
        toast({
          title: 'E-mail de teste enviado!',
          description: `Disparo enviado para ${targetEmail}. Verifique a caixa de entrada e a pasta Spam.`,
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
            <div className="text-xs text-muted-foreground mt-0.5">
              Saúde do envio de e-mails (provedor: {providerLabel})
            </div>
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
        <Stat label="Enviados" value={data?.stats?.sent ?? 0} color="text-emerald-500" />
        <Stat label="Falhas"   value={data?.stats?.failed ?? 0} color="text-red-500" />
        <Stat label="Total"    value={data?.stats?.total ?? 0} color="text-foreground" />
      </div>

      {data?.last_error && (
        <div className="bg-background rounded-lg border border-red-500/30 p-3 mb-4 text-xs">
          <div className="text-red-500 font-semibold mb-1">Último erro registrado:</div>
          <div className="text-foreground/80 font-mono break-all">{data.last_error}</div>
        </div>
      )}

      <div className="space-y-2.5">
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
            Destinatário para teste transacional
          </label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="admin@ocorte.app"
            disabled={sending}
            className="w-full px-3 py-2 rounded-xl border border-border bg-card text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
          />
        </div>

        <button
          onClick={handleSendTest}
          disabled={sending}
          className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors cursor-pointer"
        >
          {sending ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Enviando via Supabase Auth SMTP…</>
          ) : (
            <><Send className="w-4 h-4" /> Enviar e-mail de teste</>
          )}
        </button>
      </div>

      <div className="mt-3 bg-card/70 border border-border rounded-lg p-3 text-[11px] text-muted-foreground leading-relaxed">
        <strong className="text-foreground/80">Não recebeu?</strong> Status <code className="bg-muted px-1 rounded">sent</code> significa que o provedor SMTP aceitou a mensagem.
        Verifique a pasta <strong>Spam</strong> e a aba <strong>Promoções</strong> do seu provedor de e-mail — disparos transacionais do domínio <code className="bg-muted px-1 rounded">ocorte.app</code> podem ser filtrados no primeiro contato.
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