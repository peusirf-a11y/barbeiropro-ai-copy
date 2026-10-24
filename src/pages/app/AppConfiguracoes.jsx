import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { resolveCompanyId } from '@/api/functions';
import { supabase } from '@/lib/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { useState, useEffect, useCallback } from 'react';
import { Save, Globe, Copy, CheckCircle, Settings, CreditCard, Upload, Loader2, Building2, Sparkles, Shield, ShieldAlert } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import MyEmailLogs from '@/components/app/MyEmailLogs';
import AppPageHeader from '@/components/app/AppPageHeader';
import DeleteAccountSection from '@/components/configuracoes/DeleteAccountSection';
import { useFeatures } from '@/hooks/useFeatures';
import SettingsShortcutCard, { ActiveBadge } from '@/components/configuracoes/SettingsShortcutCard';
import {
  BUSINESS_DAYS,
  formatTimeHHMM,
  getDefaultBusinessHours,
  normalizeBusinessHours,
} from '@/lib/businessHours';

const defaultHours = getDefaultBusinessHours();

export default function AppConfiguracoes() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { company: activeHookCompany, companyId: activeHookCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const resolveActiveCompanyId = useCallback(async () => {
    if (activeHookCompanyId && activeHookCompanyId !== 'comp_demo_01') return activeHookCompanyId;
    if (activeHookCompany?.id && activeHookCompany.id !== 'comp_demo_01') return activeHookCompany.id;

    try {
      const rawAdmin = localStorage.getItem('admin_logged_user');
      if (rawAdmin) {
        const parsed = JSON.parse(rawAdmin);
        if (parsed?.company_id && parsed.company_id !== 'comp_demo_01') {
          return parsed.company_id;
        }
        if (parsed?.email && supabase) {
          const { data: compByEmail } = await supabase
            .from('companies')
            .select('id')
            .eq('owner_email', parsed.email.trim().toLowerCase())
            .maybeSingle();
          if (compByEmail?.id) return compByEmail.id;
        }
      }
    } catch (_) {}

    try {
      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionEmail = sessionData?.session?.user?.email || user?.email;
        if (sessionEmail) {
          const { data: compBySession } = await supabase
            .from('companies')
            .select('id')
            .eq('owner_email', sessionEmail.trim().toLowerCase())
            .maybeSingle();
          if (compBySession?.id) return compBySession.id;
        }
      }
    } catch (_) {}

    const resolved = await resolveCompanyId({ company_id: activeHookCompanyId });
    if (resolved && resolved !== 'comp_demo_01') return resolved;

    try {
      if (supabase) {
        const { data: firstComp } = await supabase
          .from('companies')
          .select('id')
          .limit(1)
          .maybeSingle();
        if (firstComp?.id) return firstComp.id;
      }
    } catch (_) {}

    return activeHookCompanyId || resolved || null;
  }, [activeHookCompanyId, activeHookCompany, user?.email]);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', activeHookCompanyId, user?.email],
    queryFn: async () => {
      const cid = await resolveActiveCompanyId();
      if (supabase && cid) {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, slug, logo_url, phone, whatsapp, address, primary_color, business_hours, active, owner_email, created_at')
          .eq('id', cid);
        if (!error && Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
      return base44.entities.Company.list();
    },
  });

  const company =
    companies.find(c => c.id === activeHookCompanyId) ||
    companies.find(c => user?.email && c.owner_email?.toLowerCase() === user.email.toLowerCase()) ||
    activeHookCompany ||
    companies[0] ||
    null;

  const { has } = useFeatures();

  const [form, setForm] = useState({
    name: '',
    slug: '',
    phone: '',
    whatsapp: '',
    address: '',
    primary_color: '#2563EB',
    business_hours: defaultHours,
    logo_url: '',
  });

  useEffect(() => {
    if (company) {
      const normalizedHours = normalizeBusinessHours(company);
      const brandingMeta = company.business_hours?._branding || company.opening_hours?._branding || {};
      setForm({
        name: company.name || '',
        slug: company.slug || '',
        phone: company.phone || '',
        whatsapp: company.whatsapp || brandingMeta.whatsapp || '',
        address: company.address || brandingMeta.address || '',
        primary_color: brandingMeta.primary_color || company.primary_color || '#2563EB',
        business_hours: normalizedHours,
        logo_url: company.logo_url || brandingMeta.logo_url || '',
      });
    }
  }, [company?.id, company?.primary_color, company?.business_hours, company?.opening_hours]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(p => ({ ...p, logo_url: file_url }));
    } catch (err) {
      toast({
        title: 'Erro ao enviar logo',
        description: err?.message || 'Não foi possível enviar a imagem.',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const setHour = (day, field, val) => {
    setForm(p => {
      const currentDay = p.business_hours?.[day] || { open: '08:00', close: '20:00', active: day !== 'dom' };
      const nextVal = field === 'active' ? Boolean(val) : val;
      return {
        ...p,
        business_hours: {
          ...p.business_hours,
          [day]: {
            ...currentDay,
            [field]: nextVal,
          },
        },
      };
    });
  };

  const normalizeHourOnBlur = (day, field, fallback) => {
    setForm(p => {
      const currentDay = p.business_hours?.[day] || { open: '08:00', close: '20:00', active: day !== 'dom' };
      const formatted = formatTimeHHMM(currentDay[field], fallback);
      return {
        ...p,
        business_hours: {
          ...p.business_hours,
          [day]: {
            ...currentDay,
            [field]: formatted,
          },
        },
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const activeCompanyId = company?.id || await resolveActiveCompanyId();

      // Serializa garantindo o formato padrão 'HH:mm' (ex: '07:00' até '22:00') em todos os dias
      const serializedHours = {};
      for (const { key } of BUSINESS_DAYS) {
        const dayEntry = form.business_hours?.[key] || defaultHours[key];
        const openFormatted = formatTimeHHMM(dayEntry?.open, '07:00');
        let closeFormatted = formatTimeHHMM(dayEntry?.close, '22:00');

        const [oh, om] = openFormatted.split(':').map(Number);
        const [ch, cm] = closeFormatted.split(':').map(Number);
        if (ch * 60 + cm <= oh * 60 + om && closeFormatted !== '00:00') {
          closeFormatted = '22:00';
        }

        serializedHours[key] = {
          open: openFormatted,
          close: closeFormatted,
          active: Boolean(dayEntry?.active),
        };
      }

      // Preserva metadados existentes (_billing) e armazena _branding dentro de business_hours (JSONB universal)
      const existingBilling = company?.business_hours?._billing || company?.opening_hours?._billing;
      const hoursWithMeta = {
        ...serializedHours,
        ...(existingBilling ? { _billing: existingBilling } : {}),
        _branding: {
          primary_color: form.primary_color || '#2563EB',
          whatsapp: (form.whatsapp || '').trim(),
          address: (form.address || '').trim(),
          logo_url: form.logo_url || '',
        },
      };

      setForm(p => ({ ...p, business_hours: serializedHours }));

      const basePayload = {
        name: (form.name || '').trim(),
        slug: (form.slug || '').trim(),
        phone: (form.phone || '').trim(),
        whatsapp: (form.whatsapp || '').trim(),
        address: (form.address || '').trim(),
        primary_color: form.primary_color || '#2563EB',
        logo_url: form.logo_url || '',
        business_hours: hoursWithMeta,
        opening_hours: hoursWithMeta,
      };

      const selectAfterWrite = 'id, name, slug, logo_url, phone, whatsapp, address, primary_color, business_hours, active, owner_email, created_at';

      if (activeCompanyId) {
        let currentPayload = { ...basePayload };
        let updateResult = await supabase
          .from('companies')
          .update(currentPayload)
          .eq('id', activeCompanyId)
          .select(selectAfterWrite);

        // Remove dinamicamente qualquer coluna opcional inexistente no schema de uma instância específica
        const optionalCols = ['opening_hours', 'primary_color', 'whatsapp', 'address', 'business_hours'];
        for (const col of optionalCols) {
          if (updateResult.error && String(updateResult.error.message || '').includes(col)) {
            delete currentPayload[col];
            updateResult = await supabase
              .from('companies')
              .update(currentPayload)
              .eq('id', activeCompanyId);
          }
        }

        if (updateResult.error) {
          console.error('[AppConfiguracoes] Erro ao atualizar empresa no Supabase:', updateResult.error);
          toast({
            title: 'Erro ao salvar configurações',
            description: updateResult.error.message,
            variant: 'destructive',
          });
          setIsSaving(false);
          return;
        }

        const savedRecord = {
          ...company,
          ...(updateResult.data && updateResult.data[0] ? updateResult.data[0] : {}),
          ...basePayload,
          id: activeCompanyId,
        };

        // Sincroniza cache local e query cache público
        try {
          const rawLocal = localStorage.getItem('barberpass_local_companies');
          const localList = rawLocal ? JSON.parse(rawLocal) : [];
          const exists = localList.some(item => item.id === activeCompanyId);
          const nextLocal = exists
            ? localList.map(item => (item.id === activeCompanyId ? { ...item, ...savedRecord } : item))
            : [savedRecord, ...localList];
          localStorage.setItem('barberpass_local_companies', JSON.stringify(nextLocal));
        } catch (_) {}

        if (savedRecord.slug) {
          queryClient.setQueryData(['company-by-slug', savedRecord.slug], [savedRecord]);
        }
      } else {
        const insertPayload = {
          ...basePayload,
          owner_email: user?.email || '',
          active: true,
          status: 'active',
        };
        let insertResult = await supabase
          .from('companies')
          .insert([insertPayload])
          .select(selectAfterWrite);

        if (insertResult.error && String(insertResult.error.message || '').includes('opening_hours')) {
          const { opening_hours, ...fallbackPayload } = insertPayload;
          insertResult = await supabase
            .from('companies')
            .insert([fallbackPayload]);
        }

        if (insertResult.error) {
          console.error('[AppConfiguracoes] Erro ao criar empresa no Supabase:', insertResult.error);
          toast({
            title: 'Erro ao salvar configurações',
            description: insertResult.error.message,
            variant: 'destructive',
          });
          setIsSaving(false);
          return;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      await queryClient.invalidateQueries({ queryKey: ['my-company'] });
      await queryClient.invalidateQueries({ queryKey: ['company-by-slug'] });

      toast({
        title: 'Configurações salvas!',
        description: 'A cor principal, horários e dados da barbearia foram atualizados.',
      });
    } catch (err) {
      console.error('[AppConfiguracoes] Exceção ao salvar configurações:', err);
      toast({
        title: 'Erro ao salvar configurações',
        description: err?.message || 'Erro inesperado ao salvar configurações.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const publicLink = `${window.location.origin}/agendar/${form.slug || 'sua-barbearia'}`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppLayout>
      <div className="p-3.5 sm:p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Configurações"
          subtitle="Configure sua barbearia e link público de agendamento"
          icon={Settings}
        />

        {/* Public link */}
        {form.slug && (
          <div className="relative rounded-2xl border border-blue-400/25 bg-gradient-to-br from-blue-500/15 to-transparent backdrop-blur-xl p-3.5 sm:p-5 mb-4 sm:mb-5 flex items-center gap-3 sm:gap-4 shadow-[0_8px_24px_rgba(37,99,235,0.2)] overflow-hidden">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#60A5FA]/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center flex-shrink-0 ring-1 ring-white/15 shadow-[0_4px_12px_rgba(37,99,235,0.4)]">
              <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="relative flex-1 min-w-0">
              <div className="text-[10px] sm:text-[11px] font-semibold text-[#93C5FD] uppercase tracking-wider mb-0.5">Seu link público de agendamento</div>
              <div className="text-xs sm:text-sm font-semibold text-white break-all">{publicLink}</div>
            </div>
            <button onClick={copyLink} className={`relative flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 sm:px-3 rounded-lg transition-all flex-shrink-0 ${copied ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30' : 'bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white ring-1 ring-white/15 hover:brightness-110 shadow-[0_4px_12px_rgba(37,99,235,0.4)]'}`}>
              {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        )}

        <div className="space-y-4 sm:space-y-5">
          {/* Basic info */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-3.5 sm:p-6 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <h2 className="font-bold text-sm sm:text-base text-white mb-3.5 sm:mb-5">Informações básicas</h2>

            {/* Logo upload */}
            <div className="mb-4 sm:mb-5">
              <label className="text-xs font-semibold text-white/55 block mb-1.5 sm:mb-2">Logo da barbearia</label>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center bg-white/[0.04] flex-shrink-0">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl sm:text-2xl font-black text-white/25">{form.name?.[0] || '?'}</span>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-white/[0.04] border border-white/12 text-white/80 hover:bg-white/[0.08] hover:border-white/20 transition-colors cursor-pointer">
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

            <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
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
                    className="w-full px-3 py-2 border border-white/10 bg-white/[0.03] rounded-lg text-xs sm:text-sm text-white placeholder:text-white/30" />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-white/55 block mb-1">Endereço</label>
                <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="Rua, número, bairro, cidade"
                  className="w-full px-3 py-2 border border-white/10 bg-white/[0.03] rounded-lg text-xs sm:text-sm text-white placeholder:text-white/30" />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/55 block mb-1">Cor principal</label>
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <input type="color" value={form.primary_color} onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-white/10 bg-white/[0.03] cursor-pointer flex-shrink-0" />
                  <input type="text" value={form.primary_color} onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                    className="flex-1 min-w-0 px-3 py-2 border border-white/10 bg-white/[0.03] rounded-lg text-xs sm:text-sm text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Business hours */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-3.5 sm:p-6 shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden">
            <h2 className="font-bold text-sm sm:text-base text-white mb-3 sm:mb-4">Horários de funcionamento</h2>
            <div className="space-y-1">
              {BUSINESS_DAYS.map(({ key, label }) => {
                const rawH = form.business_hours?.[key] || defaultHours[key];
                const isActive = Boolean(rawH?.active);
                const openVal = formatTimeHHMM(rawH?.open, '07:00');
                const closeVal = formatTimeHHMM(rawH?.close, '22:00');

                return (
                  <div key={key} className="grid grid-cols-[76px_minmax(0,1fr)_auto_minmax(0,1fr)] sm:grid-cols-[110px_1fr_auto_1fr] items-center gap-1.5 sm:gap-3 py-1.5 sm:py-2 border-b border-white/6 last:border-b-0">
                    <label className="flex items-center gap-1.5 sm:gap-2 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={e => setHour(key, 'active', e.target.checked)}
                        className="flex-shrink-0 accent-[#2563EB] w-3.5 h-3.5 sm:w-4 sm:h-4"
                      />
                      <span className={`text-xs sm:text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-white/40'}`}>
                        {label}
                      </span>
                    </label>
                    {isActive ? (
                      <>
                        <input
                          type="time"
                          step="60"
                          value={openVal}
                          onChange={e => setHour(key, 'open', formatTimeHHMM(e.target.value, openVal))}
                          onBlur={() => normalizeHourOnBlur(key, 'open', '07:00')}
                          className="w-full min-w-0 px-2 sm:px-3 py-1.5 sm:py-2 border border-white/10 bg-white/[0.04] rounded-lg text-xs sm:text-sm font-mono text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA]"
                        />
                        <span className="text-white/40 text-[11px] sm:text-xs px-0.5">até</span>
                        <input
                          type="time"
                          step="60"
                          value={closeVal}
                          onChange={e => setHour(key, 'close', formatTimeHHMM(e.target.value, closeVal))}
                          onBlur={() => normalizeHourOnBlur(key, 'close', '22:00')}
                          className="w-full min-w-0 px-2 sm:px-3 py-1.5 sm:py-2 border border-white/10 bg-white/[0.04] rounded-lg text-xs sm:text-sm font-mono text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA]"
                        />
                      </>
                    ) : (
                      <span className="text-xs sm:text-sm text-white/35 col-span-3">Fechado</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 sm:mt-6">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl text-sm font-semibold ring-1 ring-white/15 hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_8px_24px_rgba(37,99,235,0.4)] hover:shadow-[0_12px_32px_rgba(37,99,235,0.55)] active:scale-[0.98]"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>

        {/* Asaas Connect — atalho para a página dedicada */}
        {company && has('online_payments') && (
          <SettingsShortcutCard
            title="Pagamentos online"
            description="Conecte sua conta Asaas para receber pagamentos via Pix e cartão direto pelo seu link público."
            icon={CreditCard}
            ctaLabel="Gerenciar pagamentos"
            to="/app/configuracoes/pagamentos"
            statusBadge={(company?.asaas_api_key || company?.asaas_pix_enabled) ? <ActiveBadge /> : null}
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