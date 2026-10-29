import EmailHealthCard from './EmailHealthCard';
import EmailLogsTable from './EmailLogsTable';
import { ShieldCheck, Globe, Server } from 'lucide-react';

export default function SystemHealth() {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-[var(--shadow-sm)]">
      <div className="mb-5">
        <h2 className="font-bold text-foreground text-lg tracking-tight">Saúde do sistema</h2>
        <p className="text-xs text-muted-foreground mt-0.5 font-medium">
          Diagnóstico de infraestrutura — provedor de e-mail transacional (ocorte.app)
        </p>
      </div>
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <EmailHealthCard />
        <div className="rounded-2xl border border-border bg-muted/20 p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Infraestrutura de Mensageria & Domínio
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Os convites de acesso, redefinições de senha e alertas transacionais são autenticados via Supabase Auth SMTP / Resend sob o domínio oficial.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-semibold">
                <Globe className="w-3.5 h-3.5 text-[#2563EB]" /> Domínio Remetente
              </div>
              <div className="text-xs font-bold text-foreground mt-1">ocorte.app</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-semibold">
                <Server className="w-3.5 h-3.5 text-emerald-500" /> Canal WhatsApp
              </div>
              <div className="text-xs font-bold text-emerald-500 mt-1">Link Direto wa.me</div>
            </div>
          </div>
        </div>
      </div>
      <EmailLogsTable />
    </div>
  );
}