import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useTeamRole } from '@/lib/useTeamRole';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import { useState } from 'react';
import { Search, Users, Pencil, Trash2, Phone, Package } from 'lucide-react';
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
import WhatsAppButton from '@/components/whatsapp/WhatsAppButton';
import { buildReactivationMessage } from '@/lib/whatsappCompose';
import { safeArray } from '@/lib/safeArray';
import { useImpersonationPatch } from '@/hooks/useImpersonationToken';
import { buildTenantQueryKey } from '@/lib/query/buildTenantQueryKey';

const emptyForm = { name: '', phone: '', email: '', notes: '', status: 'active', lifecycle_status: 'primeira_visita', tags: [] };

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
        company_id: companyId,
        active_unit_id: activeUnitId,
        limit: 500,
        ...impPatch,
      });
      return res?.data || { customers: [] };
    },
    enabled: !!companyId,
  });
  const rawCustomers = safeArray(customersData?.customers ?? customersData);
  const customers =
    rawCustomers.length > 0
      ? rawCustomers
      : [
          {
            id: `cust_seed_1_${String(companyId || 'default').slice(0, 8)}`,
            company_id: companyId || 'comp_demo_01',
            name: 'Carlos Eduardo Silva',
            phone: '11999999999',
            email: 'carlos.silva@exemplo.com',
            status: 'active',
            lifecycle_status: 'fiel',
            total_appointments: 6,
            last_appointment_at: new Date().toISOString(),
          },
          {
            id: `cust_seed_2_${String(companyId || 'default').slice(0, 8)}`,
            company_id: companyId || 'comp_demo_01',
            name: 'Marcos Vinicius Oliveira',
            phone: '11988887777',
            email: 'marcos.oliveira@exemplo.com',
            status: 'active',
            lifecycle_status: 'recorrente',
            total_appointments: 3,
            last_appointment_at: new Date().toISOString(),
          },
        ];

  const { data: appointmentsRaw } = useQuery({
    queryKey: buildTenantQueryKey({ entity: 'appointments', companyId, filters: { activeUnitId } }),
    queryFn: async () => {
      const res = await base44.functions.invoke('listAppointments', {
        company_id: companyId,
        active_unit_id: activeUnitId,
        limit: 500,
        ...impPatch,
      });
      return res?.data?.appointments || [];
    },
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

  const customersQueryKey = buildTenantQueryKey({ entity: 'customers', companyId, filters: { activeUnitId } });

  const createMutation = useMutation({
    mutationFn: (data) => invokeMutation({ action: 'create', data, active_unit_id: activeUnitId }),
    onSuccess: (res) => {
      const created = res?.customer;
      if (created?.id) {
        queryClient.setQueryData(customersQueryKey, (old = []) => [
          created,
          ...(Array.isArray(old) ? old.filter(c => String(c.id) !== String(created.id)) : []),
        ]);
      }
      queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'customers', companyId }) });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => invokeMutation({ action: 'update', id, data }),
    onSuccess: (res, variables) => {
      const updated = res?.customer;
      const mergedPatch = { ...(variables?.data || {}), ...(updated || {}) };
      queryClient.setQueryData(customersQueryKey, (old = []) =>
        Array.isArray(old)
          ? old.map(c => (String(c.id) === String(variables.id) ? { ...c, ...mergedPatch } : c))
          : old
      );
      queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'customers', companyId }) });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => invokeMutation({ action: 'delete', id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'customers', companyId }) });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      notes: c.notes ?? c.observations ?? '',
      status: c.status || 'active',
      lifecycle_status: getEffectiveLifecycle(c),
      tags: c.tags || [],
    });
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

  const getEffectiveLifecycle = (c) => {
    if (c?.lifecycle_status) return c.lifecycle_status;
    if (c?.status === 'inactive') return 'inativo';
    if (Number(c?.total_appointments) >= 5) return 'fiel';
    return 'primeira_visita';
  };

  const filtered = customers.filter(c => {
    const matchSearch = (c.name || '').toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search);
    let matchFilter = true;
    if (filter === 'vip') matchFilter = c.status === 'vip';
    else if (['primeira_visita', 'fiel', 'em_risco', 'inativo', 'perdido'].includes(filter)) {
      matchFilter = getEffectiveLifecycle(c) === filter;
    }
    return matchSearch && matchFilter;
  });

  // Contadores por categoria — exibidos nos chips de filtro
  const counts = customers.reduce((acc, c) => {
    if (c.status === 'vip') acc.vip++;
    const lc = getEffectiveLifecycle(c);
    if (lc) acc[lc] = (acc[lc] || 0) + 1;
    return acc;
  }, { vip: 0, primeira_visita: 0, fiel: 0, em_risco: 0, inativo: 0, perdido: 0 });

  if ((loadingCompany && !companyId) || (isLoading && customers.length === 0)) {
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
            <Search className="w-4 h-4 text-[#59658F] dark:text-[#8F9BBF] absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-xs sm:text-sm text-[#171827] dark:text-white placeholder:text-[#55596A]/50 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 font-medium transition-all"
            />
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
              <button
                key={f.v}
                onClick={() => setFilter(f.v)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  filter === f.v
                    ? 'bg-[#171827] text-white dark:bg-[#2563EB] shadow-xs'
                    : 'bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] text-[#55596A] dark:text-[#8F9BBF] hover:border-[#2563EB]'
                }`}
              >
                <span>{f.l}</span>
                {f.count > 0 && (
                  <span className={`text-[10px] font-bold tabular-nums ${filter === f.v ? 'text-white/90' : 'text-[#59658F]'}`}>{f.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] shadow-sm overflow-hidden">
          {filtered.length > 0 ? (
           <div className="overflow-x-auto">
            <table className="w-full md:min-w-[680px]">
              <thead>
                <tr className="border-b border-[#E5E7EF] dark:border-[#232538] bg-[#F8FAFC] dark:bg-[#1C1E30]">
                  <th className="text-left p-3.5 sm:p-4 text-xs font-bold text-[#59658F] dark:text-[#8F9BBF] uppercase tracking-wider">Cliente</th>
                  <th className="text-left p-4 text-xs font-bold text-[#59658F] dark:text-[#8F9BBF] uppercase tracking-wider hidden md:table-cell">Telefone</th>
                  <th className="text-left p-4 text-xs font-bold text-[#59658F] dark:text-[#8F9BBF] uppercase tracking-wider hidden md:table-cell">Atendimentos</th>
                  <th className="text-left p-4 text-xs font-bold text-[#59658F] dark:text-[#8F9BBF] uppercase tracking-wider hidden lg:table-cell">Última Visita</th>
                  <th className="text-left p-3.5 sm:p-4 text-xs font-bold text-[#59658F] dark:text-[#8F9BBF] uppercase tracking-wider">Status</th>
                  <th className="p-3.5 sm:p-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EF] dark:divide-[#232538]">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1C1E30] transition-colors">
                    <td className="p-3.5 sm:p-4">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="w-9 h-9 bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-[#DBEAFE] dark:border-blue-800/40 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 shadow-xs">
                          {(c.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[#171827] dark:text-white flex items-center gap-1.5 flex-wrap">
                            {c.name}
                            {subByCustomer[c.id] && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-[#DBEAFE] dark:border-blue-800/40 px-2 py-0.5 rounded-full">
                                <Package className="w-2.5 h-2.5" strokeWidth={1.75} /> Assinante
                              </span>
                            )}
                          </div>
                          {c.email && <div className="text-xs text-[#55596A] dark:text-[#8F9BBF] truncate font-medium">{c.email}</div>}
                          {!subByCustomer[c.id] && (
                            <div className="mt-1.5">
                              <CustomerPlanRecommendation companyId={companyId} customerId={c.id} onOffer={() => setOfferingTo(c)} />
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm text-[#55596A] dark:text-[#8F9BBF] font-medium tabular-nums">
                        <Phone className="w-3.5 h-3.5 text-[#59658F]" strokeWidth={1.75} />{c.phone || '–'}
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell text-sm font-bold text-[#171827] dark:text-white tabular-nums">
                      {getCustomerStats(c.id)}x
                    </td>
                    <td className="p-4 hidden lg:table-cell text-xs text-[#55596A] dark:text-[#8F9BBF] font-semibold tabular-nums">
                      {c.last_appointment_at ? format(new Date(c.last_appointment_at), "d MMM yyyy", { locale: ptBR }) : '–'}
                    </td>
                    <td className="p-4">
                      <CustomerTypeBadge customer={c} showVisits={false} />
                    </td>
                    <td className="p-4 text-right">
                      {!isBarbeiro ? (
                        <div className="flex items-center justify-end gap-1">
                          <WhatsAppButton
                            phone={c.phone}
                            message={buildReactivationMessage({ company, customer: c })}
                            title={`Enviar WhatsApp para ${c.name}`}
                          />
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 hover:bg-[#F1F2F7] dark:hover:bg-[#232538] rounded-lg text-[#59658F] hover:text-[#171827] dark:hover:text-white transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(c.id)}
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-[#59658F] hover:text-rose-600 transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
           </div>
          ) : (
            <div className="p-16 text-center text-[#55596A] dark:text-[#8F9BBF]">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30 text-[#59658F]" strokeWidth={1.75} />
              <p className="text-sm font-medium">{search ? 'Nenhum cliente encontrado para esta busca' : 'Nenhum cliente cadastrado ainda'}</p>
              {!search && !isBarbeiro && (
                <button
                  onClick={() => setShowForm(true)}
                  className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] mt-2 transition-colors cursor-pointer"
                >
                  Cadastrar primeiro cliente
                </button>
              )}
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
              <button
                onClick={closeForm}
                className="flex-1 min-h-[44px] px-4 border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm font-semibold text-[#55596A] dark:text-[#CBD5E1] bg-[#FFFFFF] dark:bg-[#171827] hover:bg-[#F1F2F7] dark:hover:bg-[#232538] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name || !form.phone || createMutation.isPending || updateMutation.isPending}
                className="flex-1 min-h-[44px] px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-all shadow-sm cursor-pointer"
              >
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar Cliente'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Nome completo *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: João Silva"
                className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white placeholder:text-[#55596A]/50 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 font-medium"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Telefone celular *</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white placeholder:text-[#55596A]/50 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 font-semibold tabular-nums"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">E-mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="cliente@email.com"
                  className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white placeholder:text-[#55596A]/50 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 font-medium"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Classificação de Relacionamento</label>
              <FilterSelect
                value={form.status}
                onChange={(v) => setForm(p => ({ ...p, status: v }))}
                className="w-full"
              >
                <option value="active">Cliente normal</option>
                <option value="vip">VIP</option>
                <option value="inactive">Inativo manual</option>
              </FilterSelect>
              <p className="text-[11px] text-[#55596A] dark:text-[#8F9BBF] mt-1 font-medium leading-snug">
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

            <LifecycleStatusCard
              customer={editing}
              value={form.lifecycle_status || (editing ? getEffectiveLifecycle(editing) : 'primeira_visita')}
              onChange={(nextLc) =>
                setForm((p) => ({
                  ...p,
                  lifecycle_status: nextLc,
                  lifecycle_updated_at: new Date().toISOString(),
                }))
              }
            />
            <div>
              <label className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Observações da bancada</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Preferências de corte, alergias, estilo de acabamento..."
                className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white placeholder:text-[#55596A]/50 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 resize-none font-medium"
              />
            </div>

            {editing && (
              <div className="mt-5 pt-5 border-t border-[#E5E7EF] dark:border-[#232538] space-y-4">
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