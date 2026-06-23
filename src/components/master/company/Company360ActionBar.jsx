// Company360ActionBar — barra de ações rápidas no detalhe da empresa.
// Reusa as mutations que já existem em CompaniesTable (impersonação, bloquear, ativar, excluir).
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Eye, Ban, CheckCircle2, Trash2, Loader2, CreditCard, DollarSign } from 'lucide-react';
import { useImpersonationContext } from '@/contexts/ImpersonationContext';
import ConfirmDestructiveDialog from '@/components/ConfirmDestructiveDialog';
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
  const [planModal, setPlanModal] = useState(false);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['master-company-360', company.id] });
    qc.invalidateQueries({ queryKey: ['master-companies'] });
    qc.invalidateQueries({ queryKey: ['master-metrics'] });
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

      <ChangePlanModal
        open={planModal}
        onClose={() => setPlanModal(false)}
        company={company}
        onSuccess={() => { setPlanModal(false); onPlanChanged?.(); invalidateAll(); }}
      />
    </>
  );
}