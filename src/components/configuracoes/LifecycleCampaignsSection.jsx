// Seção principal das automações de retenção (Fase 3.2).
// Agrupa as 6 campanhas em CampaignEditor + botões "Salvar" e "Testar agora (dry-run)".
//
// Salva em Company.lifecycle_campaigns. O job runLifecycleCampaigns lê dessa
// configuração de hora em hora.

import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Zap, Save, FlaskConical, AlertCircle, Filter } from 'lucide-react';
import { CAMPAIGN_KEYS, mergeCampaignsConfig } from '@/lib/lifecycleCampaigns';
import CampaignEditor from './CampaignEditor';

const CAMPAIGN_CATEGORIES = [
  { id: 'all',        label: 'Todas as categorias', keys: CAMPAIGN_KEYS },
  { id: 'visitantes', label: 'Boas-vindas / Visitantes', keys: ['primeira_visita'] },
  { id: 'fidelizacao', label: 'Fidelização', keys: ['fiel_sem_plano'] },
  { id: 'recuperacao', label: 'Recuperação / Em risco', keys: ['em_risco'] },
  { id: 'reativacao', label: 'Reativação / Inativos', keys: ['inativo', 'perdido'] },
  { id: 'vip',        label: 'Clientes VIP', keys: ['vip_inativo'] },
];

export default function LifecycleCampaignsSection({
  company,
  title = 'Campanhas e Automações de Retenção',
  subtitle = 'Gerencie campanhas por categoria de ciclo de vida e configure mensagens automáticas.',
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
    () => CAMPAIGN_KEYS.filter(k => campaigns[k]?.enabled).length,
    [campaigns]
  );

  const visibleCampaignKeys = useMemo(() => {
    const found = CAMPAIGN_CATEGORIES.find(c => c.id === selectedCategory);
    return found ? found.keys : CAMPAIGN_KEYS;
  }, [selectedCategory]);

  const saveMutation = useMutation({
    mutationFn: () => base44.entities.Company.update(company.id, { lifecycle_campaigns: campaigns }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'Campanhas salvas', description: `${enabledCount} campanha(s) ativa(s).` });
      setDirty(false);
    },
    onError: (err) => toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' }),
  });

  const testMutation = useMutation({
    mutationFn: () => base44.functions.invoke('runLifecycleCampaigns', {
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
    setCampaigns(prev => ({ ...prev, [key]: newCfg }));
    setDirty(true);
  };

  if (!company) return null;

  const whatsappOff = company.whatsapp_settings?.enabled === false;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15">
            <span className="absolute inset-0 rounded-xl bg-[#60A5FA]/30 blur-md opacity-60" aria-hidden="true" />
            <Zap className="relative w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white">{title}</h2>
            <p className="text-xs text-white/55 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black leading-none bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">{enabledCount}<span className="text-sm text-white/40 font-bold">/{CAMPAIGN_KEYS.length}</span></div>
          <div className="text-[10px] text-white/55 font-semibold uppercase tracking-wider mt-0.5">campanhas ativas</div>
        </div>
      </div>

      {/* Filtro por Categoria de Campanha */}
      <div className="mb-4" data-testid="crm-campaign-categories">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">
          <Filter className="w-3.5 h-3.5 text-[#60A5FA]" />
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
                    ? 'bg-[#2563EB]/25 text-[#93C5FD] border-[#60A5FA]/50 shadow-sm'
                    : 'bg-white/[0.03] text-white/60 border-white/10 hover:text-white hover:bg-white/[0.07]'
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
        <div className="mt-4 flex items-start gap-2 text-xs text-amber-100 bg-amber-400/[0.08] border border-amber-400/30 px-3 py-2.5 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-300" />
          <span>O envio de WhatsApp está <strong className="text-amber-200">desligado</strong> nas configurações de mensagens. Ative para que as automações funcionem.</span>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {visibleCampaignKeys.map(key => (
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
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className="inline-flex items-center gap-2 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Salvando...' : dirty ? 'Salvar campanhas' : 'Tudo salvo'}
        </button>
        <button
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending || enabledCount === 0}
          className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/15 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:border-blue-400/40 hover:text-[#93C5FD] hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          title={enabledCount === 0 ? 'Ative pelo menos uma campanha' : 'Simula o envio sem disparar mensagens'}
        >
          <FlaskConical className={`w-4 h-4 ${testMutation.isPending ? 'animate-pulse' : ''}`} />
          {testMutation.isPending ? 'Testando...' : 'Testar agora (sem enviar)'}
        </button>
        {dirty && (
          <span className="text-[11px] text-amber-300 font-semibold">Você tem mudanças não salvas</span>
        )}
      </div>
    </div>
  );
}