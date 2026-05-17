/**
 * DemoClientes — Usa os mesmos componentes visuais do AppClientes.
 * Busca, filtros, tabela e status idênticos ao app real.
 */
import DemoLayout from '@/components/layout/DemoLayout';
import { demoCustomers } from '@/lib/demoData';
import { Search, Star, Plus } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const statusBadge = {
  active: { label: 'Ativo',   color: 'bg-green-100 text-green-700' },
  inactive:{ label: 'Inativo', color: 'bg-red-100 text-red-600' },
  vip:    { label: 'VIP',     color: 'bg-yellow-100 text-yellow-700' },
};

const lifecycleBadge = {
  primeira_visita: { label: '1ª Visita',  color: 'bg-blue-100 text-blue-700' },
  fiel:            { label: 'Fiel',        color: 'bg-green-100 text-green-700' },
  em_risco:        { label: 'Em risco',    color: 'bg-orange-100 text-orange-700' },
  inativo:         { label: 'Inativo',     color: 'bg-gray-100 text-gray-600' },
  perdido:         { label: 'Perdido',     color: 'bg-red-100 text-red-600' },
};

export default function DemoClientes() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const handleDemoAction = () =>
    toast.info('Ação disponível na conta real. Crie sua conta grátis!', { duration: 3000 });

  const filtered = demoCustomers.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || c.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <DemoLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#1B1C1E]">Clientes</h1>
            <p className="text-gray-500 text-sm mt-1">{demoCustomers.length} clientes cadastrados</p>
          </div>
          <button
            onClick={handleDemoAction}
            className="bg-[#2563EB] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1d4ed8] transition-colors flex items-center gap-2 shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
          >
            <Plus className="w-4 h-4" />Novo cliente
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-black/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { value: 'all', label: 'Todos' },
              { value: 'active', label: 'Ativos' },
              { value: 'vip', label: 'VIP' },
              { value: 'inactive', label: 'Inativos' },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                  filter === f.value
                    ? 'bg-[#2563EB] text-white border-transparent'
                    : 'bg-white border-black/10 text-gray-600 hover:border-[#2563EB]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-black/5 bg-[#FAFBFC]">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Cliente</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Telefone</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Visitas</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Serviço Favorito</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Última Visita</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Ciclo de Vida</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={c.id}
                    className="border-b border-black/5 hover:bg-[#FAFBFC] transition-colors cursor-pointer"
                    onClick={handleDemoAction}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#2563EB]/10 rounded-full flex items-center justify-center text-xs font-bold text-[#2563EB] flex-shrink-0">
                          {c.name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-[#1B1C1E]">{c.name}</div>
                          {c.status === 'vip' && (
                            <div className="flex items-center gap-1 text-xs text-yellow-600">
                              <Star className="w-3 h-3 fill-yellow-500" />VIP
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.phone}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#1B1C1E]">{c.total_appointments}x</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.favorite_service || '–'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {c.last_completed_at ? format(new Date(c.last_completed_at), "d MMM yyyy", { locale: ptBR }) : '–'}
                    </td>
                    <td className="px-4 py-3">
                      {c.lifecycle_status && lifecycleBadge[c.lifecycle_status] ? (
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${lifecycleBadge[c.lifecycle_status].color}`}>
                          {lifecycleBadge[c.lifecycle_status].label}
                        </span>
                      ) : '–'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusBadge[c.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                        {statusBadge[c.status]?.label || c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">Nenhum cliente encontrado.</div>
          )}
        </div>
      </div>
    </DemoLayout>
  );
}