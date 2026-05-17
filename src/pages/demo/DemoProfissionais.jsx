/**
 * DemoProfissionais — Cards de profissionais idênticos ao AppProfissionais.
 */
import DemoLayout from '@/components/layout/DemoLayout';
import { demoProfessionals, demoAppointments, demoFinancial } from '@/lib/demoData';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth } from 'date-fns';

export default function DemoProfissionais() {
  const handleDemoAction = () =>
    toast.info('Ação disponível na conta real. Crie sua conta grátis!', { duration: 3000 });

  const now = new Date();
  const monthStart = startOfMonth(now);

  return (
    <DemoLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#1B1C1E]">Profissionais</h1>
            <p className="text-gray-500 text-sm mt-1">{demoProfessionals.length} profissionais cadastrados</p>
          </div>
          <button
            onClick={handleDemoAction}
            className="bg-[#2563EB] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1d4ed8] transition-colors flex items-center gap-2 shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
          >
            <Plus className="w-4 h-4" />Novo profissional
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {demoProfessionals.map(pro => {
            const proAppts = demoAppointments.filter(a => a.professional_id === pro.id);
            const concluded = proAppts.filter(a => a.status === 'concluido').length;
            const todayAppts = proAppts.filter(a => new Date(a.scheduled_at).toDateString() === now.toDateString()).length;
            const monthAppts = proAppts.filter(a => a.status === 'concluido' && new Date(a.scheduled_at) >= monthStart);
            const monthRevenue = demoFinancial
              .filter(f => f.type === 'entrada' && f.origin === 'agendamento' && new Date(f.date) >= monthStart)
              .filter(f => {
                const appt = demoAppointments.find(a => a.id === f.reference_appointment_id || a.professional_id === pro.id);
                return !!appt;
              }).reduce((s, f) => s + f.amount, 0);

            return (
              <div
                key={pro.id}
                className="bg-white rounded-2xl border border-black/5 p-6 hover:shadow-md transition-all group cursor-pointer shadow-[var(--shadow-sm)]"
                onClick={handleDemoAction}
              >
                <div className="flex items-start gap-4 mb-5">
                  <img src={pro.photo_url} alt={pro.name} className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[#1B1C1E] truncate">{pro.name}</h3>
                      <button
                        onClick={e => { e.stopPropagation(); handleDemoAction(); }}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all ml-2 flex-shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-500">{pro.specialty}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className={`w-2 h-2 rounded-full ${pro.active ? 'bg-green-400' : 'bg-gray-300'}`} />
                      <span className="text-xs text-gray-400">{pro.active ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#F8F7F3] rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-[#1B1C1E]">{todayAppts}</div>
                    <div className="text-xs text-gray-400">hoje</div>
                  </div>
                  <div className="bg-[#F8F7F3] rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-[#1B1C1E]">{concluded}</div>
                    <div className="text-xs text-gray-400">concluídos</div>
                  </div>
                  <div className="bg-[#F8F7F3] rounded-xl p-3 text-center">
                    <div className="text-sm font-black text-[#2563EB]">{pro.commission_value}%</div>
                    <div className="text-xs text-gray-400">comissão</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DemoLayout>
  );
}