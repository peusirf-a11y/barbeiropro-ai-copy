import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/lib/AuthContext';
import { useState } from 'react';
import { Plus, X, Wallet, Lock, Unlock, TrendingUp, TrendingDown } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EmptyState from '@/components/EmptyState';
import { SkeletonPage } from '@/components/Skeletons';

export default function AppCaixa() {
  const { companyId, isLoading: loadingCompany } = useCompany();
  const { user } = useAuth();
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [openForm, setOpenForm] = useState({ initial_amount: '', notes: '' });
  const [closeForm, setCloseForm] = useState({ final_amount: '', notes: '' });
  const [entryForm, setEntryForm] = useState({ type: 'entrada', description: '', amount: '', category: 'Atendimento' });
  const queryClient = useQueryClient();

  const { data: registers = [], isLoading } = useQuery({
    queryKey: ['cash-registers', companyId],
    queryFn: () => base44.entities.CashRegister.filter({ company_id: companyId }, '-opened_at', 30),
    enabled: !!companyId,
  });

  const openCash = registers.find(r => r.status === 'aberto');

  // Lançamentos do caixa atual (a partir do horário de abertura)
  const { data: entries = [] } = useQuery({
    queryKey: ['cash-entries', companyId, openCash?.id],
    queryFn: async () => {
      if (!openCash) return [];
      const all = await base44.entities.FinancialEntry.filter({ company_id: companyId }, '-created_date', 200);
      return all.filter(e => new Date(e.created_date || e.date) >= new Date(openCash.opened_at));
    },
    enabled: !!companyId && !!openCash,
  });

  const totalIn = entries.filter(e => e.type === 'entrada').reduce((s, e) => s + (e.amount || 0), 0);
  const totalOut = entries.filter(e => e.type === 'saida').reduce((s, e) => s + (e.amount || 0), 0);
  const expected = (openCash?.initial_amount || 0) + totalIn - totalOut;

  const openMutation = useMutation({
    mutationFn: (data) => base44.entities.CashRegister.create({
      company_id: companyId,
      opened_at: new Date().toISOString(),
      initial_amount: +data.initial_amount || 0,
      opened_by: user?.email,
      notes: data.notes,
      status: 'aberto',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-registers', companyId] });
      setShowOpen(false);
      setOpenForm({ initial_amount: '', notes: '' });
    },
  });

  // Fechamento de caixa: cálculo é feito no BACKEND para ser fonte da verdade.
  const closeMutation = useMutation({
    mutationFn: async (data) => {
      const res = await base44.functions.invoke('closeCashRegister', {
        register_id: openCash.id,
        final_amount: +data.final_amount || 0,
        notes: data.notes,
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || 'Falha ao fechar caixa');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-registers', companyId] });
      setShowClose(false);
      setCloseForm({ final_amount: '', notes: '' });
    },
    onError: (err) => alert(err.message || 'Erro ao fechar caixa'),
  });

  const entryMutation = useMutation({
    mutationFn: (data) => base44.entities.FinancialEntry.create({
      company_id: companyId,
      type: data.type,
      description: data.description,
      amount: +data.amount,
      category: data.category,
      date: format(new Date(), 'yyyy-MM-dd'),
      status: 'confirmado',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-entries', companyId, openCash?.id] });
      setShowEntry(false);
      setEntryForm({ type: 'entrada', description: '', amount: '', category: 'Atendimento' });
    },
  });

  if (loadingCompany || isLoading) {
    return <AppLayout><SkeletonPage /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#0F172A]">Caixa</h1>
          <p className="text-gray-500 text-sm mt-1">Abertura e fechamento diário do caixa</p>
        </div>

        {!openCash ? (
          <div className="bg-white rounded-2xl border border-black/8">
            <EmptyState
              icon={Wallet}
              title="Caixa fechado"
              description="Abra o caixa para começar a registrar entradas e saídas do dia."
              action={
                <button onClick={() => setShowOpen(true)} className="bg-[#2563EB] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#1d4ed8] inline-flex items-center gap-2">
                  <Unlock className="w-4 h-4" />Abrir caixa
                </button>
              }
            />
          </div>
        ) : (
          <>
            {/* Resumo */}
            <div className="grid sm:grid-cols-3 gap-4 mb-5">
              <Stat icon={Wallet} label="Saldo inicial" value={`R$ ${(openCash.initial_amount || 0).toFixed(2)}`} />
              <Stat icon={TrendingUp} label="Entradas" value={`R$ ${totalIn.toFixed(2)}`} positive />
              <Stat icon={TrendingDown} label="Saídas" value={`R$ ${totalOut.toFixed(2)}`} negative />
            </div>

            <div className="bg-[#2563EB] text-white rounded-2xl p-5 mb-5 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide font-bold text-white/70">Saldo esperado</div>
                <div className="text-3xl font-black mt-1">R$ {expected.toFixed(2)}</div>
                <div className="text-xs text-white/70 mt-1">Aberto em {format(new Date(openCash.opened_at), "d MMM, HH:mm", { locale: ptBR })}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowEntry(true)} className="bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2">
                  <Plus className="w-4 h-4" />Lançamento
                </button>
                <button onClick={() => setShowClose(true)} className="bg-white text-[#2563EB] text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2">
                  <Lock className="w-4 h-4" />Fechar caixa
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
              <div className="px-5 py-3 border-b border-black/5 text-xs font-bold uppercase tracking-wide text-gray-500">Movimentações deste caixa</div>
              {entries.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">Nenhuma movimentação ainda</div>
              ) : (
                <div className="divide-y divide-black/5 max-h-[400px] overflow-y-auto">
                  {entries.map(e => (
                    <div key={e.id} className="flex items-center gap-4 p-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${e.type === 'entrada' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {e.type === 'entrada' ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-[#0F172A] truncate">{e.description || e.category}</div>
                        <div className="text-xs text-gray-400">{e.category}</div>
                      </div>
                      <div className={`text-sm font-bold ${e.type === 'entrada' ? 'text-green-600' : 'text-red-500'}`}>
                        {e.type === 'entrada' ? '+' : '-'}R$ {e.amount?.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Histórico de caixas */}
        {registers.filter(r => r.status === 'fechado').length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-black/8 overflow-hidden">
            <div className="px-5 py-3 border-b border-black/5 text-xs font-bold uppercase tracking-wide text-gray-500">Histórico</div>
            <div className="divide-y divide-black/5">
              {registers.filter(r => r.status === 'fechado').slice(0, 10).map(r => (
                <div key={r.id} className="flex items-center justify-between p-4 gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold text-[#0F172A]">
                      {format(new Date(r.opened_at), "d MMM yyyy", { locale: ptBR })}
                    </div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(r.opened_at), "HH:mm")} → {r.closed_at ? format(new Date(r.closed_at), "HH:mm") : '–'} · por {r.closed_by || '–'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#0F172A]">R$ {(r.final_amount || 0).toFixed(2)}</div>
                    {typeof r.difference === 'number' && r.difference !== 0 && (
                      <div className={`text-xs font-semibold ${r.difference > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {r.difference > 0 ? '+' : ''}{r.difference.toFixed(2)} vs esperado
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal: abrir caixa */}
        {showOpen && (
          <Modal title="Abrir caixa" onClose={() => setShowOpen(false)}>
            <div className="space-y-3">
              <Field label="Saldo inicial (R$) *">
                <input type="number" min="0" step="0.01" value={openForm.initial_amount} onChange={e => setOpenForm(p => ({ ...p, initial_amount: e.target.value }))}
                  placeholder="Ex: 100.00" className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
              </Field>
              <Field label="Observação">
                <input type="text" value={openForm.notes} onChange={e => setOpenForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
              </Field>
            </div>
            <ModalActions onCancel={() => setShowOpen(false)} onConfirm={() => openMutation.mutate(openForm)} loading={openMutation.isPending} disabled={!openForm.initial_amount && openForm.initial_amount !== '0'} confirmLabel="Abrir caixa" />
          </Modal>
        )}

        {/* Modal: fechar caixa */}
        {showClose && (
          <Modal title="Fechar caixa" onClose={() => setShowClose(false)}>
            <div className="bg-[#2563EB]/5 border border-[#2563EB]/15 rounded-xl p-4 mb-3">
              <div className="text-xs text-gray-500 font-medium">Saldo esperado</div>
              <div className="text-2xl font-black text-[#2563EB]">R$ {expected.toFixed(2)}</div>
            </div>
            <div className="space-y-3">
              <Field label="Saldo real contado (R$) *">
                <input type="number" min="0" step="0.01" value={closeForm.final_amount} onChange={e => setCloseForm(p => ({ ...p, final_amount: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
              </Field>
              <Field label="Observação">
                <input type="text" value={closeForm.notes} onChange={e => setCloseForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
              </Field>
            </div>
            <ModalActions onCancel={() => setShowClose(false)} onConfirm={() => closeMutation.mutate(closeForm)} loading={closeMutation.isPending} disabled={!closeForm.final_amount && closeForm.final_amount !== '0'} confirmLabel="Fechar caixa" />
          </Modal>
        )}

        {/* Modal: lançamento */}
        {showEntry && (
          <Modal title="Lançamento no caixa" onClose={() => setShowEntry(false)}>
            <div className="space-y-3">
              <div className="flex gap-2">
                {[{ v: 'entrada', l: 'Entrada' }, { v: 'saida', l: 'Saída' }].map(t => (
                  <button key={t.v} onClick={() => setEntryForm(p => ({ ...p, type: t.v, category: t.v === 'entrada' ? 'Atendimento' : 'Outros' }))}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border ${entryForm.type === t.v ? (t.v === 'entrada' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600') : 'border-black/10 text-gray-600'}`}>
                    {t.l}
                  </button>
                ))}
              </div>
              <Field label="Descrição">
                <input type="text" value={entryForm.description} onChange={e => setEntryForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
              </Field>
              <Field label="Valor (R$) *">
                <input type="number" min="0" step="0.01" value={entryForm.amount} onChange={e => setEntryForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
              </Field>
            </div>
            <ModalActions onCancel={() => setShowEntry(false)} onConfirm={() => entryMutation.mutate(entryForm)} loading={entryMutation.isPending} disabled={!entryForm.amount} confirmLabel="Salvar" />
          </Modal>
        )}
      </div>
    </AppLayout>
  );
}

function Stat({ icon: Icon, label, value, positive, negative }) {
  const tone = positive ? 'text-green-600 bg-green-50' : negative ? 'text-red-500 bg-red-50' : 'text-[#2563EB] bg-[#2563EB]/10';
  return (
    <div className="bg-white rounded-2xl border border-black/8 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}><Icon className="w-4 h-4" /></div>
        <span className="text-sm font-medium text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-black text-[#0F172A]">{value}</div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-[#0F172A]">{title}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}

function ModalActions({ onCancel, onConfirm, loading, disabled, confirmLabel }) {
  return (
    <div className="flex gap-3 mt-5">
      <button onClick={onCancel} className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium">Cancelar</button>
      <button onClick={onConfirm} disabled={disabled || loading}
        className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50">
        {loading ? 'Salvando...' : confirmLabel}
      </button>
    </div>
  );
}