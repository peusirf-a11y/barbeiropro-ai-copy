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
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md">
            <EmptyState
              icon={Package}
              title="Nenhum combo criado"
              description="Combos juntam vários serviços por um preço fixo. Ex: Corte + Barba + Sobrancelha por R$ 80."
              action={
                <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }} className="bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:brightness-110 shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15 transition-all">
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
                <div key={p.id} className="group relative rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 flex flex-col hover:border-[#60A5FA]/30 hover:bg-white/[0.04] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.06] to-transparent pointer-events-none" />
                  {p.featured && (
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-400/[0.08] to-transparent pointer-events-none" />
                  )}
                  <div className="relative flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="w-4 h-4 text-[#93C5FD] flex-shrink-0" />
                      <h3 className="font-bold text-white truncate">{p.name}</h3>
                    </div>
                    {p.featured && <Star className="w-4 h-4 text-amber-300 fill-amber-400 flex-shrink-0" />}
                  </div>
                  {p.description && <p className="relative text-xs text-white/55 mb-3">{p.description}</p>}
                  <div className="relative flex flex-wrap gap-1 mb-3">
                    {(p.service_ids || []).map(sid => {
                      const s = services.find(x => x.id === sid);
                      return s ? <span key={sid} className="text-[11px] bg-white/[0.05] text-white/75 border border-white/10 px-2 py-0.5 rounded-full">{s.name}</span> : null;
                    })}
                  </div>
                  <div className="relative mt-auto pt-3 border-t border-white/8 flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-black bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">R$ {p.price?.toFixed(2)}</div>
                      {discount > 0 && (
                        <div className="text-xs text-emerald-300 font-semibold">economia de {discount}% (R$ {original.toFixed(2)})</div>
                      )}
                      <div className="text-[11px] text-white/50">{p.duration_minutes || 0} min · {p.active ? 'ativo' : 'inativo'}</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 text-white/55 hover:text-[#93C5FD] hover:bg-white/10 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => { if (confirm('Excluir combo?')) deleteMutation.mutate(p.id); }} className="p-1.5 text-white/55 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
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
              <button onClick={resetForm} className="flex-1 px-4 py-2.5 border border-white/10 rounded-lg text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">Cancelar</button>
              <button onClick={handleSubmit} disabled={!form.name || !form.price || (createMutation.isPending || updateMutation.isPending)}
                className="flex-1 px-4 py-2.5 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15 transition-all">
                {(createMutation.isPending || updateMutation.isPending) ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-white/60 block mb-1">Nome do combo *</label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Combo Premium"
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/60 block mb-1">Descrição</label>
                  <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/60 block mb-2">Serviços incluídos</label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto border border-white/10 bg-white/[0.02] rounded-lg p-2">
                    {services.length === 0 && <div className="text-xs text-white/40 text-center py-3">Cadastre serviços primeiro</div>}
                    {services.map(s => (
                      <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.05] cursor-pointer transition-colors">
                        <input type="checkbox" checked={form.service_ids.includes(s.id)} onChange={() => toggleService(s.id)} className="accent-[#60A5FA]" />
                        <span className="text-sm flex-1 text-white/85">{s.name}</span>
                        <span className="text-xs text-white/45">R$ {s.price} · {s.duration_minutes}min</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-white/60 block mb-1">Preço fixo (R$) *</label>
                    <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-white/60 block mb-1">Duração (min)</label>
                    <input type="number" min="0" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                  </div>
                </div>
            <div className="flex gap-5 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer text-white/85">
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} className="accent-[#60A5FA]" />
                Ativo
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer text-white/85">
                <input type="checkbox" checked={form.featured} onChange={e => setForm(p => ({ ...p, featured: e.target.checked }))} className="accent-amber-400" />
                <Star className="w-3.5 h-3.5 text-amber-300" /> Destaque
              </label>
            </div>
          </div>
        </StandardModal>
      </div>
    </AppLayout>
  );
}