// CRUD de Planos (Master). Permite criar, editar, ativar/desativar e excluir planos.
// Os campos seguem a entity Plan: name, price_monthly, stripe_price_id, features, limits.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, X, Edit2, Trash2, ToggleLeft, ToggleRight, Package } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const FEATURE_OPTIONS = [
  { key: 'financial', label: 'Financeiro' },
  { key: 'commissions', label: 'Comissões' },
  { key: 'reports', label: 'Relatórios' },
  { key: 'ai_growth', label: 'AI Growth' },
  { key: 'whatsapp_automation', label: 'WhatsApp automático' },
  { key: 'reviews', label: 'Avaliações' },
  { key: 'referrals', label: 'Indique e ganhe' },
  { key: 'cash_register', label: 'Caixa' },
  { key: 'combos', label: 'Combos' },
];

const emptyForm = {
  name: '',
  price_monthly: 0,
  stripe_price_id: '',
  active: true,
  sort_order: 0,
  features: [],
  limits: { barbers: 0, appointments_month: 0, storage_mb: 0 },
};

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
      features: Array.isArray(p.features) ? p.features : [],
      limits: {
        barbers: p.limits?.barbers || 0,
        appointments_month: p.limits?.appointments_month || 0,
        storage_mb: p.limits?.storage_mb || 0,
      },
    });
    setShowForm(true);
  };

  const toggleFeature = (key) => {
    setForm(p => ({
      ...p,
      features: p.features.includes(key)
        ? p.features.filter(f => f !== key)
        : [...p.features, key],
    }));
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
    <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="p-4 sm:p-5 border-b border-black/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] ring-1 ring-[#DBEAFE] flex items-center justify-center">
            <Package className="w-4 h-4 text-[#2563EB]" />
          </div>
          <h2 className="font-bold text-[#111827] text-lg tracking-tight">Planos da plataforma</h2>
        </div>
        <button
          onClick={openCreate}
          className="text-xs font-semibold px-3 py-2 bg-[#2563EB] text-white rounded-xl hover:bg-[#1d4ed8] flex items-center gap-1.5 shadow-[0_4px_12px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Novo plano
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-black/5 bg-[#FAFBFC]">
              {['Plano', 'Preço/mês', 'Stripe Price', 'Limites', 'Features', 'Status', 'Ações'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-[#6B7280] text-sm">Carregando…</td></tr>
            )}
            {!isLoading && plans.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-[#6B7280] text-sm">Nenhum plano cadastrado.</td></tr>
            )}
            {plans.map(p => (
              <tr key={p.id} className="border-b border-black/5 hover:bg-[#FAFBFC] transition-colors">
                <td className="px-4 py-3">
                  <div className="font-semibold text-sm text-[#111827]">{p.name}</div>
                  <div className="text-[11px] text-[#6B7280] mt-0.5">Ordem: {p.sort_order || 0}</div>
                </td>
                <td className="px-4 py-3 text-sm font-bold text-[#111827]">{fmtMoney(p.price_monthly)}</td>
                <td className="px-4 py-3 text-xs font-mono text-[#6B7280] truncate max-w-[140px]">{p.stripe_price_id || '–'}</td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">
                  <div>{p.limits?.barbers ? `${p.limits.barbers} barbeiros` : '∞ barbeiros'}</div>
                  <div>{p.limits?.appointments_month ? `${p.limits.appointments_month} ag/mês` : '∞ agend./mês'}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {(p.features || []).slice(0, 3).map(f => (
                      <span key={f} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]">{f}</span>
                    ))}
                    {(p.features || []).length > 3 && (
                      <span className="text-[10px] text-[#6B7280]">+{p.features.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle.mutate({ id: p.id, active: !p.active })} title={p.active !== false ? 'Desativar' : 'Ativar'}>
                    {p.active !== false
                      ? <ToggleRight className="w-7 h-7 text-emerald-500" />
                      : <ToggleLeft className="w-7 h-7 text-gray-300" />}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1.5 text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Excluir plano "${p.name}"?`)) remove.mutate(p.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-[var(--shadow-xl)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-[#111827] text-lg tracking-tight">{editing ? 'Editar plano' : 'Novo plano'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#6B7280] block mb-1.5">Nome *</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-black/10 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#6B7280] block mb-1.5">Preço mensal (R$) *</label>
                  <input type="number" min="0" step="0.01" value={form.price_monthly} onChange={e => setForm(p => ({ ...p, price_monthly: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-black/10 rounded-xl text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#6B7280] block mb-1.5">Stripe Price ID</label>
                  <input value={form.stripe_price_id} onChange={e => setForm(p => ({ ...p, stripe_price_id: e.target.value }))}
                    placeholder="price_..."
                    className="w-full px-3 py-2.5 border border-black/10 rounded-xl text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#6B7280] block mb-1.5">Ordem de exibição</label>
                  <input type="number" min="0" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-black/10 rounded-xl text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#6B7280] block mb-2">Limites</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-[#6B7280] block mb-1">Barbeiros</label>
                    <input type="number" min="0" value={form.limits.barbers}
                      onChange={e => setForm(p => ({ ...p, limits: { ...p.limits, barbers: e.target.value } }))}
                      className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#6B7280] block mb-1">Ag/mês</label>
                    <input type="number" min="0" value={form.limits.appointments_month}
                      onChange={e => setForm(p => ({ ...p, limits: { ...p.limits, appointments_month: e.target.value } }))}
                      className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#6B7280] block mb-1">Storage MB</label>
                    <input type="number" min="0" value={form.limits.storage_mb}
                      onChange={e => setForm(p => ({ ...p, limits: { ...p.limits, storage_mb: e.target.value } }))}
                      className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm" />
                  </div>
                </div>
                <p className="text-[10px] text-[#6B7280] mt-1">Use 0 para ilimitado.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#6B7280] block mb-2">Features</label>
                <div className="grid grid-cols-2 gap-2">
                  {FEATURE_OPTIONS.map(opt => {
                    const checked = form.features.includes(opt.key);
                    return (
                      <button key={opt.key} type="button" onClick={() => toggleFeature(opt.key)}
                        className={`text-left text-xs font-medium px-3 py-2 rounded-lg border transition-all ${checked ? 'bg-[#EFF6FF] border-[#2563EB]/40 text-[#2563EB]' : 'bg-white border-black/10 text-[#6B7280] hover:border-[#2563EB]/30'}`}>
                        {checked ? '✓ ' : ''}{opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-[#111827]">
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                Plano ativo (disponível para novos clientes)
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-black/10 rounded-xl text-sm font-semibold text-[#111827] hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={!form.name || upsert.isPending}
                className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 shadow-[0_4px_12px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all">
                {upsert.isPending ? 'Salvando…' : (editing ? 'Salvar alterações' : 'Criar plano')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}