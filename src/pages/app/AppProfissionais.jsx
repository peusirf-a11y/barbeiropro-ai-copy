import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useState } from 'react';
import { Plus, X, Pencil, Scissors, Trash2 } from 'lucide-react';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import MobileSelect from '@/components/ui/mobile-select';
import StandardModal from '@/components/ui/standard-modal';
import PhotoUpload from '@/components/ui/photo-upload';

const DAYS = [
  { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sáb' }, { key: 'dom', label: 'Dom' },
];

const defaultSchedule = Object.fromEntries(DAYS.map(d => [d.key, { open: '09:00', close: '18:00', active: d.key !== 'dom' }]));

const emptyForm = { name: '', specialty: '', photo_url: '', active: true, work_schedule: defaultSchedule, service_ids: [], unit_ids: [], commission_type: 'percent', commission_value: 0 };

export default function AppProfissionais() {
  const { companyId, isLoading: loadingCompany } = useCompany();
  const { units, isMultiUnit, activeUnitId } = useActiveUnit();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState('info'); // 'info' | 'schedule' | 'services' | 'units'
  const queryClient = useQueryClient();

  const { data: professionals = [], isLoading } = useQuery({
    queryKey: ['professionals', companyId, activeUnitId],
    queryFn: () => base44.entities.Professional.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services', companyId],
    queryFn: () => base44.entities.Service.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Professional.create({ ...data, company_id: companyId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['professionals'] }); closeForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Professional.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['professionals'] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Professional.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['professionals'] }),
  });

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); setTab('info'); };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      specialty: p.specialty || '',
      photo_url: p.photo_url || '',
      active: p.active,
      work_schedule: p.work_schedule || defaultSchedule,
      service_ids: p.service_ids || [],
      unit_ids: p.unit_ids || [],
      commission_type: p.commission_type || 'percent',
      commission_value: p.commission_value || 0,
    });
    setShowForm(true);
  };

  const toggleUnit = (uid) => {
    setForm(p => ({
      ...p,
      unit_ids: p.unit_ids.includes(uid) ? p.unit_ids.filter(id => id !== uid) : [...p.unit_ids, uid]
    }));
  };

  // Filtra a lista de profissionais pela unidade ativa em multi-unidade
  const visiblePros = isMultiUnit && activeUnitId
    ? professionals.filter(p => !p.unit_ids || p.unit_ids.length === 0 || p.unit_ids.includes(activeUnitId))
    : professionals;

  const handleSave = () => {
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const setSchedule = (day, field, val) => {
    setForm(p => ({ ...p, work_schedule: { ...p.work_schedule, [day]: { ...p.work_schedule[day], [field]: val } } }));
  };

  const toggleService = (sid) => {
    setForm(p => ({
      ...p,
      service_ids: p.service_ids.includes(sid) ? p.service_ids.filter(id => id !== sid) : [...p.service_ids, sid]
    }));
  };

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
          title="Profissionais"
          subtitle={`${visiblePros.length} ${visiblePros.length === 1 ? 'profissional' : 'profissionais'}${isMultiUnit ? ' nesta unidade' : ' cadastrados'}`}
          icon={Scissors}
        >
          <PrimaryButton onClick={() => {
            // Pré-seleciona a unidade ativa ao criar
            if (isMultiUnit && activeUnitId) setForm(p => ({ ...p, unit_ids: [activeUnitId] }));
            setShowForm(true);
          }}>Novo profissional</PrimaryButton>
        </AppPageHeader>

        {visiblePros.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5 p-16 text-center text-[#6B7280] shadow-[var(--shadow-sm)]">
            <Scissors className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-3">Nenhum profissional cadastrado</p>
            <button onClick={() => setShowForm(true)} className="text-sm font-semibold text-[#2563EB] hover:underline">Adicionar primeiro profissional</button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {visiblePros.map(pro => (
              <div key={pro.id} className={`bg-white rounded-2xl border p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-200 ${pro.active ? 'border-black/5' : 'border-black/5 opacity-60'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {pro.photo_url ? (
                      <img src={pro.photo_url} alt={pro.name} className="w-12 h-12 rounded-xl object-cover ring-2 ring-white shadow-sm" />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-[#2563EB] to-[#60A5FA] rounded-xl flex items-center justify-center shadow-sm">
                        <Scissors className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-[#111827]">{pro.name}</h3>
                      <p className="text-xs text-[#6B7280]">{pro.specialty || 'Barbeiro'}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <div className={`w-2 h-2 rounded-full ${pro.active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        <span className="text-xs text-[#6B7280]">{pro.active ? 'Ativo' : 'Inativo'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(pro)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-gray-400" /></button>
                    <button onClick={() => { if (confirm('Excluir profissional?')) deleteMutation.mutate(pro.id); }} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                </div>
                {pro.service_ids && pro.service_ids.length > 0 && (
                  <div className="text-xs text-[#6B7280]">{pro.service_ids.length} serviços vinculados</div>
                )}
                {pro.commission_value > 0 && (
                  <div className="text-xs text-[#6B7280] mt-1">Comissão: {pro.commission_value}{pro.commission_type === 'percent' ? '%' : ' R$'}</div>
                )}
              </div>
            ))}
          </div>
        )}

        <StandardModal
          open={showForm}
          onClose={closeForm}
          title={editing ? 'Editar Profissional' : 'Novo Profissional'}
          size="lg"
          footer={
            <>
              <button onClick={closeForm} className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={!form.name || createMutation.isPending || updateMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#2563EB]/90 disabled:opacity-50">
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          <div>
              {/* Tabs */}
              <div className="flex border-b border-black/8 -mx-6 mb-4">
                {[
                  { id: 'info', label: 'Dados' },
                  { id: 'schedule', label: 'Horários' },
                  { id: 'services', label: 'Serviços' },
                  ...(isMultiUnit ? [{ id: 'units', label: 'Unidades' }] : []),
                ].map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`flex-1 py-2.5 text-sm font-medium transition-all ${tab === t.id ? 'text-[#2563EB] border-b-2 border-[#2563EB]' : 'text-gray-400 hover:text-gray-600'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="">
                {tab === 'info' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Nome *</label>
                      <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Especialidade</label>
                      <input type="text" value={form.specialty} onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))}
                        placeholder="Ex: Barba & Navalha"
                        className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Foto do barbeiro</label>
                      <PhotoUpload
                        value={form.photo_url}
                        onChange={(url) => setForm(p => ({ ...p, photo_url: url }))}
                        fallbackText={form.name}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">Tipo comissão</label>
                        <MobileSelect value={form.commission_type} onChange={v => setForm(p => ({ ...p, commission_type: v }))}
                          className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none">
                          <option value="percent">Porcentagem (%)</option>
                          <option value="fixed">Valor fixo (R$)</option>
                        </MobileSelect>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">Valor</label>
                        <input type="number" min="0" value={form.commission_value} onChange={e => setForm(p => ({ ...p, commission_value: +e.target.value }))}
                          className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                      Profissional ativo
                    </label>
                  </div>
                )}

                {tab === 'schedule' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 mb-3">Configure os dias e horários de atendimento</p>
                    {DAYS.map(({ key, label }) => {
                      const h = form.work_schedule[key] || { open: '09:00', close: '18:00', active: false };
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <label className="flex items-center gap-2 w-16">
                            <input type="checkbox" checked={h.active} onChange={e => setSchedule(key, 'active', e.target.checked)} />
                            <span className={`text-sm font-medium ${h.active ? 'text-[#1B1C1E]' : 'text-gray-400'}`}>{label}</span>
                          </label>
                          {h.active ? (
                            <div className="flex items-center gap-2">
                              <input type="time" value={h.open} onChange={e => setSchedule(key, 'open', e.target.value)}
                                className="px-2 py-1.5 border border-black/10 rounded-lg text-xs focus:outline-none" />
                              <span className="text-gray-400 text-xs">até</span>
                              <input type="time" value={h.close} onChange={e => setSchedule(key, 'close', e.target.value)}
                                className="px-2 py-1.5 border border-black/10 rounded-lg text-xs focus:outline-none" />
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Folga</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {tab === 'units' && isMultiUnit && (
                  <div>
                    <p className="text-xs text-gray-500 mb-3">Selecione em quais unidades este profissional atende. Se nenhuma for marcada, aparece em todas.</p>
                    <div className="space-y-2">
                      {units.map(u => (
                        <label key={u.id} className="flex items-center gap-3 p-3 rounded-xl border border-black/8 cursor-pointer hover:bg-[#F8F7F3]">
                          <input type="checkbox" checked={form.unit_ids.includes(u.id)} onChange={() => toggleUnit(u.id)} />
                          <span className="text-sm font-medium text-[#1B1C1E]">{u.name}</span>
                          {u.is_default && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 ml-auto">Matriz</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {tab === 'services' && (
                  <div>
                    <p className="text-xs text-gray-500 mb-3">Selecione os serviços que este profissional realiza</p>
                    {services.length === 0 ? (
                      <p className="text-sm text-gray-400">Nenhum serviço cadastrado ainda</p>
                    ) : (
                      <div className="space-y-2">
                        {services.map(s => (
                          <label key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-black/8 cursor-pointer hover:bg-[#F8F7F3]">
                            <input type="checkbox" checked={form.service_ids.includes(s.id)} onChange={() => toggleService(s.id)} />
                            <div className="flex-1">
                              <span className="text-sm font-medium text-[#1B1C1E]">{s.name}</span>
                              <span className="text-xs text-gray-400 ml-2">{s.duration_minutes}min · R${s.price}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
          </div>
        </StandardModal>
      </div>
    </AppLayout>
  );
}