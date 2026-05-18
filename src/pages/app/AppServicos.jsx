import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useState } from 'react';
import { Plus, X, Star, Clock, Pencil, Trash2, Briefcase } from 'lucide-react';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import StandardModal from '@/components/ui/standard-modal';

const emptyForm = { name: '', description: '', duration_minutes: 30, price: 0, active: true, featured: false, category_id: '' };

export default function AppServicos() {
  const { companyId, isLoading: loadingCompany } = useCompany();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services', companyId],
    queryFn: () => base44.entities.Service.filter({ company_id: companyId }, 'name', 200),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Service.create({ ...data, company_id: companyId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['services', companyId] }); closeForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Service.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['services', companyId] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Service.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services', companyId] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }) => base44.entities.Service.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services', companyId] }),
  });

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, description: s.description || '', duration_minutes: s.duration_minutes, price: s.price, active: s.active, featured: s.featured || false, category_id: s.category_id || '' });
    setShowForm(true);
  };

  const handleSave = () => {
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const activeServices = services.filter(s => s.active);
  const inactiveServices = services.filter(s => !s.active);

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
          title="Serviços"
          subtitle={`${activeServices.length} ativos · ${inactiveServices.length} inativos`}
          icon={Briefcase}
        >
          <PrimaryButton onClick={() => setShowForm(true)}>Novo serviço</PrimaryButton>
        </AppPageHeader>

        {services.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-16 text-center text-white/55">
            <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-3">Nenhum serviço cadastrado</p>
            <button onClick={() => setShowForm(true)} className="text-sm font-semibold text-[#93C5FD] hover:text-white transition-colors">Adicionar primeiro serviço</button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map(s => (
              <div key={s.id} className={`group relative rounded-2xl border p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 overflow-hidden ${s.active ? 'bg-white/[0.025] border-white/8 hover:border-[#60A5FA]/30 hover:bg-white/[0.04]' : 'bg-white/[0.015] border-white/5 opacity-55'}`}>
                {/* Tint sutil no canto quando ativo */}
                {s.active && (
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.06] to-transparent pointer-events-none" />
                )}
                {s.featured && (
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-400/[0.08] to-transparent pointer-events-none" />
                )}
                <div className="relative flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-bold text-white truncate">{s.name}</h3>
                    {s.featured && <Star className="w-4 h-4 text-amber-300 fill-amber-400 flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Editar"><Pencil className="w-3.5 h-3.5 text-white/55" /></button>
                    <button onClick={() => { if (confirm('Excluir serviço?')) deleteMutation.mutate(s.id); }} className="p-1.5 hover:bg-rose-500/10 rounded-lg transition-colors" title="Excluir"><Trash2 className="w-3.5 h-3.5 text-rose-300" /></button>
                  </div>
                </div>
                {s.description && <p className="relative text-xs text-white/55 mb-3 line-clamp-2">{s.description}</p>}
                <div className="relative flex items-center justify-between mb-3">
                  <span className="flex items-center gap-1 text-xs text-white/60"><Clock className="w-3.5 h-3.5" />{s.duration_minutes} min</span>
                  <span className="text-xl font-black bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">R${s.price}</span>
                </div>
                <div className="relative flex items-center justify-between pt-3 border-t border-white/8">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${s.active ? 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30' : 'bg-white/[0.04] text-white/55 border-white/10'}`}>
                    {s.active ? 'Ativo' : 'Inativo'}
                  </span>
                  <button onClick={() => toggleActiveMutation.mutate({ id: s.id, active: !s.active })}
                    className="text-xs text-white/55 hover:text-[#93C5FD] font-medium transition-colors">
                    {s.active ? 'Inativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <StandardModal
          open={showForm}
          onClose={closeForm}
          title={editing ? 'Editar Serviço' : 'Novo Serviço'}
          footer={
            <>
              <button onClick={closeForm} className="flex-1 min-h-[48px] px-4 border border-white/10 rounded-xl text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.08] transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={!form.name || createMutation.isPending || updateMutation.isPending}
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
                placeholder="Ex: Corte Clássico"
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Descrição</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-white/60 block mb-1">Duração (min) *</label>
                <input type="number" min="5" step="5" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: +e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60 block mb-1">Preço (R$) *</label>
                <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: +e.target.value }))}
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