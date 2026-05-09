import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useState } from 'react';
import { Plus, X, Mail, Loader2, Send, UserCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import StandardModal from '@/components/ui/standard-modal';
import FilterSelect from '@/components/ui/filter-select';

const roleLabels = { admin: 'Admin', recepcao: 'Recepção', barbeiro: 'Barbeiro', financeiro: 'Financeiro' };
const roleColors = { admin: 'bg-violet-50 text-violet-700', recepcao: 'bg-blue-50 text-blue-700', barbeiro: 'bg-emerald-50 text-emerald-700', financeiro: 'bg-amber-50 text-amber-700' };

export default function AppEquipe() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'recepcao' });
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

        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
         <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-black/5 bg-[#FAFBFC]">
                <th className="text-left p-4 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Membro</th>
                <th className="text-left p-4 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">E-mail</th>
                <th className="text-left p-4 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Papel</th>
                <th className="text-left p-4 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Status</th>
                <th className="text-left p-4 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {team.map(m => (
                <tr key={m.id} className="border-b border-black/5 hover:bg-[#FAFBFC] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-[#2563EB] to-[#60A5FA] rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm">
                        {(m.name || '?')[0]}
                      </div>
                      <span className="font-semibold text-sm text-[#111827]">{m.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-[#6B7280]">{m.email}</td>
                  <td className="p-4">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${roleColors[m.role] || 'bg-gray-100 text-gray-600'}`}>
                      {roleLabels[m.role] || m.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <button onClick={() => updateMutation.mutate({ id: m.id, data: { active: !m.active } })}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full cursor-pointer ${m.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => resendMutation.mutate(m.id)}
                      disabled={resendMutation.isPending}
                      className="text-xs px-2 py-1 rounded-lg font-medium bg-blue-50 text-[#2563EB] hover:bg-blue-100 inline-flex items-center gap-1 disabled:opacity-50"
                      title="Reenviar e-mail de convite"
                    >
                      {resendMutation.isPending && resendMutation.variables === m.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Send className="w-3 h-3" />}
                      Reenviar convite
                    </button>
                  </td>
                </tr>
              ))}
              {team.length === 0 && (
                <tr><td colSpan={5} className="p-12 text-center text-[#6B7280] text-sm">Nenhum membro na equipe</td></tr>
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
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium">Cancelar</button>
              <button
                onClick={() => inviteMutation.mutate(form)}
                disabled={!form.name || !form.email || inviteMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#2563EB]/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {inviteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Enviar convite
              </button>
            </>
          }
        >
          <p className="text-xs text-gray-500 mb-5 flex items-start gap-1.5">
            <Mail className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            Um e-mail será enviado automaticamente com o link de acesso.
          </p>
          <div className="space-y-4">
            {[
              { label: 'Nome *', key: 'name', type: 'text' },
              { label: 'E-mail *', key: 'email', type: 'email' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-semibold text-gray-500 block mb-1">{f.label}</label>
                <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Papel</label>
              <FilterSelect value={form.role} onChange={(v) => setForm(p => ({ ...p, role: v }))} className="w-full">
                <option value="admin">Admin</option>
                <option value="recepcao">Recepção</option>
                <option value="barbeiro">Barbeiro</option>
                <option value="financeiro">Financeiro</option>
              </FilterSelect>
            </div>
          </div>
        </StandardModal>
      </div>
    </AppLayout>
  );
}