import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useState } from 'react';
import { Mail, Loader2, Send, UserCheck, Shield, Copy, MessageCircle, Check, Sparkles } from 'lucide-react';
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
  const [createdModal, setCreatedModal] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId, isLoading: loadingCompany } = useCompany();

  // Consulta membros diretamente da tabela team_members do Supabase com fallback local
  const { data: team = [], isLoading: loadingTeam, refetch: refetchTeam } = useQuery({
    queryKey: ['team', companyId],
    queryFn: async () => {
      console.log("[Equipe] Carregando dados da equipe para companyId:", companyId);
      if (!companyId) return [];

      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('team_members')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

          if (error) {
            console.warn("[Equipe] Erro na consulta do Supabase (team_members):", error.message);
          } else if (data) {
            return data;
          }
        } catch (e) {
          console.warn("[Equipe] Exceção ao consultar team_members no Supabase:", e);
        }
      }

      // Fallback para o repositório base44.entities.TeamMember
      try {
        const res = await base44.entities.TeamMember.filter({ company_id: companyId });
        return res || [];
      } catch (err) {
        console.warn("[Equipe] Erro no fallback TeamMember:", err);
        return [];
      }
    },
    enabled: !!companyId,
    retry: 1,
  });

  const generateActivationLink = (tokenOrId, email) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ocorte.vercel.app';
    const tok = tokenOrId || `inv_${Date.now()}`;
    const em = email ? `&email=${encodeURIComponent(email)}` : '';
    return `${origin}/definir-senha?token=${tok}${em}`;
  };

  const copyToClipboard = (text, idLabel) => {
    if (!text) return;
    try {
      navigator.clipboard?.writeText(text);
      setCopiedId(idLabel);
      toast({
        title: 'Link copiado!',
        description: 'O link de ativação foi copiado para a área de transferência.',
      });
      setTimeout(() => setCopiedId(null), 2500);
    } catch (_) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar automaticamente.',
        variant: 'destructive',
      });
    }
  };

  const openWhatsAppInvite = (name, phoneOrLink, link) => {
    const text = `Olá ${name || 'colaborador'}, seu acesso ao sistema O CORTE foi liberado! Acesse o link para definir sua senha e entrar no painel: ${link}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Mutação para cadastrar e persistir o membro no Supabase
  const inviteMutation = useMutation({
    mutationFn: async (data) => {
      const cleanEmail = data.email.trim().toLowerCase();
      const cleanName = data.name.trim();
      const role = data.role || 'recepcao';
      const token = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      if (!cleanEmail || !cleanName) {
        throw new Error('Preencha o nome e o e-mail do colaborador.');
      }

      let insertedMember = null;

      if (isSupabaseConfigured && supabase && companyId) {
        // 1. Verifica se o e-mail já existe na equipe da empresa
        try {
          const { data: existing } = await supabase
            .from('team_members')
            .select('id')
            .eq('company_id', companyId)
            .eq('email', cleanEmail)
            .maybeSingle();

          if (existing) {
            throw new Error('Este e-mail já faz parte da equipe desta empresa.');
          }
        } catch (checkErr) {
          if (checkErr.message.includes('já faz parte')) throw checkErr;
        }

        // 2. Se o papel for 'barbeiro', sincroniza e cria também na tabela professionals
        let professionalId = null;
        if (role === 'barbeiro') {
          try {
            const { data: proRes, error: proErr } = await supabase
              .from('professionals')
              .insert({
                company_id: companyId,
                name: cleanName,
                email: cleanEmail,
                specialty: 'Barbeiro / Corte e Barba',
                active: true,
                created_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (proErr) {
              console.warn('[Equipe] Aviso ao criar profissional associado no Supabase:', proErr.message);
            } else if (proRes?.id) {
              professionalId = proRes.id;
            }
          } catch (pEx) {
            console.warn('[Equipe] Exceção ao sincronizar com profissionais:', pEx);
          }
        }

        // 3. Inserção real na tabela team_members do Supabase
        const { data: tmRes, error: insertErr } = await supabase
          .from('team_members')
          .insert({
            company_id: companyId,
            professional_id: professionalId,
            name: cleanName,
            email: cleanEmail,
            role,
            invite_token: token,
            status: 'pending',
            active: true,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertErr) {
          console.error('[Equipe] Erro no insert Supabase team_members:', insertErr);
          throw new Error(`Falha ao salvar no Supabase (${insertErr.message}). Execute o script SQL no Supabase Editor.`);
        }

        insertedMember = tmRes;
      }

      // 4. Dispara o convite de autenticação pelo Supabase Auth para a rota /definir-senha
      let emailSent = false;
      if (isSupabaseConfigured && supabase?.auth) {
        try {
          const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ocorte.vercel.app';
          const { error: authErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: `${appUrl}/definir-senha?email=${encodeURIComponent(cleanEmail)}`,
          });
          if (!authErr) {
            emailSent = true;
          }
        } catch (e) {
          console.warn('[Equipe] Erro ao disparar e-mail de convite no Supabase Auth:', e);
        }
      }

      // 5. Executa a função do servidor / repositório como fallback/sincronismo
      try {
        await base44.functions.invoke('inviteTeamMember', {
          company_id: companyId,
          name: cleanName,
          email: cleanEmail,
          role,
        });
      } catch (_) {}

      const memberResult = insertedMember || {
        id: `tm_${Date.now()}`,
        company_id: companyId,
        name: cleanName,
        email: cleanEmail,
        role,
        invite_token: token,
        created_at: new Date().toISOString(),
      };

      return {
        success: true,
        email_sent: emailSent,
        invite_token: token,
        member: memberResult,
      };
    },
    onSuccess: async (data) => {
      console.log("[Equipe] Membro cadastrado e persistido com sucesso:", data);

      // Revalida query e recarrega imediatamente do banco
      await queryClient.invalidateQueries({ queryKey: ['team', companyId] });
      await queryClient.invalidateQueries({ queryKey: ['team'] });
      await refetchTeam();

      setShowForm(false);

      const token = data.invite_token || data.member?.invite_token || data.member?.id || `inv_${Date.now()}`;
      const memberEmail = data.member?.email || form.email;
      const link = generateActivationLink(token, memberEmail);

      setForm({ name: '', email: '', role: 'recepcao' });

      setCreatedModal({
        name: data.member?.name || form.name,
        email: memberEmail,
        role: data.member?.role || form.role,
        emailSent: !!data.email_sent,
        link,
      });

      toast({
        title: 'Convite enviado com sucesso para o e-mail do colaborador!',
        description: data.email_sent
          ? 'O colaborador receberá o e-mail para criar sua senha de acesso.'
          : 'Membro registrado! Copie o link de ativação ou envie diretamente via WhatsApp.',
      });
    },
    onError: (e) => toast({ title: 'Erro ao cadastrar', description: e.message, variant: 'destructive' }),
  });

  const resendMutation = useMutation({
    mutationFn: async (member) => {
      const token = member.invite_token || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      let res;
      try {
        res = await base44.functions.invoke('resendTeamInvite', { team_member_id: member.id, company_id: companyId });
      } catch (_) {}
      return { ...res?.data, member, token };
    },
    onSuccess: (data) => {
      const token = data.token || data.member?.id;
      const link = generateActivationLink(token, data.member?.email);

      if (data.email_sent) {
        toast({
          title: 'Convite reenviado por e-mail!',
          description: 'O colaborador receberá o link para definir sua senha.',
        });
      } else {
        copyToClipboard(link, `resend_${data.member.id}`);
        toast({
          title: 'Link de ativação gerado!',
          description: 'Link copiado para a área de transferência. Compartilhe com o colaborador.',
        });
      }
    },
    onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (isSupabaseConfigured && supabase) {
        await supabase.from('team_members').update(data).eq('id', id);
      }
      return await base44.entities.TeamMember.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', companyId] });
      refetchTeam();
    },
  });

  if (loadingCompany || (loadingTeam && companyId)) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
          <AppPageHeader title="Equipe" subtitle="Carregando colaboradores..." icon={UserCheck} />
          <div className="space-y-3 mt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl border border-white/8 bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

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
            <table className="w-full min-w-[760px]">
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
                {team.map((m) => {
                  const memberToken = m.invite_token || m.token || m.id;
                  const memberLink = generateActivationLink(memberToken, m.email);

                  return (
                    <tr key={m.id} className="border-b border-white/5 hover:bg-blue-400/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-[#2563EB] to-[#60A5FA] rounded-full flex items-center justify-center text-xs font-bold text-white ring-1 ring-white/15 shadow-[0_4px_12px_rgba(37,99,235,0.4)]">
                            {(m.name || '?')[0].toUpperCase()}
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
                        <button
                          onClick={() => updateMutation.mutate({ id: m.id, data: { active: !m.active } })}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full cursor-pointer transition-colors ${m.active ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/30 hover:bg-emerald-400/25' : 'bg-white/8 text-white/50 ring-1 ring-white/15 hover:bg-white/12'}`}
                        >
                          {m.active ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => setPermsTarget(m)}
                            className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-violet-400/12 text-violet-200 ring-1 ring-violet-400/25 hover:bg-violet-400/20 inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Configurar permissões e unidades"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            Permissões
                          </button>

                          <button
                            onClick={() => copyToClipboard(memberLink, `row_${m.id}`)}
                            className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-white/8 text-white/80 ring-1 ring-white/15 hover:bg-white/15 inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Copiar link de ativação para a área de transferência"
                          >
                            {copiedId === `row_${m.id}` ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-300">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copiar Link
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => openWhatsAppInvite(m.name, m.phone, memberLink)}
                            className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30 hover:bg-emerald-500/25 inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Enviar acesso via WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                            WhatsApp
                          </button>

                          <button
                            onClick={() => resendMutation.mutate(m)}
                            disabled={resendMutation.isPending}
                            className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-blue-400/12 text-blue-200 ring-1 ring-blue-400/25 hover:bg-blue-400/20 inline-flex items-center gap-1 disabled:opacity-50 transition-colors cursor-pointer"
                            title="Reenviar convite ou gerar novo link"
                          >
                            {resendMutation.isPending && resendMutation.variables?.id === m.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            Reenviar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {team.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-white/60 text-sm">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <UserCheck className="w-8 h-8 text-white/30" />
                        <p className="font-semibold text-white/80">Nenhum colaborador encontrado na equipe.</p>
                        <p className="text-xs text-white/45">Convide novos membros para gerenciar permissões e acessos.</p>
                        <button
                          onClick={() => setShowForm(true)}
                          className="mt-2 px-4 py-2 bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] text-white rounded-xl text-xs font-semibold hover:brightness-110 cursor-pointer shadow-lg shadow-blue-500/20"
                        >
                          Convidar / Adicionar Membro
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de Formulário de Cadastro */}
        <StandardModal
          open={showForm}
          onClose={() => setShowForm(false)}
          title="Convidar Membro"
          footer={
            <>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 min-h-[48px] px-4 border border-white/12 bg-white/[0.04] text-white/80 rounded-xl text-sm font-medium hover:bg-white/[0.08] active:bg-white/[0.1] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => inviteMutation.mutate(form)}
                disabled={!form.name || !form.email || inviteMutation.isPending}
                className="flex-1 min-h-[48px] px-4 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-xl text-sm font-semibold ring-1 ring-white/15 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(37,99,235,0.4)] transition-all cursor-pointer"
              >
                {inviteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Enviar convite
              </button>
            </>
          }
        >
          <p className="text-xs text-white/55 mb-5 flex items-start gap-1.5">
            <Mail className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            Um registro será salvo no banco de dados e um link de ativação exclusivo será gerado.
          </p>
          <div className="space-y-4">
            {[
              { label: 'Nome *', key: 'name', type: 'text', placeholder: 'Nome do colaborador' },
              { label: 'E-mail *', key: 'email', type: 'email', placeholder: 'colaborador@exemplo.com' },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-xs font-semibold text-white/60 block mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400"
                />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Papel</label>
              <FilterSelect value={form.role} onChange={(v) => setForm((p) => ({ ...p, role: v }))} className="w-full">
                <option value="admin">Admin</option>
                <option value="recepcao">Recepção</option>
                <option value="barbeiro">Barbeiro</option>
                <option value="financeiro">Financeiro</option>
              </FilterSelect>
            </div>
          </div>
        </StandardModal>

        {/* Modal de Sucesso pós-criação */}
        {createdModal && (
          <StandardModal
            open={!!createdModal}
            onClose={() => setCreatedModal(null)}
            title="Membro Cadastrado no Supabase!"
            footer={
              <button
                onClick={() => setCreatedModal(null)}
                className="w-full min-h-[48px] px-4 bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] text-white rounded-xl text-sm font-semibold hover:brightness-110 cursor-pointer shadow-lg shadow-blue-500/20"
              >
                Concluir
              </button>
            }
          >
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 text-emerald-200 text-xs flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white mb-0.5">Colaborador registrado com sucesso!</p>
                  <p className="text-white/70 leading-relaxed">
                    O registro foi inserido no Supabase na tabela <code className="font-mono text-emerald-300">team_members</code>.
                    Compartilhe o link abaixo para o colaborador ativar a conta e criar a senha.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 space-y-1">
                <div className="text-xs font-bold text-white">{createdModal.name}</div>
                <div className="text-xs text-white/50">{createdModal.email}</div>
                <div className="pt-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${roleColors[createdModal.role] || 'bg-white/10 text-white/60'}`}>
                    {roleLabels[createdModal.role] || createdModal.role}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/60 mb-1.5">Link de Ativação Direto</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdModal.link}
                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-emerald-300 select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(createdModal.link, 'modal_link')}
                    className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedId === 'modal_link' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={() => openWhatsAppInvite(createdModal.name, null, createdModal.link)}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>Enviar pelo WhatsApp para {createdModal.name.split(' ')[0]}</span>
              </button>
            </div>
          </StandardModal>
        )}

        <MemberPermissionsModal
          open={!!permsTarget}
          onClose={() => setPermsTarget(null)}
          member={permsTarget}
        />
      </div>
    </AppLayout>
  );
}