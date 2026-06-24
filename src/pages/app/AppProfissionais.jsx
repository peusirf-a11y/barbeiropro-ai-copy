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
import BarberPhotoStandardizer from '@/components/profissionais/BarberPhotoStandardizer';
import BarberBioGenerator from '@/components/profissionais/BarberBioGenerator';
import BarberSpecialtiesAnalyzer from '@/components/profissionais/BarberSpecialtiesAnalyzer';

const DAYS = [
  { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sáb' }, { key: 'dom', label: 'Dom' },
];

const defaultSchedule = Object.fromEntries(DAYS.map(d => [d.key, { open: '09:00', close: '18:00', active: d.key !== 'dom' }]));

const emptyForm = { name: '', specialty: '', photo_url: '', active: true, work_schedule: defaultSchedule, service_ids: [], unit_ids: [], commission_type: 'percent', commission_value: 0, bio_short: '', bio_medium: '', bio_full: '', bio_generated_at: '' };

export default function AppProfissionais() {
  const { companyId, isLoading: loadingCompany } = useCompany();
  const { units, isMultiUnit, activeUnitId } = useActiveUnit();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState('info'); // 'info' | 'bio' | 'schedule' | 'services' | 'units'
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
      bio_short: p.bio_short || '',
      bio_medium: p.bio_medium || '',
      bio_full: p.bio_full || '',
      bio_generated_at: p.bio_generated_at || '',
      suggested_specialties: p.suggested_specialties || [],
      specialties_analyzed_at: p.specialties_analyzed_at || '',
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
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-16 text-center text-white/55">
            <Scissors className="w-10 h-10 mx-auto mb-3 text-white/25" />
            <p className="text-sm mb-3">Nenhum profissional cadastrado</p>
            <button onClick={() => setShowForm(true)} className="text-sm font-semibold text-[#93C5FD] hover:text-[#BFDBFE] hover:underline transition-colors">Adicionar primeiro profissional</button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {visiblePros.map(pro => (
              <div key={pro.id} className={`group relative rounded-2xl border bg-white/[0.025] backdrop-blur-md p-5 hover:bg-white/[0.04] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden ${pro.active ? 'border-white/8 hover:border-[#60A5FA]/30' : 'border-white/8 opacity-55'}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.05] to-transparent pointer-events-none" />
                <div className="relative flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {pro.photo_url ? (
                      <img src={pro.photo_url} alt={pro.name} className="w-12 h-12 rounded-xl object-cover ring-2 ring-white/15 shadow-[0_4px_12px_rgba(0,0,0,0.4)]" />
                    ) : (
                      <div className="relative w-12 h-12 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] rounded-xl flex items-center justify-center shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15">
                        <span className="absolute inset-0 rounded-xl bg-[#60A5FA]/30 blur-md opacity-60" aria-hidden="true" />
                        <Scissors className="relative w-5 h-5 text-white" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-white">{pro.name}</h3>
                      <p className="text-xs text-white/55">{pro.specialty || 'Barbeiro'}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <div className={`w-2 h-2 rounded-full ${pro.active ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-white/20'}`} />
                        <span className="text-xs text-white/55">{pro.active ? 'Ativo' : 'Inativo'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(pro)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5 text-white/50 hover:text-[#93C5FD]" /></button>
                    <button onClick={() => { if (confirm('Excluir profissional?')) deleteMutation.mutate(pro.id); }} className="p-1.5 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5 text-white/40 hover:text-rose-300" /></button>
                  </div>
                </div>
                {pro.service_ids && pro.service_ids.length > 0 && (
                  <div className="relative text-xs text-white/55">{pro.service_ids.length} serviços vinculados</div>
                )}
                {pro.commission_value > 0 && (
                  <div className="relative text-xs text-white/55 mt-1">Comissão: <span className="text-white/75 font-semibold">{pro.commission_value}{pro.commission_type === 'percent' ? '%' : ' R$'}</span></div>
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
              <button onClick={closeForm} className="flex-1 px-4 py-2.5 border border-white/10 rounded-lg text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={!form.name || createMutation.isPending || updateMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15 transition-all">
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          <div>
              {/* Tabs */}
              <div className="flex border-b border-white/8 -mx-6 mb-4">
                {[
                  { id: 'info', label: 'Dados' },
                  { id: 'bio', label: 'Biografia' },
                  { id: 'specialties', label: 'Especialidades' },
                  { id: 'schedule', label: 'Horários' },
                  { id: 'services', label: 'Serviços' },
                  ...(isMultiUnit ? [{ id: 'units', label: 'Unidades' }] : []),
                ].map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`flex-1 py-2.5 text-sm font-medium transition-all ${tab === t.id ? 'text-[#93C5FD] border-b-2 border-[#60A5FA]' : 'text-white/45 hover:text-white/75'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="">
                {tab === 'info' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-white/60 block mb-1">Nome *</label>
                      <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-white/60 block mb-1">Especialidade</label>
                      <input type="text" value={form.specialty} onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))}
                        placeholder="Ex: Barba & Navalha"
                        className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-white/60 block mb-1">Foto do barbeiro</label>
                      <BarberPhotoStandardizer
                        value={form.photo_url}
                        onChange={(url) => setForm(p => ({ ...p, photo_url: url }))}
                        fallbackText={form.name}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-white/60 block mb-1">Tipo comissão</label>
                        <MobileSelect value={form.commission_type} onChange={v => setForm(p => ({ ...p, commission_type: v }))}
                          className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                          <option value="percent">Porcentagem (%)</option>
                          <option value="fixed">Valor fixo (R$)</option>
                        </MobileSelect>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-white/60 block mb-1">Valor</label>
                        <input type="number" min="0" value={form.commission_value} onChange={e => setForm(p => ({ ...p, commission_value: +e.target.value }))}
                          className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer text-white/85">
                      <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} className="accent-[#60A5FA]" />
                      Profissional ativo
                    </label>
                  </div>
                )}

                {tab === 'bio' && (
                  <BarberBioGenerator
                    professionalId={editing?.id}
                    values={{
                      bio_short: form.bio_short,
                      bio_medium: form.bio_medium,
                      bio_full: form.bio_full,
                    }}
                    generatedAt={form.bio_generated_at}
                    onChange={(patch) => setForm(p => ({ ...p, ...patch }))}
                  />
                )}

                {tab === 'specialties' && (
                  <BarberSpecialtiesAnalyzer
                    professionalId={editing?.id}
                    suggested={form.suggested_specialties || []}
                    analyzedAt={form.specialties_analyzed_at}
                    currentSpecialty={form.specialty}
                    onApplySpecialty={(tag) => {
                      setForm(p => ({ ...p, specialty: tag }));
                      setTab('info');
                    }}
                  />
                )}

                {tab === 'schedule' && (
                  <div className="space-y-2">
                    <p className="text-xs text-white/55 mb-3">Configure os dias e horários de atendimento</p>
                    {DAYS.map(({ key, label }) => {
                      const h = form.work_schedule[key] || { open: '09:00', close: '18:00', active: false };
                      return (
                        <div key={key} className="flex items-center gap-2 sm:gap-3">
                          <label className="flex items-center gap-1.5 w-[68px] flex-shrink-0 cursor-pointer">
                            <input type="checkbox" checked={h.active} onChange={e => setSchedule(key, 'active', e.target.checked)} className="accent-[#60A5FA]" />
                            <span className={`text-sm font-semibold ${h.active ? 'text-white' : 'text-white/40'}`}>{label}</span>
                          </label>
                          {h.active ? (
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <input
                                type="time"
                                value={h.open}
                                onChange={e => setSchedule(key, 'open', e.target.value)}
                                className="flex-1 min-w-0 px-2 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
                              />
                              <span className="text-white/40 text-xs flex-shrink-0">até</span>
                              <input
                                type="time"
                                value={h.close}
                                onChange={e => setSchedule(key, 'close', e.target.value)}
                                className="flex-1 min-w-0 px-2 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-white/35 flex-1">Folga</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {tab === 'units' && isMultiUnit && (
                  <div>
                    <p className="text-xs text-white/55 mb-3">Selecione em quais unidades este profissional atende. Se nenhuma for marcada, aparece em todas.</p>
                    <div className="space-y-2">
                      {units.map(u => (
                        <label key={u.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/[0.025] cursor-pointer hover:bg-white/[0.05] hover:border-white/15 transition-colors">
                          <input type="checkbox" checked={form.unit_ids.includes(u.id)} onChange={() => toggleUnit(u.id)} className="accent-[#60A5FA]" />
                          <span className="text-sm font-medium text-white">{u.name}</span>
                          {u.is_default && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-200 border border-amber-400/25 ml-auto">Matriz</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {tab === 'services' && (
                  <div>
                    <p className="text-xs text-white/55 mb-3">Selecione os serviços que este profissional realiza</p>
                    {services.length === 0 ? (
                      <p className="text-sm text-white/40">Nenhum serviço cadastrado ainda</p>
                    ) : (
                      <div className="space-y-2">
                        {services.map(s => (
                          <label key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/[0.025] cursor-pointer hover:bg-white/[0.05] hover:border-white/15 transition-colors">
                            <input type="checkbox" checked={form.service_ids.includes(s.id)} onChange={() => toggleService(s.id)} className="accent-[#60A5FA]" />
                            <div className="flex-1">
                              <span className="text-sm font-medium text-white">{s.name}</span>
                              <span className="text-xs text-white/45 ml-2">{s.duration_minutes}min · R${s.price}</span>
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