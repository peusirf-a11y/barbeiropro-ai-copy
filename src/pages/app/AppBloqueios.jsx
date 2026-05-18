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
import StandardModal from '@/components/ui/standard-modal';
import FilterSelect from '@/components/ui/filter-select';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import { filterByUnit, filterProfessionalsByUnit } from '@/lib/unitFilter';
import AllUnitsNotice from '@/components/units/AllUnitsNotice';

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
  const { activeUnitId, isMultiUnit, isAllUnits } = useActiveUnit();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  const { data: blocksRaw = [], isLoading } = useQuery({
    queryKey: ['blocked-times', companyId, activeUnitId],
    queryFn: () => base44.entities.BlockedTime.filter({ company_id: companyId }, '-start_time', 200),
    enabled: !!companyId,
  });

  const { data: professionalsRaw = [] } = useQuery({
    queryKey: ['professionals', companyId, activeUnitId],
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
      queryClient.invalidateQueries({ queryKey: ['blocked-times'] });
      setShowForm(false);
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BlockedTime.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blocked-times'] }),
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
          {!isAllUnits && <PrimaryButton onClick={() => setShowForm(true)}>Novo bloqueio</PrimaryButton>}
        </AppPageHeader>

        {isAllUnits && (
          <AllUnitsNotice message="Visão consolidada de bloqueios de todas as unidades. Para criar um novo bloqueio, selecione uma unidade específica." />
        )}

        {blocks.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md">
            <EmptyState
              icon={Lock}
              title="Nenhum bloqueio criado"
              description="Crie bloqueios para horários indisponíveis (almoço, folga, evento). Eles serão respeitados na agenda e no link público."
              action={
                <button onClick={() => setShowForm(true)} className="bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:brightness-110 shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15 transition-all">
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

        <StandardModal
          open={showForm}
          onClose={() => setShowForm(false)}
          title="Novo bloqueio"
          footer={
            <>
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-white/10 rounded-lg text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">Cancelar</button>
              <button onClick={handleCreate}
                disabled={
                  createMutation.isPending ||
                  (form.mode === 'once' ? (!form.start_time || !form.end_time) : (!form.time_start || !form.time_end))
                }
                className="flex-1 px-4 py-2.5 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15 transition-all">
                {createMutation.isPending ? 'Salvando...' : 'Bloquear'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
                {/* Tipo de bloqueio */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.04] border border-white/8 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, mode: 'once' }))}
                    className={`text-sm font-semibold py-2 rounded-lg transition-all ${form.mode === 'once' ? 'bg-white/[0.08] text-white shadow-[0_2px_8px_rgba(0,0,0,0.3)] ring-1 ring-white/10' : 'text-white/55 hover:text-white/80'}`}
                  >
                    Único
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, mode: 'recurring' }))}
                    className={`text-sm font-semibold py-2 rounded-lg transition-all ${form.mode === 'recurring' ? 'bg-white/[0.08] text-white shadow-[0_2px_8px_rgba(0,0,0,0.3)] ring-1 ring-white/10' : 'text-white/55 hover:text-white/80'}`}
                  >
                    Semanal recorrente
                  </button>
                </div>

            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Profissional</label>
              <FilterSelect value={form.professional_id} onChange={(v) => setForm(p => ({ ...p, professional_id: v }))} className="w-full">
                <option value="">Toda a barbearia</option>
                {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </FilterSelect>
            </div>

                {form.mode === 'once' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-white/60 block mb-1">Início *</label>
                      <input type="datetime-local" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-white/60 block mb-1">Fim *</label>
                      <input type="datetime-local" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-white/60 block mb-1">Dia da semana *</label>
                      <FilterSelect value={String(form.weekday)} onChange={(v) => setForm(p => ({ ...p, weekday: Number(v) }))} className="w-full">
                        {WEEKDAY_LABELS.map((label, i) => (
                          <option key={i} value={String(i)}>Toda {label.toLowerCase()}</option>
                        ))}
                      </FilterSelect>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-white/60 block mb-1">Início *</label>
                        <input type="time" value={form.time_start} onChange={e => setForm(p => ({ ...p, time_start: e.target.value }))}
                          className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-white/60 block mb-1">Fim *</label>
                        <input type="time" value={form.time_end} onChange={e => setForm(p => ({ ...p, time_end: e.target.value }))}
                          className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                      </div>
                    </div>
                    <div className="text-[11px] text-white/55 bg-white/[0.025] border border-white/8 rounded-lg p-2.5">
                      Se aplicará automaticamente toda semana neste dia e horário.
                    </div>
                  </>
                )}

            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Motivo</label>
              <input type="text" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Ex: Almoço, Folga, Evento"
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
            </div>
          </div>
        </StandardModal>
      </div>
    </AppLayout>
  );
}

const WEEKDAY_SHORT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function BlockList({ title, items, proName, onDelete, muted }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden">
      <div className="px-5 py-3 border-b border-white/8 text-[11px] font-semibold uppercase tracking-wider text-white/55 bg-white/[0.02]">{title}</div>
      <div className="divide-y divide-white/5">
        {items.map(b => {
          const isRec = !!b.recurring;
          const description = isRec
            ? `${proName(b.professional_id)} · Toda ${WEEKDAY_SHORT[b.weekday] || ''} das ${b.time_start} às ${b.time_end}`
            : `${proName(b.professional_id)} · ${format(new Date(b.start_time), "d MMM HH:mm", { locale: ptBR })} → ${format(new Date(b.end_time), "d MMM HH:mm", { locale: ptBR })}`;
          return (
            <div key={b.id} className={`flex items-center gap-4 p-4 hover:bg-white/[0.04] transition-colors ${muted ? 'opacity-55' : ''}`}>
              <div className="relative w-9 h-9 rounded-xl bg-blue-500/15 ring-1 ring-blue-400/30 flex items-center justify-center flex-shrink-0">
                <span className="absolute inset-0 rounded-xl bg-[#60A5FA]/25 blur-md opacity-60" aria-hidden="true" />
                <Lock className="relative w-4 h-4 text-[#93C5FD]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-sm text-white truncate">{b.reason || 'Bloqueado'}</div>
                  {isRec && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-400/15 text-violet-200 border border-violet-400/30">Semanal</span>}
                </div>
                <div className="text-xs text-white/55 truncate mt-0.5">{description}</div>
              </div>
              <button onClick={() => { if (confirm('Remover bloqueio?')) onDelete(b.id); }} className="text-white/35 hover:text-rose-300 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}