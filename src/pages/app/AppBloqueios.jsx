import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useState } from 'react';
import { Plus, X, Lock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EmptyState from '@/components/EmptyState';
import { SkeletonPage } from '@/components/Skeletons';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import { filterByUnit, filterProfessionalsByUnit } from '@/lib/unitFilter';

const emptyForm = {
  mode: 'once',           // 'once' | 'recurring'
  professional_id: '',
  start_time: '',
  end_time: '',
  weekday: 1,             // 0=dom ... 6=sab
  time_start: '12:00',
  time_end: '13:00',
  reason: '',
};

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function AppBloqueios() {
  const { companyId, isLoading: loadingCompany } = useCompany();
  const { activeUnitId, isMultiUnit } = useActiveUnit();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  const { data: blocksRaw = [], isLoading } = useQuery({
    queryKey: ['blocks', companyId],
    queryFn: () => base44.entities.BlockedTime.filter({ company_id: companyId }, '-start_time', 200),
    enabled: !!companyId,
  });

  const { data: professionalsRaw = [] } = useQuery({
    queryKey: ['professionals', companyId],
    queryFn: () => base44.entities.Professional.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });

  // Filtra por unidade ativa
  const blocks = filterByUnit(blocksRaw, activeUnitId, isMultiUnit);
  const professionals = filterProfessionalsByUnit(professionalsRaw, activeUnitId, isMultiUnit);

  const createMutation = useMutation({
    mutationFn: (data) => {
      const payload = data.mode === 'recurring'
        ? {
            company_id: companyId,
            unit_id: activeUnitId || undefined,
            professional_id: data.professional_id || undefined,
            recurring: true,
            weekday: Number(data.weekday),
            time_start: data.time_start,
            time_end: data.time_end,
            reason: data.reason,
          }
        : {
            company_id: companyId,
            unit_id: activeUnitId || undefined,
            professional_id: data.professional_id || undefined,
            recurring: false,
            start_time: data.start_time,
            end_time: data.end_time,
            reason: data.reason,
          };
      return base44.entities.BlockedTime.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', companyId] });
      setShowForm(false);
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BlockedTime.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blocks', companyId] }),
  });

  const proName = (id) => professionals.find(p => p.id === id)?.name || 'Toda a barbearia';

  const handleCreate = () => {
    if (form.mode === 'recurring') {
      if (!form.time_start || !form.time_end) return;
      if (form.time_end <= form.time_start) {
        alert('O horário de fim deve ser depois do início.');
        return;
      }
    } else {
      if (!form.start_time || !form.end_time) return;
      if (new Date(form.end_time) <= new Date(form.start_time)) {
        alert('O horário de fim deve ser depois do início.');
        return;
      }
    }
    createMutation.mutate(form);
  };

  if (loadingCompany || isLoading) {
    return <AppLayout><SkeletonPage /></AppLayout>;
  }

  const now = new Date();
  // Recorrentes sempre ficam no topo (estão sempre "ativos")
  const recurring = blocks.filter(b => b.recurring);
  const oneShot = blocks.filter(b => !b.recurring);
  const upcoming = oneShot.filter(b => b.end_time && new Date(b.end_time) >= now);
  const past = oneShot.filter(b => b.end_time && new Date(b.end_time) < now);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Bloqueios de horário"
          subtitle="Almoço, folgas, eventos — horários indisponíveis para agendamento"
          icon={Lock}
        >
          <PrimaryButton onClick={() => setShowForm(true)}>Novo bloqueio</PrimaryButton>
        </AppPageHeader>

        {blocks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/8">
            <EmptyState
              icon={Lock}
              title="Nenhum bloqueio criado"
              description="Crie bloqueios para horários indisponíveis (almoço, folga, evento). Eles serão respeitados na agenda e no link público."
              action={
                <button onClick={() => setShowForm(true)} className="bg-[#2563EB] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#1d4ed8]">
                  Criar primeiro bloqueio
                </button>
              }
            />
          </div>
        ) : (
          <div className="space-y-6">
            {recurring.length > 0 && (
              <BlockList title="Bloqueios recorrentes (semanais)" items={recurring} proName={proName} onDelete={(id) => deleteMutation.mutate(id)} />
            )}
            <BlockList title="Próximos / Atuais" items={upcoming} proName={proName} onDelete={(id) => deleteMutation.mutate(id)} />
            {past.length > 0 && <BlockList title="Histórico" items={past} proName={proName} onDelete={(id) => deleteMutation.mutate(id)} muted />}
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-[#0F172A]">Novo bloqueio</h3>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                {/* Tipo de bloqueio */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, mode: 'once' }))}
                    className={`text-sm font-semibold py-2 rounded-lg transition-all ${form.mode === 'once' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'}`}
                  >
                    Único
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, mode: 'recurring' }))}
                    className={`text-sm font-semibold py-2 rounded-lg transition-all ${form.mode === 'recurring' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'}`}
                  >
                    Semanal recorrente
                  </button>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Profissional</label>
                  <select value={form.professional_id} onChange={e => setForm(p => ({ ...p, professional_id: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm">
                    <option value="">Toda a barbearia</option>
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                {form.mode === 'once' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Início *</label>
                      <input type="datetime-local" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Fim *</label>
                      <input type="datetime-local" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Dia da semana *</label>
                      <select value={form.weekday} onChange={e => setForm(p => ({ ...p, weekday: Number(e.target.value) }))}
                        className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm">
                        {WEEKDAY_LABELS.map((label, i) => (
                          <option key={i} value={i}>Toda {label.toLowerCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">Início *</label>
                        <input type="time" value={form.time_start} onChange={e => setForm(p => ({ ...p, time_start: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">Fim *</label>
                        <input type="time" value={form.time_end} onChange={e => setForm(p => ({ ...p, time_end: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
                      </div>
                    </div>
                    <div className="text-[11px] text-[#6B7280] bg-[#FAFBFC] border border-black/5 rounded-lg p-2.5">
                      Se aplicará automaticamente toda semana neste dia e horário.
                    </div>
                  </>
                )}

                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Motivo</label>
                  <input type="text" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                    placeholder="Ex: Almoço, Folga, Evento"
                    className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium">Cancelar</button>
                <button onClick={handleCreate}
                  disabled={
                    createMutation.isPending ||
                    (form.mode === 'once' ? (!form.start_time || !form.end_time) : (!form.time_start || !form.time_end))
                  }
                  className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50">
                  {createMutation.isPending ? 'Salvando...' : 'Bloquear'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

const WEEKDAY_SHORT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function BlockList({ title, items, proName, onDelete, muted }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="px-5 py-3 border-b border-black/5 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] bg-[#FAFBFC]">{title}</div>
      <div className="divide-y divide-black/5">
        {items.map(b => {
          const isRec = !!b.recurring;
          const description = isRec
            ? `${proName(b.professional_id)} · Toda ${WEEKDAY_SHORT[b.weekday] || ''} das ${b.time_start} às ${b.time_end}`
            : `${proName(b.professional_id)} · ${format(new Date(b.start_time), "d MMM HH:mm", { locale: ptBR })} → ${format(new Date(b.end_time), "d MMM HH:mm", { locale: ptBR })}`;
          return (
            <div key={b.id} className={`flex items-center gap-4 p-4 hover:bg-[#FAFBFC] transition-colors ${muted ? 'opacity-60' : ''}`}>
              <div className="w-9 h-9 bg-[#EFF6FF] ring-1 ring-[#DBEAFE] rounded-xl flex items-center justify-center flex-shrink-0">
                <Lock className="w-4 h-4 text-[#2563EB]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-sm text-[#111827] truncate">{b.reason || 'Bloqueado'}</div>
                  {isRec && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">Semanal</span>}
                </div>
                <div className="text-xs text-[#6B7280] truncate mt-0.5">{description}</div>
              </div>
              <button onClick={() => { if (confirm('Remover bloqueio?')) onDelete(b.id); }} className="text-gray-300 hover:text-red-500 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}