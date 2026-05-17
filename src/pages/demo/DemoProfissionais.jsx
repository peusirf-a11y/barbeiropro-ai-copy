/**
 * DemoProfissionais — Réplica exata do AppProfissionais com dados demo.
 * Usa os mesmos componentes e layout. Mutations temporárias em memória.
 */
import DemoLayout from '@/components/layout/DemoLayout.jsx';
import { demoProfessionals, demoServices } from '@/lib/demoData';
import { useState } from 'react';
import { Scissors, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import StandardModal from '@/components/ui/standard-modal';

const DAYS = [
  { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sáb' }, { key: 'dom', label: 'Dom' },
];
const defaultSchedule = Object.fromEntries(DAYS.map(d => [d.key, { open: '09:00', close: '18:00', active: d.key !== 'dom' }]));
const emptyForm = { name: '', specialty: '', photo_url: '', active: true, work_schedule: defaultSchedule, service_ids: [], commission_type: 'percent', commission_value: 0 };

export default function DemoProfissionais() {
  const [professionals, setProfessionals] = useState(demoProfessionals);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState('info');

  const demo = (msg = 'Ação') =>
    toast.info(`${msg} disponível na conta real. Crie sua conta grátis!`, { duration: 2500 });

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); setTab('info'); };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name, specialty: p.specialty || '', photo_url: p.photo_url || '',
      active: p.active, work_schedule: p.work_schedule || defaultSchedule,
      service_ids: p.service_ids || [], commission_type: p.commission_type || 'percent',
      commission_value: p.commission_value || 0,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (editing) {
      setProfessionals(prev => prev.map(p => p.id === editing.id ? { ...p, ...form } : p));
      toast.success('Profissional atualizado (modo demo)');
    } else {
      setProfessionals(prev => [...prev, { ...form, id: `p_demo_${Date.now()}`, company_id: 'demo-company' }]);
      toast.success('Profissional criado (modo demo)');
    }
    closeForm();
  };

  const toggleService = (sid) => {
    setForm(p => ({
      ...p,
      service_ids: p.service_ids.includes(sid) ? p.service_ids.filter(id => id !== sid) : [...p.service_ids, sid]
    }));
  };

  const setSchedule = (day, field, val) => {
    setForm(p => ({ ...p, work_schedule: { ...p.work_schedule, [day]: { ...p.work_schedule[day], [field]: val } } }));
  };

  return (
    <DemoLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <AppPageHeader
          title="Profissionais"
          subtitle={`${professionals.length} profissionais cadastrados`}
          icon={Scissors}
        >
          <PrimaryButton onClick={() => setShowForm(true)}>Novo profissional</PrimaryButton>
        </AppPageHeader>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {professionals.map(pro => (
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
                  <button onClick={() => demo('Excluir profissional')} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
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

        <StandardModal
          open={showForm}
          onClose={closeForm}
          title={editing ? 'Editar Profissional' : 'Novo Profissional'}
          size="lg"
          footer={
            <>
              <button onClick={closeForm} className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={!form.name}
                className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#2563EB]/90 disabled:opacity-50">
                Salvar
              </button>
            </>
          }
        >
          <div>
            <div className="flex border-b border-black/8 -mx-6 mb-4">
              {[{ id: 'info', label: 'Dados' }, { id: 'schedule', label: 'Horários' }, { id: 'services', label: 'Serviços' }].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-all ${tab === t.id ? 'text-[#2563EB] border-b-2 border-[#2563EB]' : 'text-gray-400 hover:text-gray-600'}`}>
                  {t.label}
                </button>
              ))}
            </div>

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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Tipo comissão</label>
                    <select value={form.commission_type} onChange={e => setForm(p => ({ ...p, commission_type: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none">
                      <option value="percent">Porcentagem (%)</option>
                      <option value="fixed">Valor fixo (R$)</option>
                    </select>
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
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-3">Configure os dias e horários de atendimento</p>
                {DAYS.map(({ key, label }) => {
                  const h = form.work_schedule[key] || { open: '09:00', close: '18:00', active: false };
                  return (
                    <div key={key} className="flex items-center gap-2 sm:gap-3">
                      <label className="flex items-center gap-1.5 w-[68px] flex-shrink-0">
                        <input type="checkbox" checked={h.active} onChange={e => setSchedule(key, 'active', e.target.checked)} />
                        <span className={`text-sm font-semibold ${h.active ? 'text-[#1B1C1E]' : 'text-gray-400'}`}>{label}</span>
                      </label>
                      {h.active ? (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <input type="time" value={h.open} onChange={e => setSchedule(key, 'open', e.target.value)}
                            className="flex-1 min-w-0 px-2 py-1.5 border border-black/10 rounded-lg text-sm" />
                          <span className="text-gray-400 text-xs flex-shrink-0">até</span>
                          <input type="time" value={h.close} onChange={e => setSchedule(key, 'close', e.target.value)}
                            className="flex-1 min-w-0 px-2 py-1.5 border border-black/10 rounded-lg text-sm" />
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 flex-1">Folga</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'services' && (
              <div>
                <p className="text-xs text-gray-500 mb-3">Selecione os serviços que este profissional realiza</p>
                <div className="space-y-2">
                  {demoServices.map(s => (
                    <label key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-black/8 cursor-pointer hover:bg-[#F8F7F3]">
                      <input type="checkbox" checked={form.service_ids.includes(s.id)} onChange={() => toggleService(s.id)} />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-[#1B1C1E]">{s.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{s.duration_minutes}min · R${s.price}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </StandardModal>
      </div>
    </DemoLayout>
  );
}