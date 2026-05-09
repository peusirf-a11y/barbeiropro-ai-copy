import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useState } from 'react';
import { Plus, X, Package, Edit2, Star } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { SkeletonPage } from '@/components/Skeletons';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import StandardModal from '@/components/ui/standard-modal';

const emptyForm = { name: '', description: '', service_ids: [], price: '', duration_minutes: '', active: true, featured: false };

export default function AppCombos() {
  const { companyId, isLoading: loadingCompany } = useCompany();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['packages', companyId],
    queryFn: () => base44.entities.ServicePackage.filter({ company_id: companyId }, '-created_date', 100),
    enabled: !!companyId,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services', companyId],
    queryFn: () => base44.entities.Service.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ServicePackage.create({ ...data, company_id: companyId, price: +data.price, duration_minutes: +data.duration_minutes || 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['packages', companyId] }); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ServicePackage.update(id, { ...data, price: +data.price, duration_minutes: +data.duration_minutes || 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['packages', companyId] }); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ServicePackage.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packages', companyId] }),
  });

  const resetForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); };

  const openEdit = (pkg) => {
    setEditing(pkg);
    setForm({
      name: pkg.name || '',
      description: pkg.description || '',
      service_ids: pkg.service_ids || [],
      price: pkg.price?.toString() || '',
      duration_minutes: pkg.duration_minutes?.toString() || '',
      active: pkg.active !== false,
      featured: !!pkg.featured,
    });
    setShowForm(true);
  };

  const toggleService = (sid) => {
    setForm(p => {
      const has = p.service_ids.includes(sid);
      const next = has ? p.service_ids.filter(x => x !== sid) : [...p.service_ids, sid];
      // auto-suggest duration
      const duration = next.reduce((s, id) => s + (services.find(x => x.id === id)?.duration_minutes || 0), 0);
      return { ...p, service_ids: next, duration_minutes: duration.toString() };
    });
  };

  const handleSubmit = () => {
    if (!form.name || !form.price) return;
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const sumOriginal = (ids) => ids.reduce((s, id) => s + (services.find(x => x.id === id)?.price || 0), 0);

  if (loadingCompany || isLoading) {
    return <AppLayout><SkeletonPage /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Combos & Pacotes"
          subtitle="Junte serviços com preço fixo para aumentar o ticket médio"
          icon={Package}
        >
          <PrimaryButton onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>Novo combo</PrimaryButton>
        </AppPageHeader>

        {packages.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/8">
            <EmptyState
              icon={Package}
              title="Nenhum combo criado"
              description="Combos juntam vários serviços por um preço fixo. Ex: Corte + Barba + Sobrancelha por R$ 80."
              action={
                <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }} className="bg-[#2563EB] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#1d4ed8]">
                  Criar primeiro combo
                </button>
              }
            />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map(p => {
              const original = sumOriginal(p.service_ids || []);
              const discount = original > 0 ? Math.round((1 - p.price / original) * 100) : 0;
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-black/5 p-5 flex flex-col shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#2563EB]" />
                      <h3 className="font-bold text-[#111827]">{p.name}</h3>
                    </div>
                    {p.featured && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                  </div>
                  {p.description && <p className="text-xs text-[#6B7280] mb-3">{p.description}</p>}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(p.service_ids || []).map(sid => {
                      const s = services.find(x => x.id === sid);
                      return s ? <span key={sid} className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{s.name}</span> : null;
                    })}
                  </div>
                  <div className="mt-auto pt-3 border-t border-black/5 flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-black text-[#111827]">R$ {p.price?.toFixed(2)}</div>
                      {discount > 0 && (
                        <div className="text-xs text-emerald-600 font-semibold">economia de {discount}% (R$ {original.toFixed(2)})</div>
                      )}
                      <div className="text-[11px] text-[#6B7280]">{p.duration_minutes || 0} min · {p.active ? 'ativo' : 'inativo'}</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-[#2563EB]"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => { if (confirm('Excluir combo?')) deleteMutation.mutate(p.id); }} className="p-1.5 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <StandardModal
          open={showForm}
          onClose={resetForm}
          title={editing ? 'Editar combo' : 'Novo combo'}
          footer={
            <>
              <button onClick={resetForm} className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium">Cancelar</button>
              <button onClick={handleSubmit} disabled={!form.name || !form.price || (createMutation.isPending || updateMutation.isPending)}
                className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50">
                {(createMutation.isPending || updateMutation.isPending) ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Nome do combo *</label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Combo Premium"
                    className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Descrição</label>
                  <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-2">Serviços incluídos</label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto border border-black/10 rounded-lg p-2">
                    {services.length === 0 && <div className="text-xs text-gray-400 text-center py-3">Cadastre serviços primeiro</div>}
                    {services.map(s => (
                      <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={form.service_ids.includes(s.id)} onChange={() => toggleService(s.id)} />
                        <span className="text-sm flex-1">{s.name}</span>
                        <span className="text-xs text-gray-400">R$ {s.price} · {s.duration_minutes}min</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Preço fixo (R$) *</label>
                    <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Duração (min)</label>
                    <input type="number" min="0" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
                  </div>
                </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                Ativo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.featured} onChange={e => setForm(p => ({ ...p, featured: e.target.checked }))} />
                Destaque
              </label>
            </div>
          </div>
        </StandardModal>
      </div>
    </AppLayout>
  );
}