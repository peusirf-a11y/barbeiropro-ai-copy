// Seção principal das automações de retenção (Fase 3.2).
// Agrupa as 6 campanhas em CampaignEditor + botões "Salvar" e "Testar agora (dry-run)".
//
// Salva em Company.lifecycle_campaigns. O job runLifecycleCampaigns lê dessa
// configuração de hora em hora.

import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Zap, Save, FlaskConical, AlertCircle } from 'lucide-react';
import { CAMPAIGN_KEYS, mergeCampaignsConfig } from '@/lib/lifecycleCampaigns';
import CampaignEditor from './CampaignEditor';

export default function LifecycleCampaignsSection({ company }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState(() => mergeCampaignsConfig(company?.lifecycle_campaigns));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setCampaigns(mergeCampaignsConfig(company?.lifecycle_campaigns));
    setDirty(false);
  }, [company?.id]);

  const enabledCount = useMemo(
    () => CAMPAIGN_KEYS.filter(k => campaigns[k]?.enabled).length,
    [campaigns]
  );

  const saveMutation = useMutation({
    mutationFn: () => base44.entities.Company.update(company.id, { lifecycle_campaigns: campaigns }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'Automações salvas', description: `${enabledCount} campanha(s) ativa(s).` });
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
    <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.25)]">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-[#111827]">Automações de retenção</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Mensagens automáticas baseadas no ciclo de vida de cada cliente.
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-[#2563EB] leading-none">{enabledCount}<span className="text-sm text-gray-400 font-bold">/{CAMPAIGN_KEYS.length}</span></div>
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">campanhas ativas</div>
        </div>
      </div>

      {whatsappOff && (
        <div className="mt-4 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>O envio de WhatsApp está <strong>desligado</strong> nas configurações de mensagens. Ative para que as automações funcionem.</span>
        </div>
      )}

      <div className="mt-5 space-y-2">
        {CAMPAIGN_KEYS.map(key => (
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
          className="inline-flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_12px_rgba(37,99,235,0.2)]"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Salvando...' : dirty ? 'Salvar automações' : 'Tudo salvo'}
        </button>
        <button
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending || enabledCount === 0}
          className="inline-flex items-center gap-2 bg-white border border-black/10 text-[#111827] px-4 py-2.5 rounded-xl text-sm font-semibold hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          title={enabledCount === 0 ? 'Ative pelo menos uma campanha' : 'Simula o envio sem disparar mensagens'}
        >
          <FlaskConical className={`w-4 h-4 ${testMutation.isPending ? 'animate-pulse' : ''}`} />
          {testMutation.isPending ? 'Testando...' : 'Testar agora (sem enviar)'}
        </button>
        {dirty && (
          <span className="text-[11px] text-amber-700 font-semibold">Você tem mudanças não salvas</span>
        )}
      </div>
    </div>
  );
}