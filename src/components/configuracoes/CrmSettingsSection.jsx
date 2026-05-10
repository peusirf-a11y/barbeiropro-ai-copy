// Seção das configurações do CRM — janelas (em dias) usadas para classificar
// automaticamente o ciclo de vida dos clientes (em_risco / inativo / perdido)
// e o mínimo de atendimentos para "Cliente fiel".
//
// Os valores são salvos em Company.crm_settings e reaproveitados pela lib
// customerLifecycle (frontend) e pela function recomputeCustomerLifecycle (backend).

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Users, Save, RefreshCw } from 'lucide-react';
import { DEFAULT_CRM_SETTINGS } from '@/lib/customerLifecycle';

export default function CrmSettingsSection({ company }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState(() => ({
    fiel_min_appointments: DEFAULT_CRM_SETTINGS.fiel_min_appointments,
    em_risco_days: DEFAULT_CRM_SETTINGS.em_risco_days,
    inativo_days: DEFAULT_CRM_SETTINGS.inativo_days,
    perdido_days: DEFAULT_CRM_SETTINGS.perdido_days,
    ...(company?.crm_settings || {}),
  }));

  useEffect(() => {
    if (company?.crm_settings) {
      setForm({
        fiel_min_appointments: company.crm_settings.fiel_min_appointments ?? DEFAULT_CRM_SETTINGS.fiel_min_appointments,
        em_risco_days: company.crm_settings.em_risco_days ?? DEFAULT_CRM_SETTINGS.em_risco_days,
        inativo_days: company.crm_settings.inativo_days ?? DEFAULT_CRM_SETTINGS.inativo_days,
        perdido_days: company.crm_settings.perdido_days ?? DEFAULT_CRM_SETTINGS.perdido_days,
      });
    }
  }, [company?.id]);

  const saveMutation = useMutation({
    mutationFn: () => base44.entities.Company.update(company.id, { crm_settings: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'Configurações de CRM salvas!', description: 'A próxima recomputação usará os novos períodos.' });
    },
  });

  const recomputeMutation = useMutation({
    mutationFn: () => base44.functions.invoke('recomputeCustomerLifecycle', { company_id: company.id }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      const changed = res?.data?.changed ?? 0;
      const total = res?.data?.total ?? 0;
      toast({ title: 'Clientes recategorizados', description: `${changed} de ${total} clientes atualizados.` });
    },
    onError: (err) => {
      toast({ title: 'Erro ao recategorizar', description: err.message, variant: 'destructive' });
    },
  });

  const isValid =
    Number(form.em_risco_days) > 0 &&
    Number(form.inativo_days) > Number(form.em_risco_days) &&
    Number(form.perdido_days) > Number(form.inativo_days);

  const setNum = (key, val) => {
    const n = Math.max(0, Math.floor(Number(val) || 0));
    setForm(p => ({ ...p, [key]: n }));
  };

  if (!company) return null;

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-[#2563EB]" />
          </div>
          <div>
            <h2 className="font-bold text-[#111827]">CRM — Ciclo de vida dos clientes</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">Define quando um cliente entra em risco, fica inativo ou é considerado perdido.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        <Field label="✓ Cliente fiel a partir de" suffix="atend." value={form.fiel_min_appointments} onChange={(v) => setNum('fiel_min_appointments', v)} />
        <Field label="⚠️ Em risco após" suffix="dias" value={form.em_risco_days} onChange={(v) => setNum('em_risco_days', v)} />
        <Field label="💤 Inativo após" suffix="dias" value={form.inativo_days} onChange={(v) => setNum('inativo_days', v)} />
        <Field label="🚫 Perdido após" suffix="dias" value={form.perdido_days} onChange={(v) => setNum('perdido_days', v)} />
      </div>

      {!isValid && (
        <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
          As janelas devem ser crescentes: em risco &lt; inativo &lt; perdido (todas em dias e &gt; 0).
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!isValid || saveMutation.isPending}
          className="inline-flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 transition-all shadow-[0_4px_12px_rgba(37,99,235,0.2)]"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar períodos'}
        </button>
        <button
          onClick={() => recomputeMutation.mutate()}
          disabled={recomputeMutation.isPending}
          className="inline-flex items-center gap-2 bg-white border border-black/10 text-[#111827] px-4 py-2.5 rounded-xl text-sm font-semibold hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${recomputeMutation.isPending ? 'animate-spin' : ''}`} />
          {recomputeMutation.isPending ? 'Recategorizando...' : 'Recategorizar clientes agora'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, suffix, value, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500 block mb-1">{label}</span>
      <div className="flex items-center gap-2 px-3 py-2 border border-black/10 rounded-lg focus-within:ring-2 focus-within:ring-[#2563EB]/20">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent border-0 outline-none text-sm font-semibold text-[#111827]"
        />
        <span className="text-[11px] text-gray-400 font-medium">{suffix}</span>
      </div>
    </label>
  );
}