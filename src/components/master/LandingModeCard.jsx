// Card de configuração — alterna entre landing principal e landing de lançamento.
// Persiste num FeatureFlag global (key='landing_mode'): enabled=true → launch, false → default.

import { useEffect, useState } from 'react';
import { Rocket, Globe, Check, Loader2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

const FLAG_KEY = 'landing_mode';

export default function LandingModeCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('default'); // 'default' | 'launch'
  const [flagId, setFlagId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const flags = await base44.entities.FeatureFlag.filter({ key: FLAG_KEY });
        const flag = flags[0];
        if (flag) {
          setFlagId(flag.id);
          setMode(flag.enabled ? 'launch' : 'default');
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
          description: 'Quando ativada, /landing exibe a landing de lançamento (R$ 49/mês).',
        });
        setFlagId(created.id);
      }
      setMode(next);
    } catch (e) {
      console.error('[LandingModeCard] save failed', e);
      alert('Não consegui salvar a alteração. Tente novamente.');
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
      desc: 'Oferta R$ 49/mês por 6 meses, foco em conversão dos 10 primeiros clientes.',
    },
  ];

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="font-bold text-white text-lg">Modo da landing pública</h3>
          <p className="text-sm text-white/55 mt-1 max-w-xl leading-relaxed">
            Define qual landing é exibida em <code className="text-[#93C5FD] font-mono text-xs">/landing</code> (e
            quando usuários não logados acessam a raiz pública).
          </p>
        </div>
        <Link
          to="/lancamento"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white/80 border border-white/12 bg-white/[0.04] rounded-lg hover:bg-white/[0.08] transition-colors"
        >
          Pré-visualizar lançamento <ExternalLink className="w-3 h-3" />
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