/**
 * DemoServicos — Réplica exata do AppServicos com dados demo.
 * Usa os mesmos componentes visuais. Mutations mostram toast.
 */
import DemoLayout from '@/components/layout/DemoLayout.jsx';
import { demoServices } from '@/lib/demoData';
import { useState } from 'react';
import { Plus, Star, Clock, Pencil, Trash2, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import StandardModal from '@/components/ui/standard-modal';

const emptyForm = { name: '', description: '', duration_minutes: 30, price: 0, active: true, featured: false };

export default function DemoServicos() {
  const [services, setServices] = useState(demoServices);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const demo = (msg = 'Ação') =>
    toast.info(`${msg} disponível na conta real. Crie sua conta grátis!`, { duration: 2500 });

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, description: s.description || '', duration_minutes: s.duration_minutes, price: s.price, active: s.active, featured: s.featured || false });
    setShowForm(true);
  };

  const handleSave = () => {
    if (editing) {
      setServices(prev => prev.map(s => s.id === editing.id ? { ...s, ...form } : s));
      toast.success('Serviço atualizado (modo demo)');
    } else {
      setServices(prev => [...prev, { ...form, id: `s_demo_${Date.now()}`, company_id: 'demo-company' }]);
      toast.success('Serviço criado (modo demo)');
    }
    closeForm();
  };

  const activeServices = services.filter(s => s.active);
  const inactiveServices = services.filter(s => !s.active);

  return (
    <DemoLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <AppPageHeader
          title="Serviços"
          subtitle={`${activeServices.length} ativos · ${inactiveServices.length} inativos`}
          icon={Briefcase}
        >
          <PrimaryButton onClick={() => setShowForm(true)}>Novo serviço</PrimaryButton>
        </AppPageHeader>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(s => (
            <div key={s.id} className={`bg-white rounded-2xl border p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-200 ${s.active ? 'border-black/5' : 'border-black/5 opacity-60'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[#111827]">{s.name}</h3>
                  {s.featured && <Star className="w-4 h-4 text-amber-500 fill-amber-400" />}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-gray-400" /></button>
                  <button onClick={() => { demo('Excluir serviço'); }} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              </div>
              {s.description && <p className="text-xs text-[#6B7280] mb-3 line-clamp-2">{s.description}</p>}
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-1 text-xs text-[#6B7280]"><Clock className="w-3.5 h-3.5" />{s.duration_minutes} min</span>
                <span className="text-xl font-black text-[#2563EB]">R${s.price}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-black/5">
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${s.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {s.active ? 'Ativo' : 'Inativo'}
                </span>
                <button
                  onClick={() => setServices(prev => prev.map(sv => sv.id === s.id ? { ...sv, active: !sv.active } : sv))}
                  className="text-xs text-gray-400 hover:text-[#2563EB] font-medium"
                >
                  {s.active ? 'Inativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <StandardModal
          open={showForm}
          onClose={closeForm}
          title={editing ? 'Editar Serviço' : 'Novo Serviço'}
          footer={
            <>
              <button onClick={closeForm} className="flex-1 min-h-[48px] px-4 border border-black/10 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={!form.name}
                className="flex-1 min-h-[48px] px-4 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 transition-all">
                Salvar
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Nome *</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Corte Clássico"
                className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Descrição</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
                className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Duração (min) *</label>
                <input type="number" min="5" step="5" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: +e.target.value }))}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Preço (R$) *</label>
                <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: +e.target.value }))}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                Ativo
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.featured} onChange={e => setForm(p => ({ ...p, featured: e.target.checked }))} />
                <Star className="w-3.5 h-3.5 text-yellow-500" /> Destaque
              </label>
            </div>
          </div>
        </StandardModal>
      </div>
    </DemoLayout>
  );
}