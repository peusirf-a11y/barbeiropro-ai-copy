import EmailHealthCard from './EmailHealthCard';
import EmailLogsTable from './EmailLogsTable';

export default function SystemHealth() {
  return (
    <div className="bg-white rounded-2xl border border-black/8 p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="font-bold text-[#1B1C1E] text-lg">Saúde do sistema</h2>
        <p className="text-xs text-gray-500 mt-0.5">Diagnóstico de infraestrutura — provedor de e-mail</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <EmailHealthCard />
        <div className="rounded-2xl border border-dashed border-black/10 p-5 flex items-center justify-center text-xs text-gray-400 min-h-[180px]">
          WhatsApp / SMS health checks (em breve)
        </div>
      </div>
      <EmailLogsTable />
    </div>
  );
}