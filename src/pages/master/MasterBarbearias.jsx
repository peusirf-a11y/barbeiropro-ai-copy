// MasterBarbearias.jsx — Gestão de Barbearias + Fluxo de Onboarding Assistido / Venda Manual
// Suporta provisionamento completo em public.companies e convite/vínculo via Supabase Auth Admin.

import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Plus,
  Loader2,
  Building2,
  Mail,
  User,
  Phone,
  CreditCard,
  Sparkles,
  Globe,
  Send,
  AlertCircle,
} from 'lucide-react';
import CompaniesTable from '@/components/master/CompaniesTable';
import StandardModal from '@/components/ui/standard-modal';
import { useToast } from '@/components/ui/use-toast';

export function sanitizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function formatPhoneMask(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const INITIAL_FORM_STATE = {
  name: '',
  owner_email: '',
  owner_name: '',
  phone: '',
  subscription_status: 'trial',
  plan: 'Starter',
  send_invite: true,
};

const SUBSCRIPTION_STATUS_OPTIONS = [
  {
    value: 'trial',
    label: 'Período de Testes (Trial 7 dias)',
    hint: 'Libera acesso imediato por 7 dias com status de avaliação.',
  },
  {
    value: 'manual_active',
    label: 'Ativo Manual / Cortesia',
    hint: 'Ativa a conta imediatamente sem exigir cobrança automática.',
  },
  {
    value: 'pending_payment',
    label: 'Pendente de Pagamento',
    hint: 'Cria o tenant aguardando compensação financeira para liberar.',
  },
];

const PLAN_OPTIONS = [
  { value: 'Starter', label: 'Starter' },
  { value: 'Pro', label: 'Pro' },
  { value: 'Premium', label: 'Premium' },
];

export default function MasterBarbearias() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [customSlug, setCustomSlug] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Gera o slug automaticamente a partir do Nome da Barbearia (ou usa customSlug se editado)
  const resolvedSlug = useMemo(() => {
    const raw = customSlug.trim() ? customSlug : form.name;
    return sanitizeSlug(raw);
  }, [form.name, customSlug]);

  const isEmailValid = useMemo(() => {
    const clean = String(form.owner_email || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
  }, [form.owner_email]);

  const isFormValid = Boolean(form.name.trim().length >= 2 && isEmailValid);

  const resetModalState = () => {
    setForm(INITIAL_FORM_STATE);
    setCustomSlug('');
    setErrorMsg('');
  };

  const handleCloseModal = () => {
    if (createMutation.isPending) return;
    setShowForm(false);
    resetModalState();
  };

  const createMutation = useMutation({
    mutationFn: async (formData) => {
      setErrorMsg('');
      const slugToUse =
        sanitizeSlug(customSlug || formData.name) ||
        `barbearia-${Math.floor(1000 + Math.random() * 9000)}`;

      const res = await base44.functions.invoke('createManualCompany', {
        name: formData.name.trim(),
        slug: slugToUse,
        owner_email: formData.owner_email.trim().toLowerCase(),
        owner_name: formData.owner_name.trim(),
        phone: formData.phone.trim(),
        subscription_status: formData.subscription_status,
        plan: formData.plan,
        send_invite: Boolean(formData.send_invite),
      });

      if (!res?.data?.success) {
        throw new Error(
          res?.data?.error || 'Não foi possível concluir o provisionamento da barbearia.'
        );
      }

      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['master-companies'] });
      queryClient.invalidateQueries({ queryKey: ['master-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['master-audit-log'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });

      const createdCompany = data?.company || {};
      const authInfo = data?.auth || {};

      let toastDescription = `A barbearia "${createdCompany.name || form.name}" (/agendar/${createdCompany.slug || resolvedSlug}) foi provisionada com sucesso.`;

      if (authInfo.user_already_existed) {
        toastDescription += ` O e-mail já possuía conta e foi vinculado diretamente à empresa.`;
      } else if (authInfo.invite_sent) {
        toastDescription += ` Convite de criação de senha enviado para ${createdCompany.owner_email || form.owner_email}.`;
      } else if (authInfo.warning) {
        toastDescription += ` (${authInfo.warning})`;
      }

      toast({
        title: 'Barbearia provisionada com sucesso!',
        description: toastDescription,
      });

      setShowForm(false);
      resetModalState();
    },
    onError: (err) => {
      const friendlyMessage =
        err?.message || 'Erro ao criar a barbearia. Verifique os dados e tente novamente.';
      setErrorMsg(friendlyMessage);
      toast({
        title: 'Falha ao provisionar barbearia',
        description: friendlyMessage,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!isFormValid || createMutation.isPending) return;
    createMutation.mutate(form);
  };

  const selectedStatusMeta = SUBSCRIPTION_STATUS_OPTIONS.find(
    (opt) => opt.value === form.subscription_status
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Barbearias</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de tenants, status financeiro e onboarding assistido (venda manual).
          </p>
        </div>
        <button
          onClick={() => {
            resetModalState();
            setShowForm(true);
          }}
          className="text-xs font-semibold bg-[#2563EB] text-white hover:bg-[#1d4ed8] px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-[0_4px_12px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" /> Nova empresa (Onboarding Assistido)
        </button>
      </div>

      <CompaniesTable />

      <StandardModal
        open={showForm}
        onClose={handleCloseModal}
        title="Nova Empresa Cliente · Onboarding Assistido"
        subtitle="Provisione manualmente uma barbearia e envie o convite oficial de acesso ao proprietário."
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={createMutation.isPending}
              className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isFormValid || createMutation.isPending}
              className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 shadow-[0_4px_12px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Provisionando barbearia…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Criar e provisionar empresa
                </>
              )}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-xs font-medium text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Nome da Barbearia + Slug Automático */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
              Nome da Barbearia <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex.: Barbearia Imperial"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
            />
            <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 truncate">
                <Globe className="w-3 h-3 text-[#2563EB] shrink-0" />
                Link público:{' '}
                <strong className="text-foreground font-mono">
                  https://ocorte.app/agendar/{resolvedSlug || 'sua-barbearia'}
                </strong>
              </span>
              {form.name && (
                <input
                  type="text"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(sanitizeSlug(e.target.value))}
                  placeholder="Personalizar slug (opcional)"
                  className="px-2 py-0.5 border border-border rounded-lg text-[11px] bg-muted/40 text-foreground w-44 font-mono"
                />
              )}
            </div>
          </div>

          {/* 2. E-mail do Proprietário / Responsável (Obrigatório) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#2563EB]" />
              E-mail do Proprietário / Responsável <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="proprietario@barbearia.com.br"
              value={form.owner_email}
              onChange={(e) => setForm((p) => ({ ...p, owner_email: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
            />
          </div>

          {/* 3. Nome do Responsável & Telefone/WhatsApp (Opcionais) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                Nome do Responsável <span className="text-[10px] opacity-70">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex.: Carlos Eduardo"
                value={form.owner_name}
                onChange={(e) => setForm((p) => ({ ...p, owner_name: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                Telefone / WhatsApp <span className="text-[10px] opacity-70">(opcional)</span>
              </label>
              <input
                type="tel"
                placeholder="(11) 99999-9999"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: formatPhoneMask(e.target.value) }))
                }
                className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              />
            </div>
          </div>

          {/* 4. Status Inicial da Subscrição & Plano Selecionado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[#2563EB]" />
                Status Inicial da Subscrição
              </label>
              <select
                value={form.subscription_status}
                onChange={(e) =>
                  setForm((p) => ({ ...p, subscription_status: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              >
                {SUBSCRIPTION_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                Plano Selecionado
              </label>
              <select
                value={form.plan}
                onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedStatusMeta && (
            <p className="text-[11px] text-muted-foreground bg-muted/40 border border-border/60 rounded-xl px-3 py-2">
              {selectedStatusMeta.hint}
            </p>
          )}

          {/* 5. Checkbox de Convite Automático via Supabase Auth */}
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors select-none">
            <input
              type="checkbox"
              checked={form.send_invite}
              onChange={(e) =>
                setForm((p) => ({ ...p, send_invite: e.target.checked }))
              }
              className="mt-0.5 h-4 w-4 rounded border-border text-[#2563EB] focus:ring-[#2563EB]"
            />
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-[#2563EB]" />
                Enviar e-mail de convite para criação de senha imediatamente
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Se o e-mail ainda não possuir conta no Supabase Auth, envia o convite oficial de acesso. Caso já exista, vincula a nova barbearia diretamente ao usuário existente.
              </span>
            </div>
          </label>
        </form>
      </StandardModal>
    </div>
  );
}