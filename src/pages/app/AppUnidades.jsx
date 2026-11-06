// AppUnidades — CRUD de unidades da barbearia.
// Quando há multi_unit_enabled=false, mostra um banner explicando.

import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useState } from 'react';
import { Building2, Pencil, Trash2, Star, MapPin, Phone, Sparkles } from 'lucide-react';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import StandardModal from '@/components/ui/standard-modal';
import { useToast } from '@/components/ui/use-toast';
import MultiUnitToggle from '@/components/units/MultiUnitToggle';
import CustomerScopeToggle from '@/components/units/CustomerScopeToggle';
import { calculateSubscriptionPrice, formatBRL, EXCLUSIVO_BASE_PRICE, ADDITIONAL_BRANCH_PRICE } from '@/lib/planPricing';

const empty = { name: '', address: '', phone: '', whatsapp: '', active: true };

export default function AppUnidades() {
  const { company, companyId } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingUnit, setDeletingUnit] = useState(null);
  const [form, setForm] = useState(empty);

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units', companyId],
    queryFn: () => base44.entities.Unit.filter({ company_id: companyId }, 'sort_order'),
    enabled: !!companyId,
  });

  const createM = useMutation({
    mutationFn: (data) => base44.entities.Unit.create({ ...data, company_id: companyId, sort_order: units.length }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', companyId] });
      // Garante que o flag multi_unit_enabled fique true ao criar a 2ª unidade
      if (units.length >= 1 && !company?.multi_unit_enabled) {
        base44.entities.Company.update(company.id, { multi_unit_enabled: true });
        queryClient.invalidateQueries({ queryKey: ['my-company'] });
      }
      close();
      toast({ title: 'Unidade criada com sucesso!' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao criar unidade', description: err?.message, variant: 'destructive' });
    },
  });

  const updateM = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Unit.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', companyId] });
      close();
      toast({ title: 'Unidade atualizada' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao atualizar unidade', description: err?.message, variant: 'destructive' });
    },
  });

  const deleteM = useMutation({
    mutationFn: (id) => base44.entities.Unit.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', companyId] });
      setDeletingUnit(null);
      toast({ title: 'Unidade removida com sucesso' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao remover unidade', description: err?.message, variant: 'destructive' });
    },
  });

  const close = () => { setShowForm(false); setEditing(null); setForm(empty); };
  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, address: u.address || '', phone: u.phone || '', whatsapp: u.whatsapp || '', active: u.active });
    setShowForm(true);
  };
  const save = () => {
    if (!form.name.trim()) return;
    if (editing) updateM.mutate({ id: editing.id, data: form });
    else createM.mutate(form);
  };

  const removeUnit = (u) => {
    if (u.is_default) {
      toast({ title: 'A unidade Matriz não pode ser excluída', variant: 'destructive' });
      return;
    }
    setDeletingUnit(u);
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <AppPageHeader
          title="Unidades & Filiais"
          subtitle={`${units.length} ${units.length === 1 ? 'unidade cadastrada' : 'unidades cadastradas'}`}
          icon={Building2}
        >
          {company?.multi_unit_enabled && (
            <PrimaryButton onClick={() => setShowForm(true)}>Nova unidade</PrimaryButton>
          )}
        </AppPageHeader>

        {/* Toggle principal: liga/desliga multi-unidade */}
        {company && <MultiUnitToggle company={company} />}

        {/* Banner Informativo do Modelo de Franquias & Filiais */}
        {(() => {
          const activeUnitsCount = Math.max(1, units.filter(u => u.active !== false).length);
          const extraBranchesCount = Math.max(0, activeUnitsCount - 1);
          const pricing = calculateSubscriptionPrice({
            planName: company?.plan_name || 'Exclusivo',
            basePrice: company?.plan_price,
            activeUnitsCount,
            extraBranchesCount,
          });

          return (
            <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-blue-900/20 to-indigo-950/40 p-4 sm:p-5 mb-6 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center flex-shrink-0 text-blue-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Modelo de Assinatura Franquias & Redes
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Plano Matriz / Exclusivo
                      </span>
                    </h3>
                    <p className="text-xs text-white/70 mt-1 max-w-2xl leading-relaxed">
                      Taxa base de <strong>{formatBRL(EXCLUSIVO_BASE_PRICE)}/mês</strong> para a unidade principal (Matriz) + cobrança adicional de <strong>{formatBRL(ADDITIONAL_BRANCH_PRICE)}/mês</strong> por cada filial extra ativa vinculada.
                    </p>
                  </div>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-xl p-3 px-4 flex items-center gap-4 self-start md:self-auto min-w-[240px] justify-between">
                  <div>
                    <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Cálculo Atual</div>
                    <div className="text-xs text-white/80 mt-0.5 font-medium">
                      1 Matriz + {pricing.extraBranches} filial(is)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-emerald-400">{pricing.formattedTotalPrice}</div>
                    <div className="text-[10px] text-white/50">/mês</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {isLoading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-12 text-center text-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            Carregando...
          </div>
        ) : units.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-12 text-center text-white/60 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-3">Nenhuma unidade cadastrada</p>
            <button onClick={() => setShowForm(true)} className="text-sm font-semibold text-[#93C5FD] hover:text-white">
              Adicionar primeira unidade
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 mt-2">
              <h2 className="text-xs font-semibold text-white/55 uppercase tracking-wider">Suas unidades</h2>
              <span className="text-xs text-white/55">{units.filter(u => u.active).length} ativa(s)</span>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {units.map(u => (
                <div key={u.id} className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:border-blue-400/25 hover:shadow-[0_12px_32px_rgba(37,99,235,0.18)] transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-blue-400/12 ring-1 ring-blue-400/25 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-[#93C5FD]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white truncate flex items-center gap-1.5">
                          {u.name}
                          {u.is_default && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                        </h3>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className={`w-2 h-2 rounded-full ${u.active ? 'bg-emerald-400' : 'bg-white/20'}`} />
                          <span className="text-xs text-white/55">{u.active ? 'Ativa' : 'Inativa'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-white/10 rounded-lg" title="Editar">
                        <Pencil className="w-3.5 h-3.5 text-white/50" />
                      </button>
                      {!u.is_default && (
                        <button onClick={() => removeUnit(u)} className="p-1.5 hover:bg-red-500/15 rounded-lg" title="Excluir">
                          <Trash2 className="w-3.5 h-3.5 text-red-300" />
                        </button>
                      )}
                    </div>
                  </div>
                  {u.address && (
                    <div className="text-xs text-white/50 mb-1 truncate flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 flex-shrink-0" /> {u.address}
                    </div>
                  )}
                  {u.phone && (
                    <div className="text-xs text-white/50 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 flex-shrink-0" /> {u.phone}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Toggle de modo de clientes — só faz sentido com multi_unit ligado */}
            {company?.multi_unit_enabled && units.length > 0 && (
              <div className="mt-6">
                <CustomerScopeToggle company={company} />
              </div>
            )}
          </>
        )}

        <StandardModal
          open={showForm}
          onClose={close}
          title={editing ? 'Editar unidade' : 'Nova unidade'}
          footer={
            <>
              <button onClick={close} className="flex-1 px-4 py-2.5 border border-white/12 bg-white/[0.04] text-white/80 rounded-lg text-sm font-medium hover:bg-white/[0.08]">
                Cancelar
              </button>
              <button onClick={save} disabled={!form.name.trim() || createM.isPending || updateM.isPending}
                className="flex-1 px-4 py-2.5 bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white rounded-lg text-sm font-semibold ring-1 ring-white/15 hover:brightness-110 disabled:opacity-50 shadow-[0_8px_24px_rgba(37,99,235,0.4)]">
                {createM.isPending || updateM.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-white/55 block mb-1">Nome *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Matriz, Filial Centro, Loja Shopping"
                className="w-full px-3 py-2.5 border border-white/10 bg-white/[0.03] rounded-lg text-sm text-white placeholder:text-white/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/55 block mb-1">Endereço</label>
              <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                className="w-full px-3 py-2.5 border border-white/10 bg-white/[0.03] rounded-lg text-sm text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-white/55 block mb-1">Telefone</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-white/10 bg-white/[0.03] rounded-lg text-sm text-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/55 block mb-1">WhatsApp</label>
                <input value={form.whatsapp} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-white/10 bg-white/[0.03] rounded-lg text-sm text-white" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer pt-2">
              <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} className="accent-[#2563EB]" />
              Unidade ativa
            </label>
          </div>
        </StandardModal>

        {/* Modal de confirmação segura de exclusão */}
        <StandardModal
          open={!!deletingUnit}
          onClose={() => setDeletingUnit(null)}
          title="Excluir Unidade"
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeletingUnit(null)}
                disabled={deleteM.isPending}
                className="flex-1 px-4 py-2.5 border border-white/12 bg-white/[0.04] text-white/80 rounded-lg text-sm font-medium hover:bg-white/[0.08]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deletingUnit) deleteM.mutate(deletingUnit.id);
                }}
                disabled={deleteM.isPending}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-red-900/30 disabled:opacity-50"
              >
                {deleteM.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </>
          }
        >
          <div className="text-white/80 text-sm leading-relaxed space-y-2">
            <p>
              Deseja realmente excluir a filial <span className="font-bold text-white">"{deletingUnit?.name}"</span>?
            </p>
            <p className="text-xs text-white/50">
              Esta ação removerá a unidade da lista ativa. Agendamentos e históricos anteriores permanecerão arquivados de forma segura.
            </p>
          </div>
        </StandardModal>
      </div>
    </AppLayout>
  );
}