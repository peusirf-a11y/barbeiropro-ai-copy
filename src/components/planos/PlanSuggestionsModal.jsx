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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl my-8" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-black/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-[#111827] text-lg">Gerador automático de planos</h3>
              <p className="text-xs text-gray-500">Sugestões baseadas no comportamento real dos seus clientes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Analisando últimos 180 dias...</p>
            </div>
          )}

          {!loading && error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {!loading && analysis?.insufficient_data && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <p className="font-semibold text-amber-900 text-sm mb-1">Histórico insuficiente</p>
              <p className="text-xs text-amber-800">{analysis.message}</p>
            </div>
          )}

          {!loading && createdCount > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="font-bold text-emerald-900 mb-1">{createdCount} {createdCount === 1 ? 'plano criado' : 'planos criados'} como rascunho</p>
              <p className="text-xs text-emerald-700">Revise os preços e clique em "Ativar" para começar a vender.</p>
              <button onClick={onClose} className="mt-4 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700">
                Ver meus planos
              </button>
            </div>
          )}

          {!loading && !error && !analysis?.insufficient_data && createdCount === 0 && m && (
            <>
              {/* Métricas detectadas */}
              <div className="mb-5">
                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">📊 Diagnóstico do seu negócio</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricCard icon={Users} label="Clientes ativos" value={m.total_customers} />
                  <MetricCard icon={Activity} label="Frequência média" value={`${m.frequencia_media_mes}x/mês`} />
                  <MetricCard icon={TrendingUp} label="Ticket médio" value={`R$${m.ticket_medio.toFixed(0)}`} />
                  <MetricCard icon={Activity} label="Ocupação atual" value={`${m.occupancy_pct}%`}
                    color={m.occupancy_pct > 85 ? 'text-emerald-600' : m.occupancy_pct < 60 ? 'text-amber-600' : 'text-blue-600'} />
                </div>
                <div className="mt-3 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-900">
                  <strong>Estratégia:</strong> {analysis.discount_strategy.label}
                </div>
              </div>

              {/* Sugestões */}
              <div className="mb-5">
                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">💡 Planos sugeridos</h4>
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
                <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-violet-700" />
                    <span className="text-xs font-bold uppercase tracking-wide text-violet-900">Projeção conservadora</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-violet-700">MRR adicional projetado</div>
                      <div className="text-2xl font-black text-violet-900">R${analysis.projections.projected_mrr.toLocaleString('pt-BR')}</div>
                    </div>
                    <div>
                      <div className="text-xs text-violet-700">ARR adicional projetado</div>
                      <div className="text-2xl font-black text-violet-900">R${analysis.projections.projected_arr.toLocaleString('pt-BR')}</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-violet-700 mt-2">
                    Estimativa baseada em conversão de {Math.round(analysis.projections.conversion_rate_assumed * 100)}% dos clientes elegíveis para cada plano.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && !analysis?.insufficient_data && createdCount === 0 && (
          <div className="flex items-center justify-between gap-3 p-5 border-t border-black/5 bg-gray-50">
            <div className="text-xs text-gray-500">
              {selectedCount > 0 ? `${selectedCount} ${selectedCount === 1 ? 'plano selecionado' : 'planos selecionados'}` : 'Selecione ao menos 1 plano'}
              · será criado como rascunho (inativo)
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 border border-black/10 rounded-lg text-sm font-medium hover:bg-white">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={selectedCount === 0 || creating}
                className="px-5 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                {creating ? 'Criando...' : `Criar ${selectedCount > 0 ? selectedCount : ''} ${selectedCount === 1 ? 'rascunho' : 'rascunhos'}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color = 'text-[#111827]' }) {
  return (
    <div className="bg-white border border-black/5 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
        <Icon className="w-3 h-3" />{label}
      </div>
      <div className={`text-lg font-black ${color}`}>{value}</div>
    </div>
  );
}

function SuggestionCard({ suggestion: s, checked, onToggle }) {
  return (
    <label className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-all ${checked ? 'border-[#2563EB] bg-blue-50/50 shadow-sm' : 'border-black/10 bg-white hover:border-gray-300'}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1 w-4 h-4 rounded text-[#2563EB] focus:ring-[#2563EB]" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <div className="font-bold text-[#111827] flex items-center gap-2 flex-wrap">
              {s.name}
              {s.recommended && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">⭐ Recomendado</span>}
              {s.off_peak && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Off-Peak</span>}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{s.description}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xl font-black text-[#2563EB]">R${s.price_monthly}</div>
            <div className="text-[10px] text-gray-400 uppercase">por mês</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
          <div className="bg-gray-50 rounded px-2 py-1">
            <div className="text-gray-400">Avulso seria</div>
            <div className="font-bold text-gray-700 line-through">R${s.avulso_equivalent}</div>
          </div>
          <div className="bg-emerald-50 rounded px-2 py-1">
            <div className="text-emerald-600">Cliente economiza</div>
            <div className="font-bold text-emerald-700">R${s.savings}/mês</div>
          </div>
          <div className="bg-blue-50 rounded px-2 py-1">
            <div className="text-blue-600">Margem estimada</div>
            <div className="font-bold text-blue-700">{s.margin_pct}%</div>
          </div>
        </div>
        <div className="text-[11px] text-gray-500 mt-2">
          🎯 {s.target_segment} · <strong>{s.target_count}</strong> {s.target_count === 1 ? 'cliente' : 'clientes'} no perfil
        </div>
      </div>
    </label>
  );
}