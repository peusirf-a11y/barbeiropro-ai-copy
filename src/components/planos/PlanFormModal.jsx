import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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
};

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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-[#111827] text-lg">{plan ? 'Editar plano' : 'Novo plano'}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Nome do plano *</label>
            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Ex: 2 cortes/mês, VIP Ilimitado"
              className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Descrição</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
              className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Valor mensal (R$) *</label>
              <input type="number" min="0" step="0.01" value={form.price_monthly}
                onChange={e => setForm(p => ({ ...p, price_monthly: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Tipo *</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm bg-white">
                <option value="limited">Limitado</option>
                <option value="unlimited">Ilimitado</option>
              </select>
            </div>
          </div>

          {form.type === 'limited' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Quantidade de usos por mês *</label>
              <input type="number" min="1" value={form.usage_limit || ''}
                onChange={e => setForm(p => ({ ...p, usage_limit: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-2">Serviços inclusos</label>
            <p className="text-[11px] text-gray-400 mb-2">Deixe nenhum marcado para incluir todos os serviços.</p>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {services.map(s => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 hover:bg-gray-50 rounded-lg">
                  <input type="checkbox" checked={form.service_ids.includes(s.id)} onChange={() => toggleService(s.id)} />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          {isMultiUnit && units?.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-2">Unidades onde vale</label>
              <p className="text-[11px] text-gray-400 mb-2">Deixe nenhuma marcada para valer em todas.</p>
              <div className="grid grid-cols-2 gap-2">
                {units.map(u => (
                  <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 hover:bg-gray-50 rounded-lg">
                    <input type="checkbox" checked={form.valid_in_units.includes(u.id)} onChange={() => toggleUnit(u.id)} />
                    <span className="truncate">{u.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.rollover} onChange={e => setForm(p => ({ ...p, rollover: e.target.checked }))} />
            <span>Acumula usos não utilizados para o próximo mês</span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
            <span>Plano ativo (disponível para venda)</span>
          </label>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium">Cancelar</button>
          <button onClick={handleSubmit} disabled={!form.name || !form.price_monthly || isSaving}
            className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50">
            {isSaving ? 'Salvando...' : plan ? 'Salvar' : 'Criar plano'}
          </button>
        </div>
      </div>
    </div>
  );
}