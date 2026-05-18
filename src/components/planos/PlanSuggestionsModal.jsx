import { useState, useEffect } from 'react';
import { X, Sparkles, TrendingUp, Users, Activity, Check, AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Modal de geração automática de planos.
// Etapas:
//  1. analyze — chama backend, mostra métricas + sugestões com checkboxes
//  2. created — confirma que rascunhos foram criados
export default function PlanSuggestionsModal({ companyId, onClose, onCreated }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState({}); // { 0: true, 1: true, ... } índice → bool
  const [creating, setCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('generatePlanSuggestions', {
          company_id: companyId, action: 'analyze',
        });
        if (cancelled) return;
        if (res?.data?.error) throw new Error(res.data.error);
        setAnalysis(res.data);
        // Pré-seleciona todas as sugestões
        const initialSelected = {};
        (res.data?.suggestions || []).forEach((_, i) => { initialSelected[i] = true; });
        setSelected(initialSelected);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || err?.message || 'Erro ao analisar dados.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  const handleCreate = async () => {
    const toCreate = (analysis.suggestions || []).filter((_, i) => selected[i]);
    if (toCreate.length === 0) return;
    setCreating(true);
    try {
      const res = await base44.functions.invoke('generatePlanSuggestions', {
        company_id: companyId,
        action: 'create',
        plans: toCreate.map(s => ({
          name: s.name,
          description: s.description,
          price_monthly: s.price_monthly,
          type: s.type,
          usage_limit: s.usage_limit,
        })),
      });
      if (res?.data?.success) {
        setCreatedCount(res.data.created_count);
        onCreated?.();
      } else {
        throw new Error(res?.data?.error || 'Falha ao criar planos');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Erro ao criar planos.');
    } finally {
      setCreating(false);
    }
  };

  const m = analysis?.metrics;
  const allSuggestions = analysis?.suggestions || [];
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0A1124] border border-white/8 rounded-2xl w-full max-w-3xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] flex flex-col max-h-[92vh] text-white" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] ring-1 ring-white/15 flex items-center justify-center text-white shadow-[0_8px_24px_rgba(37,99,235,0.4)]">
              <span className="absolute inset-0 rounded-xl bg-[#60A5FA]/30 blur-md opacity-60" aria-hidden="true" />
              <Sparkles className="relative w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-lg">Gerador automático de planos</h3>
              <p className="text-xs text-white/55">Sugestões baseadas no comportamento real dos seus clientes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><X className="w-5 h-5 text-white/60" /></button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 modal-scroll">
          {loading && (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-[#93C5FD] animate-spin mx-auto mb-3" />
              <p className="text-sm text-white/55">Analisando últimos 180 dias...</p>
            </div>
          )}

          {!loading && error && (
            <div className="bg-rose-400/[0.08] border border-rose-400/25 rounded-xl p-4 flex items-start gap-2 text-sm text-rose-100">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {!loading && analysis?.insufficient_data && (
            <div className="bg-amber-400/[0.08] border border-amber-400/25 rounded-xl p-5 text-center">
              <AlertCircle className="w-8 h-8 text-amber-300 mx-auto mb-2" />
              <p className="font-semibold text-amber-100 text-sm mb-1">Histórico insuficiente</p>
              <p className="text-xs text-amber-200/80">{analysis.message}</p>
            </div>
          )}

          {!loading && createdCount > 0 && (
            <div className="bg-emerald-400/[0.08] border border-emerald-400/25 rounded-xl p-5 text-center">
              <div className="w-12 h-12 bg-emerald-400/15 ring-1 ring-emerald-400/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-emerald-300" />
              </div>
              <p className="font-bold text-emerald-100 mb-1">{createdCount} {createdCount === 1 ? 'plano criado' : 'planos criados'} como rascunho</p>
              <p className="text-xs text-emerald-200/80">Revise os preços e clique em "Ativar" para começar a vender.</p>
              <button onClick={onClose} className="mt-4 px-5 py-2 bg-emerald-500/90 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-[0_4px_16px_rgba(16,185,129,0.3)]">
                Ver meus planos
              </button>
            </div>
          )}

          {!loading && !error && !analysis?.insufficient_data && createdCount === 0 && m && (
            <>
              {/* Métricas detectadas */}
              <div className="mb-5">
                <h4 className="text-xs font-bold uppercase tracking-wide text-white/55 mb-3">📊 Diagnóstico do seu negócio</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricCard icon={Users} label="Clientes ativos" value={m.total_customers} />
                  <MetricCard icon={Activity} label="Frequência média" value={`${m.frequencia_media_mes}x/mês`} />
                  <MetricCard icon={TrendingUp} label="Ticket médio" value={`R$${m.ticket_medio.toFixed(0)}`} />
                  <MetricCard icon={Activity} label="Ocupação atual" value={`${m.occupancy_pct}%`}
                    color={m.occupancy_pct > 85 ? 'text-emerald-300' : m.occupancy_pct < 60 ? 'text-amber-300' : 'text-[#93C5FD]'} />
                </div>
                <div className="mt-3 px-3 py-2 bg-blue-400/[0.08] border border-blue-400/25 rounded-lg text-xs text-blue-100">
                  <strong>Estratégia:</strong> {analysis.discount_strategy.label}
                </div>
                {analysis.low_data && (
                  <div className="mt-2 px-3 py-2 bg-amber-400/[0.08] border border-amber-400/25 rounded-lg text-xs text-amber-100 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span><strong>Poucos dados:</strong> sua base ainda é pequena. As estimativas podem não ser precisas — revise os preços antes de ativar.</span>
                  </div>
                )}
              </div>

              {/* Sugestões */}
              <div className="mb-5">
                <h4 className="text-xs font-bold uppercase tracking-wide text-white/55 mb-3">💡 Planos sugeridos</h4>
                <div className="space-y-2">
                  {allSuggestions.map((s, i) => (
                    <SuggestionCard
                      key={i}
                      suggestion={s}
                      checked={!!selected[i]}
                      onToggle={() => setSelected(p => ({ ...p, [i]: !p[i] }))}
                    />
                  ))}
                </div>
              </div>

              {/* Projeção */}
              {analysis.projections?.projected_mrr > 0 && (
                <div className="bg-blue-400/[0.08] border border-blue-400/25 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-[#93C5FD]" />
                    <span className="text-xs font-bold uppercase tracking-wide text-blue-100">Projeção conservadora</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-[#93C5FD]">MRR adicional projetado</div>
                      <div className="text-2xl font-black bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">R${analysis.projections.projected_mrr.toLocaleString('pt-BR')}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#93C5FD]">ARR adicional projetado</div>
                      <div className="text-2xl font-black bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">R${analysis.projections.projected_arr.toLocaleString('pt-BR')}</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#93C5FD]/80 mt-2">
                    Estimativa baseada em conversão de {Math.round(analysis.projections.conversion_rate_assumed * 100)}% dos clientes elegíveis para cada plano.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && !analysis?.insufficient_data && createdCount === 0 && (
          <div className="flex items-center justify-between gap-3 p-5 border-t border-white/8 bg-white/[0.02]">
            <div className="text-xs text-white/55">
              {selectedCount > 0 ? `${selectedCount} ${selectedCount === 1 ? 'plano selecionado' : 'planos selecionados'}` : 'Selecione ao menos 1 plano'}
              · será criado como rascunho (inativo)
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg text-sm font-medium text-white/80 transition-colors">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={selectedCount === 0 || creating}
                className="px-5 py-2 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] hover:brightness-110 text-white rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15">
                {creating ? 'Criando...' : 'Criar planos sugeridos'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color = 'text-white' }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/55 mb-1">
        <Icon className="w-3 h-3" />{label}
      </div>
      <div className={`text-lg font-black ${color}`}>{value}</div>
    </div>
  );
}

const HEALTH_STYLES = {
  safe: { badge: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/25', dot: '🟢', label: 'Margem saudável', boxBg: 'bg-emerald-400/[0.08] border-emerald-400/20', boxText: 'text-emerald-200', boxLabel: 'text-emerald-300/80' },
  warn: { badge: 'bg-amber-400/15 text-amber-200 border-amber-400/25',       dot: '🟡', label: 'Atenção',          boxBg: 'bg-amber-400/[0.08] border-amber-400/20',   boxText: 'text-amber-200',   boxLabel: 'text-amber-300/80' },
  risk: { badge: 'bg-rose-400/15 text-rose-200 border-rose-400/25',          dot: '🔴', label: 'Risco',            boxBg: 'bg-rose-400/[0.08] border-rose-400/20',     boxText: 'text-rose-200',    boxLabel: 'text-rose-300/80' },
};

function SuggestionCard({ suggestion: s, checked, onToggle }) {
  const health = HEALTH_STYLES[s.margin_health || 'safe'];
  return (
    <label className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-all ${checked ? 'border-[#60A5FA]/40 bg-blue-400/[0.06] shadow-[0_4px_16px_rgba(37,99,235,0.15)]' : 'border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.04]'}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1 w-4 h-4 rounded accent-[#60A5FA]" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <div className="font-bold text-white flex items-center gap-2 flex-wrap">
              {s.name}
              {s.recommended && <span className="text-[10px] font-bold bg-emerald-400/15 text-emerald-200 border border-emerald-400/25 px-2 py-0.5 rounded-full">⭐ Recomendado</span>}
              {s.off_peak && <span className="text-[10px] font-bold bg-amber-400/15 text-amber-200 border border-amber-400/25 px-2 py-0.5 rounded-full">Off-Peak</span>}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${health.badge}`} title={health.label}>
                {health.dot} {health.label}
              </span>
            </div>
            <div className="text-xs text-white/55 mt-0.5">{s.description}</div>
            {s.price_adjusted && (
              <div className="text-[10px] text-amber-200 mt-1 font-medium">⚙️ Preço ajustado automaticamente para garantir margem saudável</div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xl font-black bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">R${s.price_monthly}</div>
            <div className="text-[10px] text-white/40 uppercase">por mês</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
          <div className="bg-white/[0.04] border border-white/8 rounded px-2 py-1">
            <div className="text-white/45">Avulso seria</div>
            <div className="font-bold text-white/75 line-through">R${s.avulso_equivalent}</div>
          </div>
          <div className="bg-emerald-400/[0.08] border border-emerald-400/20 rounded px-2 py-1">
            <div className="text-emerald-300/80">Cliente economiza</div>
            <div className="font-bold text-emerald-200">R${s.savings}/mês</div>
          </div>
          <div className={`${health.boxBg} border rounded px-2 py-1`}>
            <div className={health.boxLabel}>Margem estimada</div>
            <div className={`font-bold ${health.boxText}`}>{s.margin_pct}%</div>
          </div>
        </div>
        <div className="text-[11px] text-white/55 mt-2">
          🎯 {s.target_segment} · <strong className="text-white/80">{s.target_count}</strong> {s.target_count === 1 ? 'cliente' : 'clientes'} no perfil
        </div>
      </div>
    </label>
  );
}