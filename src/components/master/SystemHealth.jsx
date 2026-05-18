import EmailHealthCard from './EmailHealthCard';
import EmailLogsTable from './EmailLogsTable';

export default function SystemHealth() {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-[var(--shadow-sm)]">
      <div className="mb-5">
        <h2 className="font-bold text-foreground text-lg tracking-tight">Saúde do sistema</h2>
        <p className="text-xs text-muted-foreground mt-0.5 font-medium">Diagnóstico de infraestrutura — provedor de e-mail</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <EmailHealthCard />
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-5 flex items-center justify-center text-xs text-muted-foreground font-medium min-h-[180px]">
          WhatsApp / SMS health checks (em breve)
        </div>
      </div>
      <EmailLogsTable />
    </div>
  );
}