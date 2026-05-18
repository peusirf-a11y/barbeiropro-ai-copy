import { useState, useEffect } from 'react';
import StandardModal from '@/components/ui/standard-modal';
import MobileSelect from '@/components/ui/mobile-select';

const empty = {
  name: '',
  description: '',
  price_monthly: 0,
  type: 'limited',
  usage_limit: 2,
  service_ids: [],
  rollover: false,
  valid_in_units: [],
  active: true,
  off_peak_enabled: false,
  off_peak_start: '08:00',
  off_peak_end: '12:00',
  off_peak_weekdays: [1, 2, 3, 4, 5],
};

const WEEKDAYS = [
  { v: 0, l: 'Dom' }, { v: 1, l: 'Seg' }, { v: 2, l: 'Ter' }, { v: 3, l: 'Qua' },
  { v: 4, l: 'Qui' }, { v: 5, l: 'Sex' }, { v: 6, l: 'Sáb' },
];

export default function PlanFormModal({ plan, services, units, isMultiUnit, onSave, onClose, isSaving }) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (plan) setForm({ ...empty, ...plan });
    else setForm(empty);
  }, [plan]);

  const toggleService = (id) => {
    setForm(p => ({
      ...p,
      service_ids: p.service_ids.includes(id) ? p.service_ids.filter(s => s !== id) : [...p.service_ids, id],
    }));
  };
  const toggleUnit = (id) => {
    setForm(p => ({
      ...p,
      valid_in_units: p.valid_in_units.includes(id) ? p.valid_in_units.filter(u => u !== id) : [...p.valid_in_units, id],
    }));
  };

  const handleSubmit = () => {
    if (!form.name || !form.price_monthly) return;
    const payload = { ...form };
    if (payload.type === 'unlimited') payload.usage_limit = null;
    onSave(payload);
  };

  return (
    <StandardModal
      open={true}
      onClose={onClose}
      title={plan ? 'Editar plano' : 'Novo plano'}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-white/10 rounded-lg text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={!form.name || !form.price_monthly || isSaving}
            className="flex-1 px-4 py-2.5 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15 transition-all">
            {isSaving ? 'Salvando...' : plan ? 'Salvar' : 'Criar plano'}
          </button>
        </>
      }
    >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-white/60 block mb-1">Nome do plano *</label>
            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Ex: 2 cortes/mês, VIP Ilimitado"
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
          </div>

          <div>
            <label className="text-xs font-semibold text-white/60 block mb-1">Descrição</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Valor mensal (R$) *</label>
              <input type="number" min="0" step="0.01" value={form.price_monthly}
                onChange={e => setForm(p => ({ ...p, price_monthly: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Tipo *</label>
              <MobileSelect value={form.type} onChange={(v) => setForm(p => ({ ...p, type: v }))}
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white">
                <option value="limited">Limitado</option>
                <option value="unlimited">Ilimitado</option>
              </MobileSelect>
            </div>
          </div>

          {form.type === 'limited' && (
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Quantidade de usos por mês *</label>
              <input type="number" min="1" value={form.usage_limit || ''}
                onChange={e => setForm(p => ({ ...p, usage_limit: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-white/60 block mb-2">Serviços inclusos</label>
            <p className="text-[11px] text-white/40 mb-2">Deixe nenhum marcado para incluir todos os serviços.</p>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-white/8 bg-white/[0.02] rounded-lg p-2">
              {services.map(s => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 hover:bg-white/[0.05] rounded-lg text-white/85 transition-colors">
                  <input type="checkbox" checked={form.service_ids.includes(s.id)} onChange={() => toggleService(s.id)} className="accent-[#60A5FA]" />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          {isMultiUnit && units?.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-2">Unidades onde vale</label>
              <p className="text-[11px] text-white/40 mb-2">Deixe nenhuma marcada para valer em todas.</p>
              <div className="grid grid-cols-2 gap-2">
                {units.map(u => (
                  <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 hover:bg-white/[0.05] rounded-lg text-white/85 transition-colors">
                    <input type="checkbox" checked={form.valid_in_units.includes(u.id)} onChange={() => toggleUnit(u.id)} className="accent-[#60A5FA]" />
                    <span className="truncate">{u.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer text-white/85">
            <input type="checkbox" checked={form.rollover} onChange={e => setForm(p => ({ ...p, rollover: e.target.checked }))} className="accent-[#60A5FA]" />
            <span>Acumula usos não utilizados para o próximo mês</span>
          </label>

          {/* ── Off-peak (janela fixa) ─────────────────────────────────── */}
          <div className="border border-white/8 rounded-xl p-3 bg-white/[0.025]">
            <label className="flex items-center gap-2 text-sm cursor-pointer text-white/90">
              <input type="checkbox" checked={!!form.off_peak_enabled}
                onChange={e => setForm(p => ({ ...p, off_peak_enabled: e.target.checked }))} className="accent-[#60A5FA]" />
              <span className="font-semibold">Plano Off-Peak (horário restrito)</span>
            </label>
            <p className="text-[11px] text-white/50 mt-1 ml-6">
              Fora da janela, o cliente pode agendar mas será cobrado avulso (não consome o plano).
            </p>

            {form.off_peak_enabled && (
              <div className="mt-3 ml-6 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 block mb-1">Início</label>
                    <input type="time" value={form.off_peak_start || '08:00'}
                      onChange={e => setForm(p => ({ ...p, off_peak_start: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 block mb-1">Fim</label>
                    <input type="time" value={form.off_peak_end || '12:00'}
                      onChange={e => setForm(p => ({ ...p, off_peak_end: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/60 block mb-1">Dias permitidos</label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map(d => {
                      const active = (form.off_peak_weekdays || []).includes(d.v);
                      return (
                        <button key={d.v} type="button"
                          onClick={() => setForm(p => {
                            const cur = p.off_peak_weekdays || [];
                            return { ...p, off_peak_weekdays: cur.includes(d.v) ? cur.filter(x => x !== d.v) : [...cur, d.v].sort() };
                          })}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${active ? 'bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white border-[#60A5FA] shadow-[0_4px_12px_rgba(37,99,235,0.4)]' : 'bg-white/[0.04] text-white/70 border-white/10 hover:border-[#60A5FA]/40 hover:bg-white/[0.08]'}`}>
                          {d.l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer text-white/85">
            <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} className="accent-[#60A5FA]" />
            <span>Plano ativo (disponível para venda)</span>
          </label>
        </div>
    </StandardModal>
  );
}