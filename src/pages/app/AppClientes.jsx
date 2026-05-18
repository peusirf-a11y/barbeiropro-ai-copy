import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useTeamRole } from '@/lib/useTeamRole';
import { useActiveUnit } from '@/hooks/useActiveUnit';
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
import LifecycleStatusCard from '@/components/clientes/LifecycleStatusCard';
import OfferPlanModal from '@/components/clientes/OfferPlanModal';
import CustomerTypeBadge from '@/components/agenda/CustomerTypeBadge';
import VipCandidatesCard from '@/components/clientes/VipCandidatesCard';
import { Sparkles } from 'lucide-react';
import WhatsAppButton from '@/components/whatsapp/WhatsAppButton';
import { buildReactivationMessage } from '@/lib/whatsappCompose';
import { safeArray } from '@/lib/safeArray';
import { useImpersonationPatch } from '@/hooks/useImpersonationToken';
import { buildTenantQueryKey } from '@/lib/query/buildTenantQueryKey';

const emptyForm = { name: '', phone: '', email: '', notes: '', status: 'active', tags: [] };

export default function AppClientes() {
  const { company, companyId, isLoading: loadingCompany } = useCompany();
  const { activeUnitId } = useActiveUnit();
  const { data: teamRole } = useTeamRole();
  const isBarbeiro = teamRole?.role === 'barbeiro';
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [offeringTo, setOfferingTo] = useState(null); // cliente para qual estamos oferecendo plano
  const queryClient = useQueryClient();
  const impPatch = useImpersonationPatch();

  // BFF: lista vem do servidor com tenant + unit scoping aplicados.
  // O frontend não toca mais em `Customer.filter` — reduz superfície de leak
  // e remove a duplicação de regra `shouldScopeCustomersByUnit` no cliente.
  const { data: customersData, isLoading } = useQuery({
    queryKey: buildTenantQueryKey({ entity: 'customers', companyId, filters: { activeUnitId } }),
    queryFn: async () => {
      const res = await base44.functions.invoke('listCustomers', {
        active_unit_id: activeUnitId,
        limit: 500,
        ...impPatch,
      });
      return res?.data || { customers: [] };
    },
    enabled: !!companyId,
  });
  const customers = safeArray(customersData?.customers ?? customersData);

  const { data: appointmentsRaw } = useQuery({
    queryKey: buildTenantQueryKey({ entity: 'appointments', companyId, filters: { activeUnitId } }),
    queryFn: () => base44.entities.Appointment.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const appointments = safeArray(appointmentsRaw);

  // Map customer_id => assinatura ativa, para mostrar badge na lista (BFF Fase 4)
  const { data: activeSubs = [] } = useQuery({
    queryKey: buildTenantQueryKey({ entity: 'subscriptions', companyId, filters: { status: 'active', activeUnitId } }),
    queryFn: async () => {
      const res = await base44.functions.invoke('listSubscriptions', {
        active_unit_id: activeUnitId,
        status: 'active',
        ...impPatch,
      });
      return safeArray(res?.data?.subscriptions ?? res?.data);
    },
    enabled: !!companyId,
  });
  const subByCustomer = activeSubs.reduce((acc, s) => { acc[s.customer_id] = s; return acc; }, {});

  // BFF Fase 2: mutations vão pelo backend (mutateCustomer).
  // O servidor decide company_id (do caller) e unit_id (auto-stamp quando aplicável).
  // O frontend NÃO precisa mais conhecer shouldScopeCustomersByUnit.
  const invokeMutation = async (payload) => {
    const res = await base44.functions.invoke('mutateCustomer', { ...payload, ...impPatch });
    if (res?.data?.error) throw new Error(res.data.error);
    return res?.data;
  };

  const createMutation = useMutation({
    mutationFn: (data) => invokeMutation({ action: 'create', data, active_unit_id: activeUnitId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'customers', companyId }) }); closeForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => invokeMutation({ action: 'update', id, data }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'customers', companyId }) }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => invokeMutation({ action: 'delete', id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'customers', companyId }) }),
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
          <div className="w-8 h-8 border-4 border-[#60A5FA]/20 border-t-[#60A5FA] rounded-full animate-spin" />
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
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Buscar por nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/40 backdrop-blur-sm focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { v: 'all', l: 'Todos', count: customers.length },
              { v: 'vip', l: '👑 VIP', count: counts.vip },
              { v: 'primeira_visita', l: '✦ Visitante', count: counts.primeira_visita },
              { v: 'fiel', l: '✓ Fiéis', count: counts.fiel },
              { v: 'em_risco', l: '⚠️ Em risco', count: counts.em_risco },
              { v: 'inativo', l: '💤 Inativos', count: counts.inativo },
              { v: 'perdido', l: '🚫 Perdidos', count: counts.perdido },
            ].map(f => (
              <button key={f.v} onClick={() => setFilter(f.v)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 backdrop-blur-sm ${filter === f.v ? 'bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white ring-1 ring-white/15 shadow-[0_8px_24px_rgba(37,99,235,0.4)]' : 'bg-white/[0.03] border border-white/10 text-white/70 hover:bg-white/[0.06] hover:border-[#60A5FA]/40 hover:text-white'}`}>
                <span>{f.l}</span>
                {f.count > 0 && (
                  <span className={`text-[10px] font-bold ${filter === f.v ? 'text-white/85' : 'text-white/40'}`}>{f.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden">
          {filtered.length > 0 ? (
           <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.015]">
                  <th className="text-left p-4 text-xs font-semibold text-white/55 uppercase tracking-wide">Cliente</th>
                  <th className="text-left p-4 text-xs font-semibold text-white/55 uppercase tracking-wide hidden md:table-cell">Telefone</th>
                  <th className="text-left p-4 text-xs font-semibold text-white/55 uppercase tracking-wide hidden md:table-cell">Atendimentos</th>
                  <th className="text-left p-4 text-xs font-semibold text-white/55 uppercase tracking-wide hidden lg:table-cell">Última Visita</th>
                  <th className="text-left p-4 text-xs font-semibold text-white/55 uppercase tracking-wide">Status</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-9 h-9 bg-gradient-to-br from-[#1D4ED8] to-[#60A5FA] rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ring-1 ring-white/15 shadow-[0_4px_12px_rgba(37,99,235,0.4)]">
                          <span className="absolute inset-0 rounded-full bg-[#60A5FA]/40 blur-md opacity-50" />
                          <span className="relative">{(c.name || '?')[0].toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-white flex items-center gap-1.5 flex-wrap">
                            {c.name}
                            {subByCustomer[c.id] && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-blue-400/15 text-blue-200 border border-blue-400/30 px-1.5 py-0.5 rounded">
                                <Package className="w-2.5 h-2.5" /> Assinante
                              </span>
                            )}
                          </div>
                          {c.email && <div className="text-xs text-white/50">{c.email}</div>}
                          {!subByCustomer[c.id] && (
                            <div className="mt-1">
                              <CustomerPlanRecommendation companyId={companyId} customerId={c.id} onOffer={() => setOfferingTo(c)} />
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-sm text-white/65">
                        <Phone className="w-3 h-3" />{c.phone || '–'}
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell text-sm font-semibold text-white">
                      {getCustomerStats(c.id)}x
                    </td>
                    <td className="p-4 hidden lg:table-cell text-sm text-white/55">
                      {c.last_appointment_at ? format(new Date(c.last_appointment_at), "d MMM yyyy", { locale: ptBR }) : '–'}
                    </td>
                    <td className="p-4">
                      <CustomerTypeBadge customer={c} showVisits={false} />
                    </td>
                    <td className="p-4">
                      {!isBarbeiro ? (
                        <div className="flex items-center gap-1">
                          <WhatsAppButton
                            phone={c.phone}
                            message={buildReactivationMessage({ company, customer: c })}
                            title={`Enviar WhatsApp para ${c.name}`}
                          />

                          <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-white/10 rounded-lg" title="Editar"><Pencil className="w-3.5 h-3.5 text-white/55" /></button>
                          <button onClick={() => { if (confirm('Excluir cliente?')) deleteMutation.mutate(c.id); }} className="p-1.5 hover:bg-rose-500/10 rounded-lg" title="Excluir"><Trash2 className="w-3.5 h-3.5 text-rose-300" /></button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
           </div>
          ) : (
            <div className="p-16 text-center text-white/55">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? 'Nenhum cliente encontrado para esta busca' : 'Nenhum cliente cadastrado ainda'}</p>
              {!search && <button onClick={() => setShowForm(true)} className="text-sm font-semibold text-[#93C5FD] mt-2 hover:text-white transition-colors">Cadastrar primeiro cliente</button>}
            </div>
          )}
        </div>

        {offeringTo && (
          <OfferPlanModal
            companyId={companyId}
            customer={offeringTo}
            onClose={() => setOfferingTo(null)}
            onActivated={() => queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'subscriptions', companyId }) })}
          />
        )}

        <StandardModal
          open={showForm}
          onClose={closeForm}
          title={editing ? 'Editar Cliente' : 'Novo Cliente'}
          footer={
            <>
              <button onClick={closeForm} className="flex-1 min-h-[48px] px-4 border border-white/10 rounded-xl text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.08] transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={!form.name || !form.phone || createMutation.isPending || updateMutation.isPending}
                className="flex-1 min-h-[48px] px-4 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-xl text-sm font-semibold hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15">
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Nome *</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-white/60 block mb-1">Telefone *</label>
                <input type="text" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60 block mb-1">E-mail</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Relacionamento</label>
              <FilterSelect
                value={form.status}
                onChange={(v) => setForm(p => ({ ...p, status: v }))}
                className="w-full"
              >
                <option value="active">Cliente normal</option>
                <option value="vip">VIP</option>
                <option value="inactive">Inativo manual</option>
              </FilterSelect>
              <p className="text-[11px] text-white/50 mt-1 leading-snug">
                Marcação manual da equipe. Para o ciclo de vida automático, veja o card abaixo.
              </p>
            </div>

            {editing && form.phone && (
              <div className="flex flex-wrap gap-2">
                <WhatsAppButton
                  phone={form.phone}
                  message={buildReactivationMessage({ company, customer: editing })}
                  variant="inline"
                  label="Enviar WhatsApp"
                  title="Abrir WhatsApp deste cliente"
                />
              </div>
            )}

            {editing && <LifecycleStatusCard customer={editing} />}
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Observações</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                placeholder="Preferências, alergias, observações..."
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 resize-none" />
            </div>

            {editing && (
              <div className="mt-5 pt-5 border-t border-white/8 space-y-4">
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