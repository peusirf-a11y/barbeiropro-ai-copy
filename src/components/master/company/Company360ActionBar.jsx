// Company360ActionBar — barra de ações rápidas no detalhe da empresa.
// Reusa as mutations que já existem em CompaniesTable (impersonação, bloquear, ativar, excluir, estender teste).
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Eye, Ban, CheckCircle2, Trash2, Loader2, CreditCard, DollarSign, CalendarClock, XCircle } from 'lucide-react';
import { useImpersonationContext } from '@/contexts/ImpersonationContext';
import ConfirmDestructiveDialog from '@/components/ConfirmDestructiveDialog';
import StandardModal from '@/components/ui/standard-modal';
import { useToast } from '@/components/ui/use-toast';
import { getTotpToken, clearTotpSession } from '@/lib/totpSession';
import ChangePlanModal from './ChangePlanModal';

export default function Company360ActionBar({ company, onPlanChanged }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { startImpersonation } = useImpersonationContext();
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancelSub, setConfirmCancelSub] = useState(false);
  const [planModal, setPlanModal] = useState(false);
  const [trialModal, setTrialModal] = useState(false);
  const [selectedDays, setSelectedDays] = useState(7);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['master-company-360', company.id] });
    qc.invalidateQueries({ queryKey: ['master-companies'] });
    qc.invalidateQueries({ queryKey: ['master-metrics'] });
    qc.invalidateQueries({ queryKey: ['master-finance'] });
    qc.invalidateQueries({ queryKey: ['master-audit-log'] });
  };

  const impersonate = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('startImpersonation', {
        company_id: company.id,
        totp_session_token: getTotpToken(),
      });
      if (!res.data?.success) {
        if (res.data?.totp_required) clearTotpSession();
        throw new Error(res.data?.error || 'Falha');
      }
      return res.data;
    },
    onSuccess: (data) => {
      startImpersonation({
        company_id: data.company_id,
        company_name: company.name,
        token: data.token,
        expires_at: data.expires_at,
      });
      navigate('/app/dashboard');
    },
    onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ nextStatus }) => {
      const fn = nextStatus === 'blocked' ? 'blockCompany' : 'activateCompany';
      const res = await base44.functions.invoke(fn, {
        company_id: company.id,
        totp_session_token: getTotpToken(),
      });
      if (!res.data?.success) {
        if (res.data?.totp_required) clearTotpSession();
        throw new Error(res.data?.error || 'Falha');
      }
      return { ...res.data, nextStatus };
    },
    onSuccess: (data) => {
      invalidateAll();
      toast({
        title: data.nextStatus === 'blocked' ? 'Empresa bloqueada' : 'Empresa ativada',
        description: 'Ação registrada no log de auditoria.',
      });
      setConfirmBlock(false);
    },
    onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const extendTrial = useMutation({
    mutationFn: async (days) => {
      const res = await base44.functions.invoke('extendCompanyTrial', {
        company_id: company.id,
        days: Number(days),
        totp_session_token: getTotpToken(),
      });
      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Falha ao estender período de teste');
      }
      return res.data;
    },
    onSuccess: (data) => {
      invalidateAll();
      onPlanChanged?.();
      const formattedDate = data.trial_ends_at
        ? new Date(data.trial_ends_at).toLocaleDateString('pt-BR')
        : '';
      toast({
        title: `Período de teste estendido (+${selectedDays} dias)`,
        description: formattedDate ? `Novo vencimento do teste: ${formattedDate}.` : 'Atualizado no Supabase com sucesso.',
      });
      setTrialModal(false);
    },
    onError: (e) => toast({ title: 'Erro ao estender teste', description: e.message, variant: 'destructive' }),
  });

  const cancelSubscription = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('cancelCompanySubscription', {
        company_id: company.id,
        subscription_id: company.asaas_subscription_id || null,
        email: company.owner_email || null,
        immediate: true,
        totp_session_token: getTotpToken(),
      });
      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Falha ao cancelar assinatura.');
      }
      return res.data;
    },
    onSuccess: (data) => {
      invalidateAll();
      onPlanChanged?.();
      toast({
        title: 'Assinatura cancelada',
        description: data.message || 'Assinatura cancelada com sucesso no Asaas e na plataforma.',
      });
      setConfirmCancelSub(false);
    },
    onError: (e) =>
      toast({
        title: 'Erro ao cancelar assinatura',
        description: e.message,
        variant: 'destructive',
      }),
  });

  const deleteCompany = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('deleteCompany', {
        company_id: company.id,
        confirm_name: company.name,
        totp_session_token: getTotpToken(),
      });
      if (!res.data?.success) {
        if (res.data?.totp_required) clearTotpSession();
        throw new Error(res.data?.error || 'Falha');
      }
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['master-companies'] });
      qc.invalidateQueries({ queryKey: ['master-metrics'] });
      toast({ title: 'Empresa excluída', description: 'Todos os registros relacionados foram removidos.' });
      navigate('/master/barbearias');
    },
    onError: (e) => toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' }),
  });

  const isActive = company.status === 'active';
  const isAlreadyCanceled =
    String(company.subscription_status || '').toLowerCase() === 'canceled' ||
    String(company.billing_status || '').toUpperCase() === 'CANCELED';

  const currentTrialEnd = company.trial_ends_at ? new Date(company.trial_ends_at) : null;
  const baseDate = currentTrialEnd && currentTrialEnd.getTime() > Date.now() ? currentTrialEnd : new Date();
  const previewTrialEnd = new Date(baseDate.getTime() + selectedDays * 24 * 60 * 60 * 1000);

  return (
    <>
      <div className="bg-card rounded-2xl border border-border p-3 shadow-[var(--shadow-sm)] flex items-center gap-2 flex-wrap">
        <button
          onClick={() => impersonate.mutate()}
          disabled={impersonate.isPending}
          className="text-xs font-semibold px-3 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
        >
          {impersonate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
          Visualizar como
        </button>

        <button
          onClick={() => setPlanModal(true)}
          className="text-xs font-semibold px-3 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 inline-flex items-center gap-1.5 transition-colors"
        >
          <CreditCard className="w-3.5 h-3.5" /> Alterar plano
        </button>

        <button
          onClick={() => { setSelectedDays(7); setTrialModal(true); }}
          className="text-xs font-semibold px-3 py-2 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 inline-flex items-center gap-1.5 transition-colors"
        >
          <CalendarClock className="w-3.5 h-3.5" /> Estender Teste
        </button>

        <button
          onClick={() => setConfirmCancelSub(true)}
          disabled={cancelSubscription.isPending || isAlreadyCanceled}
          className="text-xs font-semibold px-3 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
        >
          {cancelSubscription.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
          {isAlreadyCanceled ? 'Assinatura Cancelada' : 'Cancelar Assinatura'}
        </button>

        <button
          onClick={() => navigate(`/master/financeiro?company_id=${company.id}`)}
          className="text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 inline-flex items-center gap-1.5 transition-colors"
        >
          <DollarSign className="w-3.5 h-3.5" /> Financeiro
        </button>

        <div className="h-6 w-px bg-border mx-1" />

        <button
          onClick={() => isActive ? setConfirmBlock(true) : toggleStatus.mutate({ nextStatus: 'active' })}
          disabled={toggleStatus.isPending}
          className={`text-xs font-semibold px-3 py-2 rounded-xl inline-flex items-center gap-1.5 disabled:opacity-50 border transition-colors ${
            isActive
              ? 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
          }`}
        >
          {toggleStatus.isPending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : (isActive ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />)}
          {isActive ? 'Suspender' : 'Reativar'}
        </button>

        <button
          onClick={() => setConfirmDelete(true)}
          disabled={deleteCompany.isPending}
          className="text-xs font-semibold px-3 py-2 rounded-xl bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors ml-auto"
        >
          {deleteCompany.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Excluir
        </button>
      </div>

      <ConfirmDestructiveDialog
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        onConfirm={() => toggleStatus.mutate({ nextStatus: 'blocked' })}
        title={`Suspender "${company.name}"?`}
        description="A empresa perde imediatamente o acesso ao app. A ação é registrada no log de auditoria."
        expectedText={company.name}
        confirmLabel="Suspender empresa"
        isLoading={toggleStatus.isPending}
      />

      <ConfirmDestructiveDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteCompany.mutate()}
        title={`EXCLUIR "${company.name}" PERMANENTEMENTE?`}
        description="Ação IRREVERSÍVEL. Serão apagados em cascata: agendamentos, clientes, profissionais, financeiro, comissões, equipe, mensagens e avaliações."
        expectedText={company.name}
        confirmLabel="Excluir tudo permanentemente"
        isLoading={deleteCompany.isPending}
      />

      <StandardModal
        open={confirmCancelSub}
        onClose={() => !cancelSubscription.isPending && setConfirmCancelSub(false)}
        title={`Cancelar Assinatura — ${company.name}`}
        footer={
          <>
            <button
              onClick={() => setConfirmCancelSub(false)}
              disabled={cancelSubscription.isPending}
              className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              onClick={() => cancelSubscription.mutate()}
              disabled={cancelSubscription.isPending}
              className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition-all inline-flex items-center justify-center gap-2"
            >
              {cancelSubscription.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cancelando…</span>
                </>
              ) : (
                <span>Confirmar cancelamento</span>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-400 leading-relaxed font-medium">
            Tem certeza que deseja cancelar a assinatura desta barbearia? Esta ação cancelará imediatamente a assinatura recorrente no Asaas.
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              • As cobranças automáticas no cartão de crédito serão interrompidas imediatamente no Asaas.
            </p>
            <p>
              • O status de assinatura na plataforma será atualizado para <strong>CANCELED</strong>.
            </p>
          </div>
        </div>
      </StandardModal>

      <ChangePlanModal
        open={planModal}
        onClose={() => setPlanModal(false)}
        company={company}
        onSuccess={() => { setPlanModal(false); onPlanChanged?.(); invalidateAll(); }}
      />

      <StandardModal
        open={trialModal}
        onClose={() => setTrialModal(false)}
        title={`Estender Período de Teste — ${company.name}`}
        footer={
          <>
            <button
              onClick={() => setTrialModal(false)}
              className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => extendTrial.mutate(selectedDays)}
              disabled={extendTrial.isPending}
              className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 transition-all"
            >
              {extendTrial.isPending ? 'Salvando…' : `Confirmar +${selectedDays} dias`}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Selecione quantos dias deseja adicionar ao período de avaliação gratuita (coluna <code className="bg-muted px-1 py-0.5 rounded">trial_ends_at</code> no Supabase):
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[7, 15].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setSelectedDays(days)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  selectedDays === days
                    ? 'border-[#2563EB] bg-blue-500/10 text-[#2563EB] font-bold'
                    : 'border-border bg-background text-foreground hover:bg-muted/50'
                }`}
              >
                <div className="text-base font-black">+{days} dias</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Estender teste por {days} dias corridos
                </div>
              </button>
            ))}
          </div>
          <div className="rounded-xl bg-muted/50 border border-border p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vencimento atual do trial:</span>
              <span className="font-semibold text-foreground">
                {currentTrialEnd ? currentTrialEnd.toLocaleDateString('pt-BR') : 'Não definido (inicia hoje)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Novo vencimento após extensão:</span>
              <span className="font-bold text-emerald-500">
                {previewTrialEnd.toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
        </div>
      </StandardModal>
    </>
  );
}