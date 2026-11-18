// Seção das campanhas de disparo por ciclo de vida (boas-vindas, fidelização, recuperação, reativação, VIP).
// Salva em Company.lifecycle_campaigns. O job runLifecycleCampaigns lê dessa configuração de hora em hora.

import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Zap, Save, FlaskConical, AlertCircle, Filter } from 'lucide-react';
import { CAMPAIGN_KEYS, mergeCampaignsConfig } from '@/lib/lifecycleCampaigns';
import CampaignEditor from './CampaignEditor';

const CAMPAIGN_CATEGORIES = [
  { id: 'all',         label: 'Todas',                    keys: CAMPAIGN_KEYS },
  { id: 'visitantes',  label: 'Boas-vindas',              keys: ['primeira_visita'] },
  { id: 'fidelizacao', label: 'Fidelização',              keys: ['fiel_sem_plano'] },
  { id: 'recuperacao', label: 'Recuperação / Em risco',   keys: ['em_risco'] },
  { id: 'reativacao',  label: 'Reativação / Inativos',    keys: ['inativo', 'perdido'] },
  { id: 'vip',         label: 'Clientes VIP',             keys: ['vip_inativo'] },
];

export default function LifecycleCampaignsSection({
  company,
  title = 'Campanhas de Disparo Automático',
  subtitle = 'Ative campanhas de boas-vindas, reativação e VIP e personalize os modelos de mensagem.',
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState(() => mergeCampaignsConfig(company?.lifecycle_campaigns));
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setCampaigns(mergeCampaignsConfig(company?.lifecycle_campaigns));
    setDirty(false);
  }, [company?.id]);

  const enabledCount = useMemo(
    () => CAMPAIGN_KEYS.filter((k) => campaigns[k]?.enabled).length,
    [campaigns]
  );

  const visibleCampaignKeys = useMemo(() => {
    const found = CAMPAIGN_CATEGORIES.find((c) => c.id === selectedCategory);
    return found ? found.keys : CAMPAIGN_KEYS;
  }, [selectedCategory]);

  const saveMutation = useMutation({
    mutationFn: () => base44.entities.Company.update(company.id, { lifecycle_campaigns: campaigns }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['my-company'] });
      toast({ title: 'Campanhas salvas', description: `${enabledCount} campanha(s) ativa(s).` });
      setDirty(false);
    },
    onError: (err) => toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' }),
  });

  const testMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke('runLifecycleCampaigns', {
        company_id: company.id,
        dry_run: true,
        limit: 50,
      }),
    onSuccess: (res) => {
      const totals = res?.data?.totals || {};
      const total = Object.values(totals).reduce((s, n) => s + (Number(n) || 0), 0);
      const breakdown = Object.entries(totals)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${k.replace(/_sent$/, '')}: ${n}`)
        .join(', ');
      toast({
        title: total > 0 ? `${total} mensagens seriam enviadas agora` : 'Nenhuma mensagem elegível agora',
        description: breakdown || 'Sem clientes que atendam aos critérios + cooldown.',
      });
    },
    onError: (err) => toast({ title: 'Erro no teste', description: err.message, variant: 'destructive' }),
  });

  const updateCampaign = (key, newCfg) => {
    setCampaigns((prev) => ({ ...prev, [key]: newCfg }));
    setDirty(true);
  };

  if (!company) return null;

  const whatsappOff = company.whatsapp_settings?.enabled === false;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.025] backdrop-blur-md p-5 sm:p-6 shadow-sm">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center shadow-sm ring-1 ring-white/15">
            <Zap className="relative w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">{title}</h2>
            <p className="text-xs text-slate-500 dark:text-white/55 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black leading-none text-[#2563EB] dark:text-[#93C5FD]">
            {enabledCount}
            <span className="text-sm text-slate-400 dark:text-white/40 font-bold">/{CAMPAIGN_KEYS.length}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-white/55 font-semibold uppercase tracking-wider mt-0.5">
            campanhas ativas
          </div>
        </div>
      </div>

      {/* Filtro por Categoria */}
      <div className="mb-4" data-testid="crm-campaign-categories">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-2">
          <Filter className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
          <span>Categorias de Campanha</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CAMPAIGN_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  active
                    ? 'bg-blue-50 dark:bg-[#2563EB]/25 text-[#2563EB] dark:text-[#93C5FD] border-blue-300 dark:border-[#60A5FA]/50 shadow-sm'
                    : 'bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-white/60 border-slate-200 dark:border-white/10 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.07]'
                }`}
              >
                {cat.label}
                <span className="ml-1.5 text-[10px] opacity-75">({cat.keys.length})</span>
              </button>
            );
          })}
        </div>
      </div>

      {whatsappOff && (
        <div className="mt-4 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-400/[0.08] border border-amber-200 dark:border-amber-400/30 px-3 py-2.5 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-300" />
          <span>
            O envio automático de WhatsApp está <strong className="text-amber-950 dark:text-amber-200">desligado</strong> em Parâmetros Gerais de Envio acima. Ative para que os disparos funcionem.
          </span>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {visibleCampaignKeys.map((key) => (
          <CampaignEditor
            key={key}
            campaignKey={key}
            value={campaigns[key]}
            onChange={(newCfg) => updateCampaign(key, newCfg)}
            companyName={company.name}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3 items-center">
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className="inline-flex items-center gap-2 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm ring-1 ring-white/15 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Salvando...' : dirty ? 'Salvar campanhas' : 'Campanhas salvas'}
        </button>
        <button
          type="button"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending || enabledCount === 0}
          className="inline-flex items-center gap-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/15 text-slate-700 dark:text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:border-blue-300 dark:hover:border-blue-400/40 hover:text-[#2563EB] dark:hover:text-[#93C5FD] hover:bg-slate-100 dark:hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          title={enabledCount === 0 ? 'Ative pelo menos uma campanha' : 'Simula o envio sem disparar mensagens'}
        >
          <FlaskConical className={`w-4 h-4 ${testMutation.isPending ? 'animate-pulse' : ''}`} />
          {testMutation.isPending ? 'Testando...' : 'Simular disparos (dry-run)'}
        </button>
        {dirty && (
          <span className="text-[11px] text-amber-600 dark:text-amber-300 font-semibold">Você tem mudanças não salvas</span>
        )}
      </div>
    </div>
  );
}