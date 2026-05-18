import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useState } from 'react';
import { Plus, X, Mail, Loader2, Send, UserCheck, Shield } from 'lucide-react';
import MemberPermissionsModal from '@/components/equipe/MemberPermissionsModal';
import { useToast } from '@/components/ui/use-toast';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import StandardModal from '@/components/ui/standard-modal';
import FilterSelect from '@/components/ui/filter-select';

const roleLabels = { admin: 'Admin', recepcao: 'Recepção', barbeiro: 'Barbeiro', financeiro: 'Financeiro' };
const roleColors = {
  admin: 'bg-violet-400/15 text-violet-200 ring-1 ring-violet-400/30',
  recepcao: 'bg-blue-400/15 text-blue-200 ring-1 ring-blue-400/30',
  barbeiro: 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/30',
  financeiro: 'bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30',
};

export default function AppEquipe() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'recepcao' });
  const [permsTarget, setPermsTarget] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId } = useCompany();

  const { data: team = [] } = useQuery({
    queryKey: ['team', companyId],
    queryFn: () => base44.entities.TeamMember.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const inviteMutation = useMutation({
    mutationFn: async (data) => {
      const ERR_MSG = {
        ALREADY_MEMBER: 'Este e-mail já faz parte da equipe',
        EMAIL_INVALID: 'E-mail inválido',
        NAME_REQUIRED: 'Nome obrigatório',
        ROLE_INVALID: 'Papel inválido',
        NO_COMPANY: 'Nenhuma empresa associada à sua conta. Faça logout e login novamente.',
        NO_TEAM_MEMBER: 'Sua sessão não está vinculada a uma empresa. Faça logout e login novamente.',
        UNAUTHORIZED: 'Sessão expirada. Faça login novamente.',
        USER_INACTIVE: 'Sua conta está inativa. Contate o administrador.',
        FORBIDDEN_ROLE: 'Apenas administradores podem convidar membros',
        COMPANY_BLOCKED: 'Sua empresa está bloqueada. Regularize para convidar.',
        NOT_FOUND: 'Empresa não encontrada',
      };
      let res;
      try {
        res = await base44.functions.invoke('inviteTeamMember', data);
      } catch (httpErr) {
        // axios lança em status >= 400; extrai o code retornado pelo backend
        const code = httpErr?.response?.data?.error;
        throw new Error(ERR_MSG[code] || code || httpErr.message || 'Falha ao convidar');
      }
      if (!res.data?.success) {
        const code = res.data?.error;
        throw new Error(ERR_MSG[code] || code || 'Falha ao convidar');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['team', companyId] });
      setShowForm(false);
      setForm({ name: '', email: '', role: 'recepcao' });
      toast({
        title: data.email_sent ? 'Convite enviado!' : 'Membro adicionado',
        description: data.email_sent
          ? 'O e-mail de convite foi enviado. Peça para o convidado verificar a caixa de entrada (e a pasta spam).'
          : 'Membro criado, mas o e-mail falhou. Use "Reenviar convite" na lista.',
      });
    },
    onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const resendMutation = useMutation({
    mutationFn: async (id) => {
      const res = await base44.functions.invoke('resendTeamInvite', { team_member_id: id });
      if (!res.data?.success) throw new Error(res.data?.error || 'Falha ao reenviar');
      return res.data;
    },
    onSuccess: (data) => {
      toast({
        title: data.email_sent ? 'Convite reenviado!' : 'Reenvio falhou',
        description: data.email_sent ? 'O membro receberá um novo e-mail em instantes.' : 'Verifique o painel master para diagnóstico.',
        variant: data.email_sent ? 'default' : 'destructive',
      });
    },
    onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TeamMember.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team', companyId] }),
  });

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <AppPageHeader
          title="Equipe"
          subtitle={`${team.length} membros cadastrados`}
          icon={UserCheck}
        >
          <PrimaryButton onClick={() => setShowForm(true)}>Convidar membro</PrimaryButton>
        </AppPageHeader>

        <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden">
         <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.02]">
                <th className="text-left p-4 text-[11px] font-semibold text-white/50 uppercase tracking-wider">Membro</th>
                <th className="text-left p-4 text-[11px] font-semibold text-white/50 uppercase tracking-wider">E-mail</th>
                <th className="text-left p-4 text-[11px] font-semibold text-white/50 uppercase tracking-wider">Papel</th>
                <th className="text-left p-4 text-[11px] font-semibold text-white/50 uppercase tracking-wider">Status</th>
                <th className="text-left p-4 text-[11px] font-semibold text-white/50 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {team.map(m => (
                <tr key={m.id} className="border-b border-white/5 hover:bg-blue-400/5 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-[#2563EB] to-[#60A5FA] rounded-full flex items-center justify-center text-xs font-bold text-white ring-1 ring-white/15 shadow-[0_4px_12px_rgba(37,99,235,0.4)]">
                        {(m.name || '?')[0]}
                      </div>
                      <span className="font-semibold text-sm text-white">{m.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-white/55">{m.email}</td>
                  <td className="p-4">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${roleColors[m.role] || 'bg-white/10 text-white/60 ring-1 ring-white/15'}`}>
                      {roleLabels[m.role] || m.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <button onClick={() => updateMutation.mutate({ id: m.id, data: { active: !m.active } })}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full cursor-pointer transition-colors ${m.active ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/30 hover:bg-emerald-400/25' : 'bg-white/8 text-white/50 ring-1 ring-white/15 hover:bg-white/12'}`}>
                      {m.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => setPermsTarget(m)}
                        className="text-xs px-2 py-1 rounded-lg font-medium bg-violet-400/12 text-violet-200 ring-1 ring-violet-400/25 hover:bg-violet-400/20 inline-flex items-center gap-1 transition-colors"
                        title="Configurar permissões e unidades"
                      >
                        <Shield className="w-3 h-3" />Permissões
                      </button>
                      <button
                        onClick={() => resendMutation.mutate(m.id)}
                        disabled={resendMutation.isPending}
                        className="text-xs px-2 py-1 rounded-lg font-medium bg-blue-400/12 text-blue-200 ring-1 ring-blue-400/25 hover:bg-blue-400/20 inline-flex items-center gap-1 disabled:opacity-50 transition-colors"
                        title="Reenviar e-mail de convite"
                      >
                        {resendMutation.isPending && resendMutation.variables === m.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Send className="w-3 h-3" />}
                        Reenviar convite
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {team.length === 0 && (
                <tr><td colSpan={5} className="p-12 text-center text-white/45 text-sm">Nenhum membro na equipe</td></tr>
              )}
            </tbody>
          </table>
         </div>
        </div>

        <StandardModal
          open={showForm}
          onClose={() => setShowForm(false)}
          title="Convidar Membro"
          footer={
            <>
              <button onClick={() => setShowForm(false)} className="flex-1 min-h-[48px] px-4 border border-white/12 bg-white/[0.04] text-white/80 rounded-xl text-sm font-medium hover:bg-white/[0.08] active:bg-white/[0.1] transition-colors">Cancelar</button>
              <button
                onClick={() => inviteMutation.mutate(form)}
                disabled={!form.name || !form.email || inviteMutation.isPending}
                className="flex-1 min-h-[48px] px-4 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-xl text-sm font-semibold ring-1 ring-white/15 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(37,99,235,0.4)] transition-all"
              >
                {inviteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Enviar convite
              </button>
            </>
          }
        >
          <p className="text-xs text-white/55 mb-5 flex items-start gap-1.5">
            <Mail className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            Um e-mail será enviado automaticamente com o link de acesso.
          </p>
          <div className="space-y-4">
            {[
              { label: 'Nome *', key: 'name', type: 'text' },
              { label: 'E-mail *', key: 'email', type: 'email' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-semibold text-white/60 block mb-1">{f.label}</label>
                <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none" />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Papel</label>
              <FilterSelect value={form.role} onChange={(v) => setForm(p => ({ ...p, role: v }))} className="w-full">
                <option value="admin">Admin</option>
                <option value="recepcao">Recepção</option>
                <option value="barbeiro">Barbeiro</option>
                <option value="financeiro">Financeiro</option>
              </FilterSelect>
            </div>
          </div>
        </StandardModal>

        <MemberPermissionsModal
          open={!!permsTarget}
          onClose={() => setPermsTarget(null)}
          member={permsTarget}
        />
      </div>
    </AppLayout>
  );
}