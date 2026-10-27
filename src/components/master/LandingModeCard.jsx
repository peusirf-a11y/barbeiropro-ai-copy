// Card de configuração — alterna entre landing principal e landing de lançamento.
// Persiste num FeatureFlag global (key='landing_mode') e nos metadados públicos do Supabase: enabled=true → launch, false → default.

import { useEffect, useState } from 'react';
import { Rocket, Globe, Check, Loader2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { clearFeatureFlagCache } from '@/lib/featureFlags';
import { useToast } from '@/components/ui/use-toast';

const FLAG_KEY = 'landing_mode';

export default function LandingModeCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('default'); // 'default' | 'launch'
  const [flagId, setFlagId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [flags, modeRes] = await Promise.all([
          base44.entities.FeatureFlag.filter({ key: FLAG_KEY }).catch(() => []),
          base44.functions.invoke('getLandingMode', {}).catch(() => ({ data: null })),
        ]);
        const flag = flags?.[0];
        if (flag) {
          setFlagId(flag.id);
          const resolved = flag.enabled ? 'launch' : 'default';
          setMode(resolved);
          // Garante sincronização imediata com o Supabase caso estivesse salvo apenas localmente
          base44.functions.invoke('setLandingMode', { mode: resolved }).catch(() => {});
        } else if (modeRes?.data?.mode) {
          setMode(modeRes.data.mode === 'launch' ? 'launch' : 'default');
        }
      } catch (e) {
        console.error('[LandingModeCard] load failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setLandingMode = async (next) => {
    setSaving(true);
    try {
      const enabled = next === 'launch';
      if (flagId) {
        await base44.entities.FeatureFlag.update(flagId, { enabled });
      } else {
        const created = await base44.entities.FeatureFlag.create({
          key: FLAG_KEY,
          enabled,
          scope: 'global',
          description: 'Quando ativada, /landing exibe a landing de lançamento (Plano Master R$ 79,90/mês).',
        });
        if (created?.id) setFlagId(created.id);
      }

      const res = await base44.functions.invoke('setLandingMode', { mode: next });
      if (res?.data?.flag_id && !flagId) {
        setFlagId(res.data.flag_id);
      }

      clearFeatureFlagCache();
      setMode(next);
      toast({
        title: next === 'launch' ? 'Landing de lançamento ativada!' : 'Landing principal ativada!',
        description:
          next === 'launch'
            ? 'A rota /landing e a raiz pública agora exibem a página de oferta de lançamento.'
            : 'A rota /landing e a raiz pública agora exibem a landing principal oficial.',
      });
    } catch (e) {
      console.error('[LandingModeCard] save failed', e);
      toast({
        title: 'Erro ao salvar alteração',
        description: 'Não foi possível alterar o modo da landing. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-6 flex items-center gap-3 text-white/60">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
      </div>
    );
  }

  const options = [
    {
      id: 'default',
      icon: Globe,
      title: 'Landing principal',
      desc: 'A landing premium oficial com IA, recorrência e prova social completa.',
    },
    {
      id: 'launch',
      icon: Rocket,
      title: 'Landing de lançamento',
      desc: 'Oferta Plano Master: R$ 79,90/mês nos primeiros 3 meses (depois R$ 119,00/mês) com 7 dias grátis.',
    },
  ];

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="font-bold text-white text-lg">Modo da landing pública</h3>
          <p className="text-sm text-white/55 mt-1 max-w-xl leading-relaxed">
            Define qual landing é exibida em <code className="text-[#93C5FD] font-mono text-xs">/landing</code> (e
            quando usuários não logados acessam a raiz pública).
          </p>
        </div>
        <Link
          to="/landing"
          target="_blank"
          rel="noreferrer"
          className="inline-flex self-start items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white/80 border border-white/12 bg-white/[0.04] rounded-lg hover:bg-white/[0.08] transition-colors shrink-0"
        >
          Ver /landing ativa <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {options.map((opt) => {
          const active = mode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={saving}
              onClick={() => !active && setLandingMode(opt.id)}
              className={`text-left rounded-xl border p-4 transition-all ${
                active
                  ? 'border-[#60A5FA]/45 bg-[#60A5FA]/10 ring-1 ring-[#60A5FA]/30 shadow-[0_8px_24px_rgba(37,99,235,0.18)]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
              } disabled:opacity-60`}
            >
              <div className="flex items-start justify-between mb-2">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                    active
                      ? 'bg-[#60A5FA]/15 border-[#60A5FA]/40 text-[#93C5FD]'
                      : 'bg-white/[0.04] border-white/10 text-white/75'
                  }`}
                >
                  <opt.icon className="w-4 h-4" />
                </div>
                {active && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-200 border border-emerald-400/30">
                    <Check className="w-3 h-3" /> Ativa
                  </span>
                )}
              </div>
              <div className="font-bold text-white text-[15px]">{opt.title}</div>
              <p className="text-xs text-white/55 mt-1 leading-relaxed">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      {saving && (
        <div className="flex items-center gap-2 mt-4 text-xs text-white/55">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando…
        </div>
      )}
    </div>
  );
}