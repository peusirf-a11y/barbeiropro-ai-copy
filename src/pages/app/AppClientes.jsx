import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useTeamRole } from '@/lib/useTeamRole';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import { shouldScopeCustomersByUnit } from '@/lib/customerUnitMode';
import { useState } from 'react';
import { Search, Plus, X, Users, Pencil, Trash2, Phone, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import StandardModal from '@/components/ui/standard-modal';
import FilterSelect from '@/components/ui/filter-select';
import CustomerSubscriptionPanel from '@/components/clientes/CustomerSubscriptionPanel';
import CustomerCampaignsHistory from '@/components/clientes/CustomerCampaignsHistory';
import CustomerPlanRecommendation from '@/components/clientes/CustomerPlanRecommendation';
import OfferPlanModal from '@/components/clientes/OfferPlanModal';
import CustomerTypeBadge from '@/components/agenda/CustomerTypeBadge';
import VipCandidatesCard from '@/components/clientes/VipCandidatesCard';
import { Sparkles } from 'lucide-react';

const emptyForm = { name: '', phone: '', email: '', notes: '', status: 'active', tags: [] };

export default function AppClientes() {
  const { company, companyId, isLoading: loadingCompany } = useCompany();
  const { activeUnitId } = useActiveUnit();
  const { data: teamRole } = useTeamRole();
  const isBarbeiro = teamRole?.role === 'barbeiro';
  // Quando true, lista e novo cliente ficam restritos à unidade ativa
  const scopeByUnit = shouldScopeCustomersByUnit(company, activeUnitId);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [offeringTo, setOfferingTo] = useState(null); // cliente para qual estamos oferecendo plano
  const queryClient = useQueryClient();

  const { data: customersRaw = [], isLoading } = useQuery({
    queryKey: ['customers', companyId, activeUnitId],
    queryFn: () => base44.entities.Customer.filter({ company_id: companyId }, '-created_date', 500),
    enabled: !!companyId,
  });
  // Em modo "clientes por unidade", filtra pela unidade ativa (registros sem unit_id são considerados legados/compartilhados e continuam visíveis)
  const customers = scopeByUnit
    ? customersRaw.filter(c => !c.unit_id || c.unit_id === activeUnitId)
    : customersRaw;

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', companyId, activeUnitId],
    queryFn: () => base44.entities.Appointment.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  // Map customer_id => assinatura ativa, para mostrar badge na lista
  const { data: activeSubs = [] } = useQuery({
    queryKey: ['customer-subscriptions', companyId, activeUnitId],
    queryFn: () => base44.entities.CustomerSubscription.filter({ company_id: companyId, status: 'active' }),
    enabled: !!companyId,
  });
  const subByCustomer = activeSubs.reduce((acc, s) => { acc[s.customer_id] = s; return acc; }, {});

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create({
      ...data,
      company_id: companyId,
      // Só grava unit_id quando estamos no modo "clientes por unidade"
      unit_id: scopeByUnit ? activeUnitId : undefined,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); closeForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Customer.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', notes: c.notes || '', status: c.status || 'active', tags: c.tags || [] });
    setShowForm(true);
  };

  const handleSave = () => {
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const getCustomerStats = (customerId) => {
    const customerAppts = appointments.filter(a => a.customer_id === customerId && a.status === 'concluido');
    return customerAppts.length;
  };

  const filtered = customers.filter(c => {
    const matchSearch = (c.name || '').toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search);
    let matchFilter = true;
    if (filter === 'vip') matchFilter = c.status === 'vip';
    else if (['primeira_visita', 'fiel', 'em_risco', 'inativo', 'perdido'].includes(filter)) {
      matchFilter = c.lifecycle_status === filter;
    }
    return matchSearch && matchFilter;
  });

  // Contadores por categoria — exibidos nos chips de filtro
  const counts = customers.reduce((acc, c) => {
    if (c.status === 'vip') acc.vip++;
    if (c.lifecycle_status) acc[c.lifecycle_status] = (acc[c.lifecycle_status] || 0) + 1;
    return acc;
  }, { vip: 0, primeira_visita: 0, fiel: 0, em_risco: 0, inativo: 0, perdido: 0 });

  if (loadingCompany || isLoading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <AppPageHeader
          title="Clientes"
          subtitle={`${customers.length} clientes cadastrados`}
          icon={Users}
        >
          {!isBarbeiro && (
            <PrimaryButton onClick={() => setShowForm(true)}>Novo cliente</PrimaryButton>
          )}
        </AppPageHeader>

        {!isBarbeiro && companyId && <VipCandidatesCard companyId={companyId} />}

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Buscar por nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-black/10 rounded-xl text-sm focus:outline-none shadow-[var(--shadow-xs)]" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { v: 'all', l: 'Todos', count: customers.length },
              { v: 'vip', l: '👑 VIP', count: counts.vip },
              { v: 'primeira_visita', l: '✦ 1ª visita', count: counts.primeira_visita },
              { v: 'fiel', l: '✓ Fiéis', count: counts.fiel },
              { v: 'em_risco', l: '⚠️ Em risco', count: counts.em_risco },
              { v: 'inativo', l: '💤 Inativos', count: counts.inativo },
              { v: 'perdido', l: '🚫 Perdidos', count: counts.perdido },
            ].map(f => (
              <button key={f.v} onClick={() => setFilter(f.v)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${filter === f.v ? 'bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]' : 'bg-white border border-black/10 text-gray-600 hover:border-[#2563EB] hover:text-[#2563EB]'}`}>
                <span>{f.l}</span>
                {f.count > 0 && (
                  <span className={`text-[10px] font-bold ${filter === f.v ? 'text-white/80' : 'text-gray-400'}`}>{f.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
          {filtered.length > 0 ? (
           <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b border-black/5 bg-[#FAFBFC]">
                  <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Telefone</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Atendimentos</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Última Visita</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-black/5 hover:bg-[#FAFBFC] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-[#2563EB] to-[#60A5FA] rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm">
                          {(c.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-[#111827] flex items-center gap-1.5 flex-wrap">
                            {c.name}
                            {subByCustomer[c.id] && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-blue-100 text-[#2563EB] px-1.5 py-0.5 rounded">
                                <Package className="w-2.5 h-2.5" /> Assinante
                              </span>
                            )}
                          </div>
                          {c.email && <div className="text-xs text-[#6B7280]">{c.email}</div>}
                          {!subByCustomer[c.id] && (
                            <div className="mt-1">
                              <CustomerPlanRecommendation companyId={companyId} customerId={c.id} />
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-sm text-[#6B7280]">
                        <Phone className="w-3 h-3" />{c.phone || '–'}
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell text-sm font-semibold text-[#111827]">
                      {getCustomerStats(c.id)}x
                    </td>
                    <td className="p-4 hidden lg:table-cell text-sm text-[#6B7280]">
                      {c.last_appointment_at ? format(new Date(c.last_appointment_at), "d MMM yyyy", { locale: ptBR }) : '–'}
                    </td>
                    <td className="p-4">
                      <CustomerTypeBadge customer={c} showVisits={false} />
                    </td>
                    <td className="p-4">
                      {!isBarbeiro ? (
                        <div className="flex items-center gap-1">
                          {!subByCustomer[c.id] && (
                            <button
                              onClick={() => setOfferingTo(c)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2563EB] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg"
                              title="Oferecer plano de assinatura"
                            >
                              <Sparkles className="w-3 h-3" /> Oferecer plano
                            </button>
                          )}
                          <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-gray-400" /></button>
                          <button onClick={() => { if (confirm('Excluir cliente?')) deleteMutation.mutate(c.id); }} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
           </div>
          ) : (
            <div className="p-16 text-center text-[#6B7280]">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? 'Nenhum cliente encontrado para esta busca' : 'Nenhum cliente cadastrado ainda'}</p>
              {!search && <button onClick={() => setShowForm(true)} className="text-sm font-semibold text-[#2563EB] mt-2 hover:underline">Cadastrar primeiro cliente</button>}
            </div>
          )}
        </div>

        {offeringTo && (
          <OfferPlanModal
            companyId={companyId}
            customer={offeringTo}
            onClose={() => setOfferingTo(null)}
            onActivated={() => queryClient.invalidateQueries({ queryKey: ['customer-subscriptions', companyId] })}
          />
        )}

        <StandardModal
          open={showForm}
          onClose={closeForm}
          title={editing ? 'Editar Cliente' : 'Novo Cliente'}
          footer={
            <>
              <button onClick={closeForm} className="flex-1 min-h-[48px] px-4 border border-black/10 rounded-xl text-sm font-medium text-[#111827] hover:bg-gray-50 active:bg-gray-100">Cancelar</button>
              <button onClick={handleSave} disabled={!form.name || !form.phone || createMutation.isPending || updateMutation.isPending}
                className="flex-1 min-h-[48px] px-4 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] active:scale-[0.98] disabled:opacity-50 transition-all">
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Nome *</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Telefone *</label>
                <input type="text" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">E-mail</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Status</label>
              <FilterSelect
                value={form.status}
                onChange={(v) => setForm(p => ({ ...p, status: v }))}
                className="w-full"
              >
                <option value="active">Ativo</option>
                <option value="vip">VIP</option>
                <option value="inactive">Inativo</option>
              </FilterSelect>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Observações</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                placeholder="Preferências, alergias, observações..."
                className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 resize-none" />
            </div>

            {editing && (
              <div className="mt-5 pt-5 border-t border-black/5 space-y-4">
                <CustomerSubscriptionPanel customer={editing} companyId={companyId} />
                <CustomerCampaignsHistory customer={editing} />
              </div>
            )}
          </div>
        </StandardModal>
      </div>
    </AppLayout>
  );
}