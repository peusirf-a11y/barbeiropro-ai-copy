import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useState, useEffect } from 'react';
import { Save, Globe, Copy, CheckCircle, Settings, CreditCard } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import MyEmailLogs from '@/components/app/MyEmailLogs';
import AppPageHeader from '@/components/app/AppPageHeader';
import DeleteAccountSection from '@/components/configuracoes/DeleteAccountSection';
import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';

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

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const company = companies.find(c => c.owner_email === user?.email) || companies[0];

  const [form, setForm] = useState({
    name: '', slug: '', phone: '', whatsapp: '', address: '', primary_color: '#2563EB', business_hours: defaultHours,
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
      });
    }
  }, [company]);

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
          <div className="bg-gradient-to-br from-[#EFF6FF] to-white border border-[#DBEAFE] rounded-2xl p-5 mb-6 flex items-center gap-4 shadow-[var(--shadow-sm)]">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(37,99,235,0.25)]">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-[#2563EB] uppercase tracking-wider mb-0.5">Seu link público de agendamento</div>
              <div className="text-sm font-semibold text-[#111827] break-all">{publicLink}</div>
            </div>
            <button onClick={copyLink} className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex-shrink-0 ${copied ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-[#2563EB] text-white hover:bg-[#1d4ed8] shadow-[0_4px_12px_rgba(37,99,235,0.25)]'}`}>
              {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        )}

        <div className="space-y-6">
          {/* Basic info */}
          <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
            <h2 className="font-bold text-[#111827] mb-5">Informações básicas</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { label: 'Nome da barbearia', key: 'name', placeholder: 'Ex: Barbearia Studio 47' },
                { label: 'Slug (URL pública)', key: 'slug', placeholder: 'ex: studio47' },
                { label: 'Telefone', key: 'phone', placeholder: '(11) 99999-9999' },
                { label: 'WhatsApp', key: 'whatsapp', placeholder: '11999999999' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{f.label}</label>
                  <input type="text" value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-gray-500 block mb-1">Endereço</label>
                <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="Rua, número, bairro, cidade"
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Cor principal</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.primary_color} onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-black/10 cursor-pointer" />
                  <input type="text" value={form.primary_color} onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                    className="flex-1 px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
                </div>
              </div>
            </div>
          </div>

          {/* Business hours */}
          <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
            <h2 className="font-bold text-[#111827] mb-5">Horários de funcionamento</h2>
            <div className="space-y-3">
              {DAYS.map(({ key, label }) => {
                const h = form.business_hours[key] || { open: '09:00', close: '19:00', active: false };
                return (
                  <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-1.5 border-b border-black/5 last:border-b-0">
                    <label className="flex items-center gap-2 sm:w-32 flex-shrink-0">
                      <input type="checkbox" checked={h.active} onChange={e => setHour(key, 'active', e.target.checked)} />
                      <span className={`text-sm font-semibold ${h.active ? 'text-[#111827]' : 'text-[#6B7280]'}`}>{label}</span>
                    </label>
                    {h.active ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input type="time" value={h.open} onChange={e => setHour(key, 'open', e.target.value)}
                          className="flex-1 min-w-0 px-2 py-1.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
                        <span className="text-gray-400 text-sm flex-shrink-0">até</span>
                        <input type="time" value={h.close} onChange={e => setHour(key, 'close', e.target.value)}
                          className="flex-1 min-w-0 px-2 py-1.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Fechado</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button onClick={handleSave}
            className="flex items-center gap-2 bg-[#2563EB] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#1d4ed8] transition-all shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.35)] active:scale-[0.98]">
            <Save className="w-4 h-4" />
            Salvar configurações
          </button>
        </div>

        {/* Stripe Connect — atalho para a página dedicada */}
        {company && (
          <div className="mt-6 bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
              <h2 className="font-bold text-[#111827]">Pagamentos online</h2>
              {company?.stripe_connect_charges_enabled && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Ativo
                </span>
              )}
            </div>
            <p className="text-sm text-[#6B7280] mb-4">
              Conecte sua conta Stripe para receber pagamentos via Pix e cartão direto pelo seu link público.
            </p>
            <Link
              to="/app/configuracoes/pagamentos"
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Gerenciar pagamentos
            </Link>
          </div>
        )}

        {/* Multi-unidade */}
        <div className="mt-6 bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
            <h2 className="font-bold text-[#111827]">Unidades</h2>
            {company?.multi_unit_enabled && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Ativo
              </span>
            )}
          </div>
          <p className="text-sm text-[#6B7280] mb-4">
            Gerencie filiais da sua barbearia, defina como os clientes são organizados entre unidades e ative o seletor no topo do app.
          </p>
          <Link
            to="/app/configuracoes/unidades"
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Gerenciar unidades
          </Link>
        </div>

        <div className="mt-8">
          <MyEmailLogs />
        </div>

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