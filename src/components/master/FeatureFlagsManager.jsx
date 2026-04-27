// Gerenciador de feature flags globais/por plano/por empresa (Master).
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ToggleLeft, ToggleRight, Plus, X, Trash2, Globe, Briefcase, Building2 } from 'lucide-react';
import { clearFeatureFlagCache } from '@/lib/featureFlags';

const scopeMeta = {
  global: { icon: Globe, label: 'Global', color: 'text-[#2563EB] bg-[#2563EB]/10' },
  plan: { icon: Briefcase, label: 'Plano', color: 'text-purple-600 bg-purple-100' },
  company: { icon: Building2, label: 'Empresa', color: 'text-amber-600 bg-amber-100' },
};

const emptyForm = { key: '', description: '', enabled: true, scope: 'global', target_ids: [] };

export default function FeatureFlagsManager() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [targetInput, setTargetInput] = useState('');

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => base44.entities.FeatureFlag.list('-created_date', 200),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['feature-flags'] });
    clearFeatureFlagCache();
  };

  const toggle = useMutation({
    mutationFn: ({ id, enabled }) => base44.entities.FeatureFlag.update(id, { enabled }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.FeatureFlag.delete(id),
    onSuccess: invalidate,
  });

  const create = useMutation({
    mutationFn: (data) => base44.entities.FeatureFlag.create(data),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setForm(emptyForm);
      setTargetInput('');
    },
  });

  const addTarget = () => {
    const t = targetInput.trim();
    if (!t || form.target_ids.includes(t)) return;
    setForm(p => ({ ...p, target_ids: [...p.target_ids, t] }));
    setTargetInput('');
  };

  return (
    <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-black/8 flex items-center justify-between gap-3">
        <h2 className="font-bold text-[#1B1C1E]">Feature flags</h2>
        <button onClick={() => setShowForm(true)} className="text-xs font-semibold px-3 py-1.5 bg-[#2563EB] text-white rounded-lg hover:bg-[#1d4ed8] flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Nova flag
        </button>
      </div>
      <div className="divide-y divide-black/5 max-h-[480px] overflow-y-auto">
        {isLoading && <div className="p-6 text-center text-sm text-gray-400">Carregando…</div>}
        {!isLoading && flags.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">Nenhuma flag cadastrada.</div>
        )}
        {flags.map(f => {
          const scope = f.scope || 'global';
          const meta = scopeMeta[scope] || scopeMeta.global;
          const Icon = meta.icon;
          return (
            <div key={f.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-[#1B1C1E]">{f.key}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 ${meta.color}`}>
                    <Icon className="w-3 h-3" /> {meta.label}
                  </span>
                </div>
                {f.description && <div className="text-xs text-gray-500 mt-0.5 truncate">{f.description}</div>}
                {scope !== 'global' && Array.isArray(f.target_ids) && f.target_ids.length > 0 && (
                  <div className="text-[11px] text-gray-400 mt-0.5 truncate font-mono">
                    {f.target_ids.length} target(s): {f.target_ids.slice(0, 2).join(', ')}{f.target_ids.length > 2 ? '…' : ''}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggle.mutate({ id: f.id, enabled: !f.enabled })}
                  title={f.enabled !== false ? 'Desativar' : 'Ativar'}
                >
                  {f.enabled !== false
                    ? <ToggleRight className="w-7 h-7 text-green-500" />
                    : <ToggleLeft className="w-7 h-7 text-gray-300" />}
                </button>
                <button
                  onClick={() => { if (confirm(`Excluir flag "${f.key}"?`)) remove.mutate(f.id); }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#1B1C1E]">Nova feature flag</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Chave *</label>
                <input
                  value={form.key}
                  onChange={e => setForm(p => ({ ...p, key: e.target.value.replace(/\s+/g, '_').toLowerCase() }))}
                  className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm font-mono"
                  placeholder="ex: ai_growth"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Descrição</label>
                <input
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Escopo</label>
                <select
                  value={form.scope}
                  onChange={e => setForm(p => ({ ...p, scope: e.target.value, target_ids: [] }))}
                  className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm"
                >
                  <option value="global">Global (todos)</option>
                  <option value="plan">Por plano</option>
                  <option value="company">Por empresa</option>
                </select>
              </div>

              {form.scope !== 'global' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">
                    {form.scope === 'plan' ? 'IDs de planos' : 'IDs de empresas'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={targetInput}
                      onChange={e => setTargetInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTarget(); } }}
                      className="flex-1 px-3 py-2 border border-black/10 rounded-lg text-sm font-mono"
                      placeholder="Cole o ID e Enter"
                    />
                    <button onClick={addTarget} type="button" className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium">+</button>
                  </div>
                  {form.target_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.target_ids.map(id => (
                        <span key={id} className="inline-flex items-center gap-1 text-[11px] bg-gray-100 rounded-md px-2 py-1 font-mono">
                          {id}
                          <button onClick={() => setForm(p => ({ ...p, target_ids: p.target_ids.filter(t => t !== id) }))}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.enabled} onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))} />
                Habilitada
              </label>
            </div>
            <button
              onClick={() => create.mutate(form)}
              disabled={!form.key || create.isPending}
              className="w-full mt-5 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {create.isPending ? 'Criando…' : 'Criar flag'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}