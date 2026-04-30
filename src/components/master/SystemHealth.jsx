import EmailHealthCard from './EmailHealthCard';
import EmailLogsTable from './EmailLogsTable';

export default function SystemHealth() {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 sm:p-6 shadow-[var(--shadow-sm)]">
      <div className="mb-5">
        <h2 className="font-bold text-[#111827] text-lg tracking-tight">Saúde do sistema</h2>
        <p className="text-xs text-[#6B7280] mt-0.5 font-medium">Diagnóstico de infraestrutura — provedor de e-mail</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <EmailHealthCard />
        <div className="rounded-2xl border border-dashed border-black/10 bg-[#FAFBFC] p-5 flex items-center justify-center text-xs text-[#6B7280] font-medium min-h-[180px]">
          WhatsApp / SMS health checks (em breve)
        </div>
      </div>
      <EmailLogsTable />
    </div>
  );
}