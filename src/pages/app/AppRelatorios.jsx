import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function AppRelatorios() {
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => base44.entities.Appointment.list(),
  });

  const { data: financial = [] } = useQuery({
    queryKey: ['financial'],
    queryFn: () => base44.entities.FinancialEntry.list(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const totalRevenue = financial.filter(f => f.type === 'entrada').reduce((s, f) => s + f.amount, 0);
  const concludedAppts = appointments.filter(a => a.status === 'concluido');
  const avgTicket = concludedAppts.length > 0 ? totalRevenue / concludedAppts.length : 0;

  // Service stats
  const serviceMap = {};
  appointments.forEach(a => {
    if (!a.service_name) return;
    if (!serviceMap[a.service_name]) serviceMap[a.service_name] = 0;
    serviceMap[a.service_name]++;
  });
  const serviceData = Object.entries(serviceMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 6);

  // Professional stats
  const proMap = {};
  appointments.forEach(a => {
    if (!a.professional_name) return;
    const n = a.professional_name.split(' ')[0];
    if (!proMap[n]) proMap[n] = 0;
    proMap[n]++;
  });
  const proData = Object.entries(proMap).map(([name, atendimentos]) => ({ name, atendimentos })).sort((a, b) => b.atendimentos - a.atendimentos);

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#1B1C1E]">Relatórios</h1>
          <p className="text-gray-500 text-sm mt-1">Visão geral da operação</p>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total agendamentos', value: appointments.length },
            { label: 'Receita registrada', value: `R$${totalRevenue.toFixed(0)}` },
            { label: 'Ticket médio', value: `R$${avgTicket.toFixed(0)}` },
            { label: 'Total clientes', value: customers.length },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-black/8 p-5">
              <div className="text-2xl font-black text-[#1B1C1E]">{s.value}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-black/8 p-6">
            <h2 className="font-bold text-[#1B1C1E] mb-5">Serviços mais agendados</h2>
            {serviceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={serviceData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#1B3A4B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">Sem dados suficientes</div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-black/8 p-6">
            <h2 className="font-bold text-[#1B1C1E] mb-5">Profissionais mais ativos</h2>
            {proData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={proData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="atendimentos" fill="#2D5C73" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">Sem dados suficientes</div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}