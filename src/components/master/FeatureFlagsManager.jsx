// Gerenciador de feature flags globais/por plano/por empresa (Master).
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ToggleLeft, ToggleRight, Plus, X, Trash2, Globe, Briefcase, Building2, Sparkles, CheckCircle2 } from 'lucide-react';
import { clearFeatureFlagCache } from '@/lib/featureFlags';
import { useToast } from '@/components/ui/use-toast';

const scopeMeta = {
  global: { icon: Globe, label: 'Global', color: 'text-blue-500 bg-blue-500/15 border border-blue-500/30' },
  plan: { icon: Briefcase, label: 'Plano', color: 'text-violet-500 bg-violet-500/15 border border-violet-500/30' },
  company: { icon: Building2, label: 'Empresa', color: 'text-amber-500 bg-amber-500/15 border border-amber-500/30' },
};

const emptyForm = { key: '', description: '', enabled: true, scope: 'global', target_ids: [] };

export default function FeatureFlagsManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [targetInput, setTargetInput] = useState('');
  const [toggleNotice, setToggleNotice] = useState('');

  const { data: rawFlags = [], isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => base44.entities.FeatureFlag.list('-created_date', 200),
  });

  // Deduplica por key para evitar entradas duplicadas entre seed local e banco remoto
  const flags = Array.isArray(rawFlags)
    ? Array.from(
        rawFlags.reduce((acc, item) => {
          const k = item?.key || item?.id;
          if (k && !acc.has(k)) acc.set(k, item);
          return acc;
        }, new Map()).values()
      )
    : [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['feature-flags'] });
    clearFeatureFlagCache();
  };

  const toggle = useMutation({
    mutationFn: ({ id, enabled, key }) => base44.entities.FeatureFlag.update(id, { enabled, key }),
    onMutate: async (variables) => {
      qc.setQueryData(['feature-flags'], (old = []) => {
        const list = Array.isArray(old) ? old : [];
        return list.map((f) =>
          f.id === variables.id || (variables.key && f.key === variables.key)
            ? { ...f, enabled: variables.enabled }
            : f
        );
      });
    },
    onSuccess: (_data, variables) => {
      qc.setQueryData(['feature-flags'], (old = []) => {
        const list = Array.isArray(old) ? old : [];
        return list.map((f) =>
          f.id === variables.id || (variables.key && f.key === variables.key)
            ? { ...f, enabled: variables.enabled }
            : f
        );
      });
      invalidate();
      const msg = `Feature flag "${variables.key || variables.id}" ${variables.enabled ? 'ativada (ON)' : 'desativada (OFF)'} com sucesso.`;
      setToggleNotice(msg);
      toast({
        title: 'Feature flag atualizada',
        description: msg,
      });
    },
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.FeatureFlag.delete(id),
    onSuccess: () => {
      invalidate();
      setToggleNotice('Feature flag removida com sucesso.');
    },
  });

  const create = useMutation({
    mutationFn: (data) => base44.entities.FeatureFlag.create(data),
    onSuccess: (createdFlag, variables) => {
      const flagKey = createdFlag?.key || variables?.key || 'nova-flag';
      const isEnabled = (createdFlag?.enabled ?? variables?.enabled) !== false;
      const newEntry = {
        id: createdFlag?.id || `ff-${Date.now()}`,
        key: flagKey,
        description: createdFlag?.description ?? variables?.description ?? '',
        enabled: isEnabled,
        scope: createdFlag?.scope || variables?.scope || 'global',
        target_ids: createdFlag?.target_ids || variables?.target_ids || [],
        created_date: createdFlag?.created_date || new Date().toISOString(),
      };
      qc.setQueryData(['feature-flags'], (old = []) => {
        const list = Array.isArray(old) ? old : [];
        return [newEntry, ...list.filter((f) => f.key !== flagKey)];
      });
      invalidate();
      setShowForm(false);
      setForm(emptyForm);
      setTargetInput('');
      const msg = `Feature flag "${flagKey}" criada com sucesso (${isEnabled ? 'Ativo / Habilitada' : 'Inativo'})!`;
      setToggleNotice(msg);
      toast({
        title: 'Feature flag criada com sucesso',
        description: msg,
      });
    },
  });

  const addTarget = () => {
    const t = targetInput.trim();
    if (!t || form.target_ids.includes(t)) return;
    setForm(p => ({ ...p, target_ids: [...p.target_ids, t] }));
    setTargetInput('');
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-foreground text-lg tracking-tight">Feature flags (Catálogo Experimental & Rollout)</h2>
          <p className="text-xs text-muted-foreground">Controle de funcionalidades experimentais, globais, por plano ou por barbearia.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="text-xs font-semibold px-3 py-2 bg-[#2563EB] text-white rounded-xl hover:bg-[#1d4ed8] flex items-center gap-1.5 shadow-[0_4px_12px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Nova flag
        </button>
      </div>

      {toggleNotice && (
        <div
          role="status"
          aria-live="polite"
          data-testid="feature-flag-toggle-notice"
          className="mx-4 mt-3 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-semibold flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
            <span>{toggleNotice}</span>
          </span>
          <button type="button" onClick={() => setToggleNotice('')} className="underline text-[11px]">
            Fechar
          </button>
        </div>
      )}

      <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
        {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>}
        {!isLoading && flags.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">Nenhuma flag cadastrada.</div>
        )}
        {flags.map(f => {
          const scope = f.scope || 'global';
          const meta = scopeMeta[scope] || scopeMeta.global;
          const Icon = meta.icon;
          const isExperimental =
            Boolean(f.experimental) ||
            String(f.stage || '').toLowerCase() === 'experimental' ||
            String(f.key || '').toLowerCase().includes('experimental') ||
            String(f.description || '').toLowerCase().includes('experimental');
          const isEnabled = f.enabled !== false;
          return (
            <div key={f.id || f.key} data-testid={`feature-flag-row-${f.key}`} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-foreground font-semibold">{f.key}</span>
                  {isExperimental && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-amber-500/15 text-amber-500 border border-amber-500/30">
                      <Sparkles className="w-3 h-3" /> Experimental
                    </span>
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${meta.color}`}>
                    <Icon className="w-3 h-3" /> {meta.label}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isEnabled ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                    {isEnabled ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {f.description && <div className="text-xs text-muted-foreground mt-0.5 truncate">{f.description}</div>}
                {scope !== 'global' && Array.isArray(f.target_ids) && f.target_ids.length > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate font-mono">
                    {f.target_ids.length} target(s): {f.target_ids.slice(0, 2).join(', ')}{f.target_ids.length > 2 ? '…' : ''}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  data-testid={`toggle-flag-${f.key}`}
                  aria-label={`Alternar flag ${f.key}`}
                  onClick={() => toggle.mutate({ id: f.id, enabled: !isEnabled, key: f.key })}
                  title={isEnabled ? 'Desativar' : 'Ativar'}
                  className="cursor-pointer inline-flex items-center gap-1"
                >
                  {isEnabled
                    ? <ToggleRight className="w-7 h-7 text-emerald-500" />
                    : <ToggleLeft className="w-7 h-7 text-muted-foreground" />}
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutate(f.id)}
                  className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-[var(--shadow-xl)] border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-foreground text-lg tracking-tight">Nova feature flag</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Chave *</label>
                <input
                  value={form.key}
                  onChange={e => setForm(p => ({ ...p, key: e.target.value.replace(/\s+/g, '-').toLowerCase() }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono bg-background text-foreground"
                  placeholder="ex: ai_growth ou explore-test-2026"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Descrição</label>
                <input
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Escopo</label>
                <select
                  value={form.scope}
                  onChange={e => setForm(p => ({ ...p, scope: e.target.value, target_ids: [] }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                >
                  <option value="global">Global (todos)</option>
                  <option value="plan">Por plano</option>
                  <option value="company">Por empresa</option>
                </select>
              </div>

              {form.scope !== 'global' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    {form.scope === 'plan' ? 'IDs de planos' : 'IDs de empresas'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={targetInput}
                      onChange={e => setTargetInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTarget(); } }}
                      className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono bg-background text-foreground"
                      placeholder="Cole o ID e Enter"
                    />
                    <button onClick={addTarget} type="button" className="px-3 py-2 bg-muted rounded-lg text-sm font-medium text-foreground">+</button>
                  </div>
                  {form.target_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.target_ids.map(id => (
                        <span key={id} className="inline-flex items-center gap-1 text-[11px] bg-muted rounded-md px-2 py-1 font-mono text-foreground">
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

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.enabled} onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))} />
                Habilitada
              </label>
            </div>
            <button
              onClick={() => create.mutate(form)}
              disabled={!form.key || create.isPending}
              className="w-full mt-6 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 shadow-[0_4px_12px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all"
            >
              {create.isPending ? 'Criando…' : 'Criar flag'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}