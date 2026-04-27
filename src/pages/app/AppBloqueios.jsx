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

const emptyForm = { professional_id: '', start_time: '', end_time: '', reason: '' };

export default function AppBloqueios() {
  const { companyId, isLoading: loadingCompany } = useCompany();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ['blocks', companyId],
    queryFn: () => base44.entities.BlockedTime.filter({ company_id: companyId }, '-start_time', 200),
    enabled: !!companyId,
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals', companyId],
    queryFn: () => base44.entities.Professional.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BlockedTime.create({ ...data, company_id: companyId }),
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
    if (!form.start_time || !form.end_time) return;
    if (new Date(form.end_time) <= new Date(form.start_time)) {
      alert('O horário de fim deve ser depois do início.');
      return;
    }
    createMutation.mutate(form);
  };

  if (loadingCompany || isLoading) {
    return <AppLayout><SkeletonPage /></AppLayout>;
  }

  const now = new Date();
  const upcoming = blocks.filter(b => new Date(b.end_time) >= now);
  const past = blocks.filter(b => new Date(b.end_time) < now);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-[#0F172A]">Bloqueios de horário</h1>
            <p className="text-gray-500 text-sm mt-1">Almoço, folgas, eventos — horários indisponíveis para agendamento</p>
          </div>
          <button onClick={() => setShowForm(true)} className="bg-[#2563EB] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#1d4ed8] flex items-center gap-2">
            <Plus className="w-4 h-4" />Novo bloqueio
          </button>
        </div>

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
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Profissional</label>
                  <select value={form.professional_id} onChange={e => setForm(p => ({ ...p, professional_id: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm">
                    <option value="">Toda a barbearia</option>
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
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
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Motivo</label>
                  <input type="text" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                    placeholder="Ex: Almoço, Folga, Evento"
                    className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium">Cancelar</button>
                <button onClick={handleCreate} disabled={!form.start_time || !form.end_time || createMutation.isPending}
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

function BlockList({ title, items, proName, onDelete, muted }) {
  return (
    <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
      <div className="px-5 py-3 border-b border-black/5 text-xs font-bold uppercase tracking-wide text-gray-500">{title}</div>
      <div className="divide-y divide-black/5">
        {items.map(b => (
          <div key={b.id} className={`flex items-center gap-4 p-4 ${muted ? 'opacity-60' : ''}`}>
            <div className="w-9 h-9 bg-[#2563EB]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Lock className="w-4 h-4 text-[#2563EB]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-[#0F172A] truncate">{b.reason || 'Bloqueado'}</div>
              <div className="text-xs text-gray-500 truncate">
                {proName(b.professional_id)} · {format(new Date(b.start_time), "d MMM HH:mm", { locale: ptBR })} → {format(new Date(b.end_time), "d MMM HH:mm", { locale: ptBR })}
              </div>
            </div>
            <button onClick={() => { if (confirm('Remover bloqueio?')) onDelete(b.id); }} className="text-gray-300 hover:text-red-500 p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}