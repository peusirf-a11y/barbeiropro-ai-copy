// CRUD de Planos (Master). Permite criar, editar, ativar/desativar e excluir planos.
// Os campos seguem a entity Plan: name, price_monthly, stripe_price_id, features, limits.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Package } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import StandardModal from '@/components/ui/standard-modal';
import FeatureToggleGrid from '@/components/master/FeatureToggleGrid';
import { canonicalFeatureKey } from '@/lib/featureCatalog';
import PlanVisibilityControl from '@/components/planos/PlanVisibilityControl';
import PlanInviteGenerator from '@/components/planos/PlanInviteGenerator';
import CompanyMultiSelect from '@/components/master/CompanyMultiSelect';
import { Globe, Lock, Link2 } from 'lucide-react';

const emptyForm = {
  name: '',
  price_monthly: 0,
  stripe_price_id: '',
  active: true,
  sort_order: 0,
  features: [],
  limits: { barbers: 0, appointments_month: 0, storage_mb: 0 },
  visibility: 'public',
  allowed_company_ids: [],
};

const VISIBILITY_BADGE = {
  public:      { icon: Globe, label: 'Público',     cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  private:     { icon: Lock,  label: 'Privado',     cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  invite_only: { icon: Link2, label: 'Por convite', cls: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
};

function VisibilityBadge({ v }) {
  const conf = VISIBILITY_BADGE[v || 'public'];
  const Icon = conf.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${conf.cls}`}>
      <Icon className="w-2.5 h-2.5" /> {conf.label}
    </span>
  );
}

const fmtMoney = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PlansManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['master-plans'],
    queryFn: () => base44.entities.Plan.list('sort_order', 100),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['master-plans'] });

  const upsert = useMutation({
    mutationFn: async (data) => {
      if (editing) return base44.entities.Plan.update(editing.id, data);
      return base44.entities.Plan.create(data);
    },
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? 'Plano atualizado' : 'Plano criado' });
    },
    onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }) => base44.entities.Plan.update(id, { active }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.Plan.delete(id),
    onSuccess: invalidate,
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name || '',
      price_monthly: p.price_monthly || 0,
      stripe_price_id: p.stripe_price_id || '',
      active: p.active !== false,
      sort_order: p.sort_order || 0,
      // Migra keys legadas para as canônicas ao abrir
      features: (Array.isArray(p.features) ? p.features : []).map(canonicalFeatureKey),
      limits: {
        barbers: p.limits?.barbers || 0,
        appointments_month: p.limits?.appointments_month || 0,
        storage_mb: p.limits?.storage_mb || 0,
      },
      visibility: p.visibility || 'public',
      allowed_company_ids: Array.isArray(p.allowed_company_ids) ? p.allowed_company_ids : [],
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    upsert.mutate({
      ...form,
      price_monthly: Number(form.price_monthly) || 0,
      sort_order: Number(form.sort_order) || 0,
      limits: {
        barbers: Number(form.limits.barbers) || 0,
        appointments_month: Number(form.limits.appointments_month) || 0,
        storage_mb: Number(form.limits.storage_mb) || 0,
      },
    });
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 ring-1 ring-blue-500/30 flex items-center justify-center">
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <h2 className="font-bold text-foreground text-lg tracking-tight">Planos da plataforma</h2>
        </div>
        <button
          onClick={openCreate}
          className="text-xs font-semibold px-3 py-2 bg-[#2563EB] text-white rounded-xl hover:bg-[#1d4ed8] flex items-center gap-1.5 shadow-[0_4px_12px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Novo plano
        </button>
      </div>

      {/* Mobile: cards. Desktop: tabela. Evita scroll horizontal no celular. */}
      <div className="md:hidden divide-y divide-border">
        {isLoading && (
          <div className="px-4 py-12 text-center text-muted-foreground text-sm">Carregando…</div>
        )}
        {!isLoading && plans.length === 0 && (
          <div className="px-4 py-12 text-center text-muted-foreground text-sm">Nenhum plano cadastrado.</div>
        )}
        {plans.map(p => (
          <div key={p.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-sm text-foreground truncate">{p.name}</div>
                <div className="mt-1"><VisibilityBadge v={p.visibility} /></div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Ordem: {p.sort_order || 0}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-base font-bold text-foreground">{fmtMoney(p.price_monthly)}</div>
                <div className="text-[10px] text-muted-foreground">/mês</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <div className="bg-muted/40 rounded-lg px-2.5 py-2">
                <div className="font-semibold text-foreground">
                  {p.limits?.barbers ? p.limits.barbers : '∞'}
                </div>
                <div>barbeiros</div>
              </div>
              <div className="bg-muted/40 rounded-lg px-2.5 py-2">
                <div className="font-semibold text-foreground">
                  {p.limits?.appointments_month ? p.limits.appointments_month : '∞'}
                </div>
                <div>agend./mês</div>
              </div>
            </div>

            {(p.features || []).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(p.features || []).slice(0, 4).map(f => (
                  <span key={f} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30">{f}</span>
                ))}
                {(p.features || []).length > 4 && (
                  <span className="text-[10px] text-muted-foreground self-center">+{p.features.length - 4}</span>
                )}
              </div>
            )}

            {p.stripe_price_id && (
              <div className="text-[10px] font-mono text-muted-foreground truncate">{p.stripe_price_id}</div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button onClick={() => toggle.mutate({ id: p.id, active: !p.active })} className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                {p.active !== false
                  ? <><ToggleRight className="w-6 h-6 text-emerald-500" /> Ativo</>
                  : <><ToggleLeft className="w-6 h-6 text-muted-foreground" /> Inativo</>}
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(p)}
                  className="p-2 text-blue-500 hover:bg-blue-500/15 rounded-lg transition-colors"
                  aria-label="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { if (confirm(`Excluir plano "${p.name}"?`)) remove.mutate(p.id); }}
                  className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  aria-label="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {['Plano', 'Preço/mês', 'Stripe Price', 'Limites', 'Features', 'Status', 'Ações'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">Carregando…</td></tr>
            )}
            {!isLoading && plans.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">Nenhum plano cadastrado.</td></tr>
            )}
            {plans.map(p => (
              <tr key={p.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-sm text-foreground">{p.name}</div>
                    <VisibilityBadge v={p.visibility} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Ordem: {p.sort_order || 0}</div>
                </td>
                <td className="px-4 py-3 text-sm font-bold text-foreground">{fmtMoney(p.price_monthly)}</td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground truncate max-w-[140px]">{p.stripe_price_id || '–'}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  <div>{p.limits?.barbers ? `${p.limits.barbers} barbeiros` : '∞ barbeiros'}</div>
                  <div>{p.limits?.appointments_month ? `${p.limits.appointments_month} ag/mês` : '∞ agend./mês'}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {(p.features || []).slice(0, 3).map(f => (
                      <span key={f} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30">{f}</span>
                    ))}
                    {(p.features || []).length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{p.features.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle.mutate({ id: p.id, active: !p.active })} title={p.active !== false ? 'Desativar' : 'Ativar'}>
                    {p.active !== false
                      ? <ToggleRight className="w-7 h-7 text-emerald-500" />
                      : <ToggleLeft className="w-7 h-7 text-muted-foreground" />}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1.5 text-blue-500 hover:bg-blue-500/15 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Excluir plano "${p.name}"?`)) remove.mutate(p.id); }}
                      className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StandardModal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Editar plano' : 'Novo plano'}
        size="lg"
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={!form.name || upsert.isPending}
              className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 shadow-[0_4px_12px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all">
              {upsert.isPending ? 'Salvando…' : (editing ? 'Salvar alterações' : 'Criar plano')}
            </button>
          </>
        }
      >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Nome *</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Preço mensal (R$) *</label>
                  <input type="number" min="0" step="0.01" value={form.price_monthly} onChange={e => setForm(p => ({ ...p, price_monthly: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Stripe Price ID</label>
                  <input value={form.stripe_price_id} onChange={e => setForm(p => ({ ...p, stripe_price_id: e.target.value }))}
                    placeholder="price_..."
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm font-mono bg-background text-foreground" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Ordem de exibição</label>
                  <input type="number" min="0" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-2">Limites</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Barbeiros</label>
                    <input type="number" min="0" value={form.limits.barbers}
                      onChange={e => setForm(p => ({ ...p, limits: { ...p.limits, barbers: e.target.value } }))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Ag/mês</label>
                    <input type="number" min="0" value={form.limits.appointments_month}
                      onChange={e => setForm(p => ({ ...p, limits: { ...p.limits, appointments_month: e.target.value } }))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Storage MB</label>
                    <input type="number" min="0" value={form.limits.storage_mb}
                      onChange={e => setForm(p => ({ ...p, limits: { ...p.limits, storage_mb: e.target.value } }))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Use 0 para ilimitado.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-2">Features liberadas no plano</label>
                <FeatureToggleGrid
                  value={form.features}
                  onChange={(features) => setForm(p => ({ ...p, features }))}
                />
              </div>

              <PlanVisibilityControl
                value={form.visibility}
                onChange={(v) => setForm(p => ({ ...p, visibility: v }))}
                variant="light"
              />

              {form.visibility === 'private' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                    Empresas autorizadas
                  </label>
                  <CompanyMultiSelect
                    value={form.allowed_company_ids || []}
                    onChange={(ids) => setForm(p => ({ ...p, allowed_company_ids: ids }))}
                    variant="light"
                    placeholder="Buscar empresa por nome ou slug…"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Apenas estas empresas conseguirão ver/contratar este plano. A busca aceita nome ou slug; gravamos o ID internamente.
                  </p>
                </div>
              )}

              {form.visibility === 'invite_only' && editing && (
                <div className="flex items-center justify-between gap-3 border border-blue-400/30 bg-blue-500/10 rounded-xl p-3">
                  <div className="text-xs text-foreground">
                    Gere um link privado de convite para liberar este plano a tenants específicos.
                  </div>
                  <PlanInviteGenerator
                    planId={editing.id}
                    entity="Plan"
                    publicBaseUrl="/planos/convite/"
                    variant="light"
                  />
                </div>
              )}
              {form.visibility === 'invite_only' && !editing && (
                <p className="text-[11px] text-amber-600">Salve o plano primeiro para gerar o link de convite.</p>
              )}

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                Plano ativo (disponível para novos clientes)
              </label>
            </div>
      </StandardModal>
    </div>
  );
}