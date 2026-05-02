// AppUnidades — CRUD de unidades da barbearia.
// Quando há multi_unit_enabled=false, mostra um banner explicando.

import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useState } from 'react';
import { Building2, Plus, Pencil, Trash2, X, Star } from 'lucide-react';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import { useToast } from '@/components/ui/use-toast';

const empty = { name: '', address: '', phone: '', whatsapp: '', active: true };

export default function AppUnidades() {
  const { company, companyId } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units', companyId],
    queryFn: () => base44.entities.Unit.filter({ company_id: companyId }, 'sort_order'),
    enabled: !!companyId,
  });

  const createM = useMutation({
    mutationFn: (data) => base44.entities.Unit.create({ ...data, company_id: companyId, sort_order: units.length }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', companyId] });
      // Garante que o flag multi_unit_enabled fique true ao criar a 2ª unidade
      if (units.length >= 1 && !company.multi_unit_enabled) {
        base44.entities.Company.update(company.id, { multi_unit_enabled: true });
        queryClient.invalidateQueries({ queryKey: ['my-company'] });
      }
      close();
      toast({ title: 'Unidade criada' });
    },
  });

  const updateM = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Unit.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', companyId] });
      close();
      toast({ title: 'Unidade atualizada' });
    },
  });

  const deleteM = useMutation({
    mutationFn: (id) => base44.entities.Unit.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', companyId] });
      toast({ title: 'Unidade removida' });
    },
  });

  const close = () => { setShowForm(false); setEditing(null); setForm(empty); };
  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, address: u.address || '', phone: u.phone || '', whatsapp: u.whatsapp || '', active: u.active });
    setShowForm(true);
  };
  const save = () => {
    if (!form.name.trim()) return;
    if (editing) updateM.mutate({ id: editing.id, data: form });
    else createM.mutate(form);
  };

  const removeUnit = (u) => {
    if (u.is_default) {
      toast({ title: 'Não é possível remover a Matriz', variant: 'destructive' });
      return;
    }
    if (confirm(`Excluir a unidade "${u.name}"? Esta ação não pode ser desfeita.`)) {
      deleteM.mutate(u.id);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <AppPageHeader
          title="Unidades"
          subtitle={`${units.length} ${units.length === 1 ? 'unidade ativa' : 'unidades cadastradas'}`}
          icon={Building2}
        >
          <PrimaryButton onClick={() => setShowForm(true)}>Nova unidade</PrimaryButton>
        </AppPageHeader>

        {units.length <= 1 && (
          <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-2xl p-5 mb-6">
            <h3 className="font-bold text-[#2563EB] text-sm mb-1">💡 Multi-unidade</h3>
            <p className="text-sm text-gray-700">
              Cadastre uma 2ª unidade para ativar o seletor no topo do app. Cada unidade pode ter seus próprios profissionais e agendamentos.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white rounded-2xl border border-black/5 p-12 text-center text-gray-400 shadow-[var(--shadow-sm)]">
            Carregando...
          </div>
        ) : units.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5 p-12 text-center text-gray-500 shadow-[var(--shadow-sm)]">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-3">Nenhuma unidade cadastrada</p>
            <button onClick={() => setShowForm(true)} className="text-sm font-semibold text-[#2563EB] hover:underline">
              Adicionar primeira unidade
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {units.map(u => (
              <div key={u.id} className="bg-white rounded-2xl border border-black/5 p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[#EFF6FF] ring-1 ring-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-[#2563EB]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-[#111827] truncate flex items-center gap-1.5">
                        {u.name}
                        {u.is_default && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                      </h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className={`w-2 h-2 rounded-full ${u.active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        <span className="text-xs text-[#6B7280]">{u.active ? 'Ativa' : 'Inativa'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Editar">
                      <Pencil className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    {!u.is_default && (
                      <button onClick={() => removeUnit(u)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Excluir">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
                {u.address && <div className="text-xs text-gray-500 mb-1 truncate">📍 {u.address}</div>}
                {u.phone && <div className="text-xs text-gray-500">📞 {u.phone}</div>}
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={close}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-black/8 flex items-center justify-between">
                <h3 className="font-bold text-[#111827]">{editing ? 'Editar unidade' : 'Nova unidade'}</h3>
                <button onClick={close}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Nome *</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Matriz, Filial Centro, Loja Shopping"
                    className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Endereço</label>
                  <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Telefone</label>
                    <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">WhatsApp</label>
                    <input value={form.whatsapp} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer pt-2">
                  <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                  Unidade ativa
                </label>
              </div>
              <div className="p-6 border-t border-black/8 flex gap-3">
                <button onClick={close} className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={save} disabled={!form.name.trim() || createM.isPending || updateM.isPending}
                  className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50">
                  {createM.isPending || updateM.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}