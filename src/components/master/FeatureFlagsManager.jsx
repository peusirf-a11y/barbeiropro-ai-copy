// Gerenciador de feature flags globais (Master).
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ToggleLeft, ToggleRight, Plus, X } from 'lucide-react';
import { clearFeatureFlagCache } from '@/lib/featureFlags';

export default function FeatureFlagsManager() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: '', description: '', enabled: true });

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => base44.entities.FeatureFlag.list('-created_date', 100),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }) => base44.entities.FeatureFlag.update(id, { enabled }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['feature-flags'] }); clearFeatureFlagCache(); },
  });

  const create = useMutation({
    mutationFn: (data) => base44.entities.FeatureFlag.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feature-flags'] });
      clearFeatureFlagCache();
      setShowForm(false);
      setForm({ key: '', description: '', enabled: true });
    },
  });

  return (
    <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-black/8 flex items-center justify-between gap-3">
        <h2 className="font-bold text-[#1B1C1E]">Feature flags globais</h2>
        <button onClick={() => setShowForm(true)} className="text-xs font-semibold px-3 py-1.5 bg-[#2563EB] text-white rounded-lg hover:bg-[#1d4ed8] flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Nova flag
        </button>
      </div>
      <div className="divide-y divide-black/5">
        {isLoading && <div className="p-6 text-center text-sm text-gray-400">Carregando…</div>}
        {!isLoading && flags.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">Nenhuma flag cadastrada.</div>
        )}
        {flags.map(f => (
          <div key={f.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-sm text-[#1B1C1E]">{f.key}</div>
              {f.description && <div className="text-xs text-gray-500 mt-0.5">{f.description}</div>}
            </div>
            <button
              onClick={() => toggle.mutate({ id: f.id, enabled: !f.enabled })}
              className="flex items-center gap-1.5 text-sm font-semibold flex-shrink-0"
            >
              {f.enabled !== false
                ? <><ToggleRight className="w-7 h-7 text-green-500" /><span className="text-green-600 text-xs">ON</span></>
                : <><ToggleLeft className="w-7 h-7 text-gray-300" /><span className="text-gray-400 text-xs">OFF</span></>}
            </button>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#1B1C1E]">Nova feature flag</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Chave *</label>
                <input value={form.key} onChange={e => setForm(p => ({ ...p, key: e.target.value.replace(/\s+/g, '_').toLowerCase() }))} className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm font-mono" placeholder="ex: ai_growth" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Descrição</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.enabled} onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))} />
                Habilitada
              </label>
            </div>
            <button onClick={() => create.mutate(form)} disabled={!form.key || create.isPending} className="w-full mt-5 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              {create.isPending ? 'Criando…' : 'Criar flag'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}