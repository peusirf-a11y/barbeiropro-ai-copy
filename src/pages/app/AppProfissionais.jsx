import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, X, Pencil, Scissors } from 'lucide-react';

export default function AppProfissionais() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', specialty: '', photo_url: '', active: true });
  const queryClient = useQueryClient();

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals'],
    queryFn: () => base44.entities.Professional.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Professional.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['professionals'] }); closeForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Professional.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['professionals'] }); closeForm(); },
  });

  const closeForm = () => { setShowForm(false); setEditing(null); setForm({ name: '', specialty: '', photo_url: '', active: true }); };
  const openEdit = (p) => { setEditing(p); setForm({ name: p.name, specialty: p.specialty || '', photo_url: p.photo_url || '', active: p.active }); setShowForm(true); };
  const handleSave = () => {
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#1B1C1E]">Profissionais</h1>
            <p className="text-gray-500 text-sm mt-1">{professionals.length} profissionais cadastrados</p>
          </div>
          <button onClick={() => setShowForm(true)} className="bg-[#1B3A4B] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#1B3A4B]/90 transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" />Novo profissional
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {professionals.map(pro => (
            <div key={pro.id} className="bg-white rounded-2xl border border-black/8 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  {pro.photo_url ? (
                    <img src={pro.photo_url} alt={pro.name} className="w-14 h-14 rounded-2xl object-cover" />
                  ) : (
                    <div className="w-14 h-14 bg-[#1B3A4B]/10 rounded-2xl flex items-center justify-center">
                      <Scissors className="w-6 h-6 text-[#1B3A4B]" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-[#1B1C1E]">{pro.name}</h3>
                    <p className="text-sm text-gray-500">{pro.specialty || 'Barbeiro'}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <div className={`w-2 h-2 rounded-full ${pro.active ? 'bg-green-400' : 'bg-gray-300'}`} />
                      <span className="text-xs text-gray-400">{pro.active ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => openEdit(pro)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <Pencil className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          ))}
          {professionals.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <p className="text-sm mb-3">Nenhum profissional cadastrado</p>
              <button onClick={() => setShowForm(true)} className="text-sm font-semibold text-[#1B3A4B] hover:underline">Adicionar primeiro profissional</button>
            </div>
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeForm}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-[#1B1C1E]">{editing ? 'Editar Profissional' : 'Novo Profissional'}</h3>
                <button onClick={closeForm}><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Nome *', key: 'name', type: 'text' },
                  { label: 'Especialidade', key: 'specialty', type: 'text' },
                  { label: 'URL da Foto', key: 'photo_url', type: 'url' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">{f.label}</label>
                    <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A4B]/20" />
                  </div>
                ))}
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                  Profissional ativo
                </label>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={closeForm} className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</button>
                <button onClick={handleSave} disabled={!form.name}
                  className="flex-1 px-4 py-2.5 bg-[#1B3A4B] text-white rounded-lg text-sm font-semibold hover:bg-[#1B3A4B]/90 disabled:opacity-50">Salvar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}