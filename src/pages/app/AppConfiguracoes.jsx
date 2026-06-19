import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useState, useEffect } from 'react';
import { Save, Globe, Copy, CheckCircle, Settings, CreditCard, Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import MyEmailLogs from '@/components/app/MyEmailLogs';
import AppPageHeader from '@/components/app/AppPageHeader';
import DeleteAccountSection from '@/components/configuracoes/DeleteAccountSection';
import { Building2, Sparkles, Shield, ShieldAlert } from 'lucide-react';
import { useFeatures } from '@/hooks/useFeatures';
import SettingsShortcutCard, { ActiveBadge } from '@/components/configuracoes/SettingsShortcutCard';

const DAYS = [
  { key: 'seg', label: 'Segunda' }, { key: 'ter', label: 'Terça' }, { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' }, { key: 'sex', label: 'Sexta' }, { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

const defaultHours = Object.fromEntries(DAYS.map(d => [d.key, { open: '09:00', close: '19:00', active: d.key !== 'dom' }]));

export default function AppConfiguracoes() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const company = companies.find(c => c.owner_email === user?.email) || companies[0];
  const { has } = useFeatures();

  const [form, setForm] = useState({
    name: '', slug: '', phone: '', whatsapp: '', address: '', primary_color: '#2563EB', business_hours: defaultHours, logo_url: '',
  });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || '',
        slug: company.slug || '',
        phone: company.phone || '',
        whatsapp: company.whatsapp || '',
        address: company.address || '',
        primary_color: company.primary_color || '#2563EB',
        business_hours: company.business_hours || defaultHours,
        logo_url: company.logo_url || '',
      });
    }
  }, [company]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(p => ({ ...p, logo_url: file_url }));
    } finally {
      setUploadingLogo(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Company.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['companies'] }); toast({ title: 'Configurações salvas!' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Company.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['companies'] }); toast({ title: 'Configurações salvas!' }); },
  });

  const handleSave = () => {
    if (company) updateMutation.mutate({ id: company.id, data: form });
    else createMutation.mutate(form);
  };

  const publicLink = `${window.location.origin}/agendar/${form.slug || 'sua-barbearia'}`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setHour = (day, field, val) => {
    setForm(p => ({ ...p, business_hours: { ...p.business_hours, [day]: { ...p.business_hours[day], [field]: val } } }));
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Configurações"
          subtitle="Configure sua barbearia e link público de agendamento"
          icon={Settings}
        />

        {/* Public link */}
        {form.slug && (
          <div className="relative rounded-2xl border border-blue-400/25 bg-gradient-to-br from-blue-500/15 to-transparent backdrop-blur-xl p-5 mb-6 flex items-center gap-4 shadow-[0_8px_24px_rgba(37,99,235,0.2)] overflow-hidden">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#60A5FA]/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center flex-shrink-0 ring-1 ring-white/15 shadow-[0_4px_12px_rgba(37,99,235,0.4)]">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div className="relative flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-[#93C5FD] uppercase tracking-wider mb-0.5">Seu link público de agendamento</div>
              <div className="text-sm font-semibold text-white break-all">{publicLink}</div>
            </div>
            <button onClick={copyLink} className={`relative flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex-shrink-0 ${copied ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30' : 'bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white ring-1 ring-white/15 hover:brightness-110 shadow-[0_4px_12px_rgba(37,99,235,0.4)]'}`}>
              {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        )}

        <div className="space-y-6">
          {/* Basic info */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <h2 className="font-bold text-white mb-5">Informações básicas</h2>

            {/* Logo upload */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-white/55 block mb-2">Logo da barbearia</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center bg-white/[0.04] flex-shrink-0">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-black text-white/25">{form.name?.[0] || '?'}</span>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/12 text-white/80 hover:bg-white/[0.08] hover:border-white/20 transition-colors cursor-pointer">
                  {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploadingLogo ? 'Enviando...' : 'Enviar logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                </label>
                {form.logo_url && (
                  <button onClick={() => setForm(p => ({ ...p, logo_url: '' }))} className="text-xs text-red-300 hover:text-red-200">
                    Remover
                  </button>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                { label: 'Nome da barbearia', key: 'name', placeholder: 'Ex: Barbearia Studio 47' },
                { label: 'Slug (URL pública)', key: 'slug', placeholder: 'ex: studio47' },
                { label: 'Telefone', key: 'phone', placeholder: '(11) 99999-9999' },
                { label: 'WhatsApp', key: 'whatsapp', placeholder: '11999999999' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-white/55 block mb-1">{f.label}</label>
                  <input type="text" value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2.5 border border-white/10 bg-white/[0.03] rounded-lg text-sm text-white placeholder:text-white/30" />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-white/55 block mb-1">Endereço</label>
                <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="Rua, número, bairro, cidade"
                  className="w-full px-3 py-2.5 border border-white/10 bg-white/[0.03] rounded-lg text-sm text-white placeholder:text-white/30" />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/55 block mb-1">Cor principal</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.primary_color} onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-white/10 bg-white/[0.03] cursor-pointer" />
                  <input type="text" value={form.primary_color} onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                    className="flex-1 px-3 py-2.5 border border-white/10 bg-white/[0.03] rounded-lg text-sm text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Business hours */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-4 sm:p-6 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <h2 className="font-bold text-white mb-4">Horários de funcionamento</h2>
            <div className="space-y-1">
              {DAYS.map(({ key, label }) => {
                const h = form.business_hours[key] || { open: '09:00', close: '19:00', active: false };
                return (
                  <div key={key} className="grid grid-cols-[88px_1fr_auto_1fr] items-center gap-2 py-1.5 border-b border-white/6 last:border-b-0">
                    <label className="flex items-center gap-1.5 min-w-0">
                      <input type="checkbox" checked={h.active} onChange={e => setHour(key, 'active', e.target.checked)} className="flex-shrink-0 accent-[#2563EB]" />
                      <span className={`text-sm font-semibold truncate ${h.active ? 'text-white' : 'text-white/40'}`}>{label}</span>
                    </label>
                    {h.active ? (
                      <>
                        <input type="time" value={h.open} onChange={e => setHour(key, 'open', e.target.value)}
                          className="w-full min-w-0 px-2 py-1.5 border border-white/10 bg-white/[0.03] rounded-lg text-sm text-white" />
                        <span className="text-white/40 text-xs px-1">até</span>
                        <input type="time" value={h.close} onChange={e => setHour(key, 'close', e.target.value)}
                          className="w-full min-w-0 px-2 py-1.5 border border-white/10 bg-white/[0.03] rounded-lg text-sm text-white" />
                      </>
                    ) : (
                      <span className="text-sm text-white/35 col-span-3">Fechado</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button onClick={handleSave}
            className="flex items-center gap-2 bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white px-6 py-3 rounded-xl font-semibold ring-1 ring-white/15 hover:brightness-110 transition-all shadow-[0_8px_24px_rgba(37,99,235,0.4)] hover:shadow-[0_12px_32px_rgba(37,99,235,0.55)] active:scale-[0.98]">
            <Save className="w-4 h-4" />
            Salvar configurações
          </button>
        </div>

        {/* Stripe Connect — atalho para a página dedicada */}
        {company && has('stripe_payments') && (
          <SettingsShortcutCard
            title="Pagamentos online"
            description="Conecte sua conta Asaas para receber pagamentos via Pix e cartão direto pelo seu link público."
            icon={CreditCard}
            ctaLabel="Gerenciar pagamentos"
            to="/app/configuracoes/pagamentos"
            statusBadge={company?.stripe_connect_charges_enabled ? <ActiveBadge /> : null}
          />
        )}

        {/* Multi-unidade */}
        {has('multi_units') && (
          <SettingsShortcutCard
            title="Unidades"
            description="Gerencie filiais da sua barbearia, defina como os clientes são organizados entre unidades e ative o seletor no topo do app."
            icon={Building2}
            ctaLabel="Gerenciar unidades"
            to="/app/configuracoes/unidades"
            statusBadge={company?.multi_unit_enabled ? <ActiveBadge /> : null}
          />
        )}

        {/* CRM & Retenção — central unificada */}
        {has('crm_retention') && (
          <SettingsShortcutCard
            title="CRM & Retenção"
            description="Lifecycle dos clientes, sugestões de VIP, campanhas automáticas e mensagens transacionais — tudo em um só lugar."
            icon={Sparkles}
            ctaLabel="Abrir central de CRM"
            to="/app/crm"
          />
        )}

        {/* Privacidade & LGPD */}
        {company && (
          <SettingsShortcutCard
            title="Privacidade & LGPD"
            description="Central de auditoria LGPD, exportação de dados, anonimização, gestão de consentimentos e direitos dos titulares."
            icon={Shield}
            ctaLabel="Abrir central de privacidade"
            to="/app/configuracoes/privacidade"
            statusBadge={<ActiveBadge>✓ Compliance ativo</ActiveBadge>}
          />
        )}

        <div className="mt-8">
          <MyEmailLogs />
        </div>

        {/* Segurança & Auditoria */}
        {company && (
          <SettingsShortcutCard
            title="Segurança & Auditoria"
            description="Trilha de auditoria de ações críticas, alertas de segurança e eventos da sua conta."
            icon={ShieldAlert}
            ctaLabel="Ver auditoria e segurança"
            to="/app/configuracoes/seguranca"
          />
        )}

        {/* Zona de risco — sair / excluir conta */}
        {company && (
          <DeleteAccountSection
            company={company}
            isOwner={!!user?.email && company.owner_email === user.email}
          />
        )}
      </div>
    </AppLayout>
  );
}