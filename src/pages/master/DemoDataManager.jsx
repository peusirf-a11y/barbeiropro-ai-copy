// DemoDataManager — Central de dados de demonstração para o painel Master.
// Permite popular/limpar dados fake em qualquer tenant, por cenário ou módulo.
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Database, Trash2, Play, RefreshCw, Users, Calendar, DollarSign,
  Scissors, Star, Award, ChevronDown, ChevronRight, AlertTriangle,
  CheckCircle2, Loader2, Zap, BarChart3, Clock, Building2
} from 'lucide-react';
import { safeArray } from '@/lib/safeArray';

const SCENARIOS = [
  {
    id: 'pequena',
    label: 'Barbearia Pequena',
    description: '2 barbeiros · 40 clientes · 60 agendamentos',
    icon: '✂️',
    color: 'from-emerald-500 to-teal-600',
    badge: 'Starter',
  },
  {
    id: 'media',
    label: 'Barbearia Média',
    description: '5 barbeiros · 300 clientes · 800 agendamentos · assinaturas',
    icon: '💈',
    color: 'from-blue-500 to-indigo-600',
    badge: 'Popular',
  },
  {
    id: 'premium',
    label: 'Barbearia Premium',
    description: '8 barbeiros · 500 clientes · histórico completo',
    icon: '👑',
    color: 'from-violet-500 to-purple-600',
    badge: 'Premium',
  },
  {
    id: 'lotada',
    label: 'Agenda Cheia',
    description: '4 barbeiros · agenda intensa · cancelamentos · reagendamentos',
    icon: '🔥',
    color: 'from-orange-500 to-red-600',
    badge: 'Stress Test',
  },
  {
    id: 'financeiro',
    label: 'Financeiro Pesado',
    description: '3 barbeiros · 800+ lançamentos · DRE completo',
    icon: '💰',
    color: 'from-amber-500 to-yellow-600',
    badge: 'Finance',
  },
];

const MODULES = [
  { id: 'customers', label: 'Clientes', icon: Users, color: 'text-blue-500 bg-blue-500/15', key: 'customer' },
  { id: 'appointments', label: 'Agendamentos', icon: Calendar, color: 'text-emerald-500 bg-emerald-500/15', key: 'appointment' },
  { id: 'financial', label: 'Financeiro', icon: DollarSign, color: 'text-amber-500 bg-amber-500/15', key: 'financialentry' },
  { id: 'professionals', label: 'Profissionais', icon: Scissors, color: 'text-violet-500 bg-violet-500/15', key: 'professional' },
  { id: 'services', label: 'Serviços', icon: Zap, color: 'text-pink-500 bg-pink-500/15', key: 'service' },
  { id: 'commissions', label: 'Comissões', icon: Award, color: 'text-indigo-500 bg-indigo-500/15', key: 'commission' },
  { id: 'reviews', label: 'Avaliações', icon: Star, color: 'text-orange-500 bg-orange-500/15', key: 'review' },
];

const SEED_PRESETS = ['barbearia-premium-01','barbearia-demo-BR','corte-teste-2025','showcase-master'];

function LogLine({ type, text }) {
  const colors = { info: 'text-muted-foreground', success: 'text-emerald-500', error: 'text-red-500', warn: 'text-amber-500' };
  const icons = { info: '·', success: '✓', error: '✗', warn: '!' };
  return (
    <div className={`flex items-start gap-2 text-xs font-mono ${colors[type] || 'text-muted-foreground'}`}>
      <span className="flex-shrink-0 w-4 text-center">{icons[type] || '·'}</span>
      <span>{text}</span>
    </div>
  );
}

function ProgressBar({ value, label }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function CountBadge({ count }) {
  if (count == null) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={`text-sm font-bold ${count > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
      {count.toLocaleString('pt-BR')}
    </span>
  );
}

export default function DemoDataManager() {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedScenario, setSelectedScenario] = useState('media');
  const [seed, setSeed] = useState('barbearia-demo-BR');
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [counts, setCounts] = useState({});
  const [lastRun, setLastRun] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearCounts, setClearCounts] = useState(null);
  const logsEndRef = useRef(null);

  const { data: companiesRaw } = useQuery({
    queryKey: ['master-companies-demo'],
    queryFn: () => base44.entities.Company.list('-created_date', 200),
  });
  const companies = safeArray(companiesRaw);

  const { data: unitsRaw } = useQuery({
    queryKey: ['master-units-demo', selectedCompany],
    queryFn: () => selectedCompany
      ? base44.entities.Unit.filter({ company_id: selectedCompany }, 'sort_order', 50)
      : Promise.resolve([]),
    enabled: !!selectedCompany,
  });
  const units = safeArray(unitsRaw);

  // Scroll logs para baixo
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  function addLog(type, text) {
    setLogs(prev => [...prev, { type, text, time: new Date().toLocaleTimeString('pt-BR') }]);
  }

  async function loadCounts() {
    if (!selectedCompany) return;
    try {
      const res = await base44.functions.invoke('generateDemoData', {
        action: 'count',
        company_id: selectedCompany,
      });
      setCounts(res.data?.counts || {});
    } catch (err) {
      addLog('warn', `Erro ao carregar contagens: ${err.message}`);
    }
  }

  useEffect(() => {
    setCounts({});
    setLogs([]);
    if (selectedCompany) loadCounts();
  }, [selectedCompany]);

  async function handleGenerate(modules = 'all') {
    if (!selectedCompany) { addLog('error', 'Selecione uma barbearia primeiro.'); return; }
    setRunning(true);
    setLogs([]);
    setProgress(5);
    setProgressLabel('Iniciando...');
    const t0 = Date.now();
    try {
      addLog('info', `Iniciando geração: cenário "${selectedScenario}" · seed "${seed}"`);
      addLog('info', `Empresa: ${companies.find(c => c.id === selectedCompany)?.name}`);
      setProgress(15); setProgressLabel('Gerando serviços e profissionais...');
      addLog('info', 'Criando serviços e profissionais...');
      await new Promise(r => setTimeout(r, 300));

      setProgress(35); setProgressLabel('Gerando clientes...');
      addLog('info', 'Criando base de clientes...');
      await new Promise(r => setTimeout(r, 200));

      setProgress(55); setProgressLabel('Gerando agendamentos...');
      addLog('info', 'Preenchendo agenda com agendamentos realistas...');
      await new Promise(r => setTimeout(r, 200));

      setProgress(70); setProgressLabel('Gerando financeiro e comissões...');
      addLog('info', 'Lançando entradas/saídas financeiras...');
      await new Promise(r => setTimeout(r, 200));

      setProgress(85); setProgressLabel('Finalizando avaliações e audit...');

      const res = await base44.functions.invoke('generateDemoData', {
        action: 'generate',
        company_id: selectedCompany,
        unit_id: selectedUnit || undefined,
        scenario: selectedScenario,
        modules,
        seed,
      });

      const data = res.data;
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');

      setProgress(100); setProgressLabel('Concluído!');
      const r = data.results || {};
      addLog('success', `Concluído em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      if (r.customers) addLog('success', `${r.customers} clientes criados`);
      if (r.professionals) addLog('success', `${r.professionals} profissionais criados`);
      if (r.services) addLog('success', `${r.services} serviços criados`);
      if (r.appointments) addLog('success', `${r.appointments} agendamentos criados`);
      if (r.financial) addLog('success', `${r.financial} lançamentos financeiros criados`);
      if (r.commissions) addLog('success', `${r.commissions} comissões criadas`);
      if (r.reviews) addLog('success', `${r.reviews} avaliações criadas`);
      setLastRun({ ts: new Date(), scenario: selectedScenario, results: r });
      await loadCounts();
    } catch (err) {
      addLog('error', `Erro: ${err.message}`);
      setProgress(0); setProgressLabel('');
    } finally {
      setRunning(false);
      setTimeout(() => { setProgress(0); setProgressLabel(''); }, 3000);
    }
  }

  async function confirmClear() {
    if (!selectedCompany) return;
    // Primeiro, mostra quantos serão removidos
    try {
      const res = await base44.functions.invoke('generateDemoData', {
        action: 'count',
        company_id: selectedCompany,
      });
      setClearCounts(res.data?.counts || {});
      setShowClearConfirm(true);
    } catch (err) {
      addLog('error', `Erro: ${err.message}`);
    }
  }

  async function handleClear() {
    setShowClearConfirm(false);
    setRunning(true);
    setLogs([]);
    setProgress(20); setProgressLabel('Removendo dados demo...');
    try {
      addLog('warn', 'Iniciando limpeza de dados demo...');
      const res = await base44.functions.invoke('generateDemoData', {
        action: 'clear',
        company_id: selectedCompany,
      });
      const data = res.data;
      if (!data?.success) throw new Error(data?.error || 'Erro ao limpar');
      setProgress(100); setProgressLabel('Limpeza concluída!');
      const c = data.cleared || {};
      addLog('success', 'Dados demo removidos com sucesso.');
      Object.entries(c).forEach(([k, v]) => { if (v > 0) addLog('info', `${v} registros removidos de ${k}`); });
      await loadCounts();
    } catch (err) {
      addLog('error', `Erro: ${err.message}`);
    } finally {
      setRunning(false);
      setTimeout(() => { setProgress(0); setProgressLabel(''); }, 3000);
    }
  }

  const selectedScenarioData = SCENARIOS.find(s => s.id === selectedScenario);
  const hasDemoData = Object.values(counts).some(v => v > 0);
  const totalDemoRecords = Object.values(counts).reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center">
              <Database className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">Gerenciador de Dados Demo</h1>
          </div>
          <p className="text-sm text-muted-foreground">Popule qualquer tenant com dados realistas em segundos. Apenas dados com <code className="bg-muted px-1 rounded text-xs">is_demo_data: true</code> são afetados.</p>
        </div>
        {lastRun && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border px-3 py-2 rounded-xl">
            <Clock className="w-3.5 h-3.5" />
            Última geração: {lastRun.ts.toLocaleTimeString('pt-BR')}
          </div>
        )}
      </div>

      {/* Seleção de empresa */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#2563EB]" /> Selecionar Tenant
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Barbearia *</label>
            <select
              value={selectedCompany}
              onChange={e => { setSelectedCompany(e.target.value); setSelectedUnit(''); }}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
            >
              <option value="">Selecione uma barbearia...</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.status}</option>
              ))}
            </select>
          </div>
          {units.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Unidade (opcional)</label>
              <select
                value={selectedUnit}
                onChange={e => setSelectedUnit(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              >
                <option value="">Todas as unidades</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Status de dados demo */}
        {selectedCompany && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground">Dados demo existentes</span>
              <button onClick={loadCounts} className="text-xs text-[#2563EB] hover:underline flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Atualizar
              </button>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {MODULES.map(mod => {
                const Ic = mod.icon;
                const count = counts[mod.key] ?? counts[mod.id] ?? 0;
                return (
                  <div key={mod.id} className={`rounded-xl p-2 text-center ${count > 0 ? mod.color : 'text-muted-foreground bg-muted'}`}>
                    <Ic className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-xs font-bold">{count}</div>
                    <div className="text-[10px] leading-tight opacity-70">{mod.label}</div>
                  </div>
                );
              })}
            </div>
            {hasDemoData && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {totalDemoRecords.toLocaleString('pt-BR')} registros demo encontrados neste tenant.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cenários */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#2563EB]" /> Cenário de Demonstração
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {SCENARIOS.map(sc => (
            <button
              key={sc.id}
              onClick={() => setSelectedScenario(sc.id)}
              className={`relative p-4 rounded-2xl border-2 text-left transition-all ${
                selectedScenario === sc.id
                  ? 'border-[#2563EB] bg-[#2563EB]/10 shadow-[0_0_0_3px_rgba(37,99,235,0.12)]'
                  : 'border-border bg-muted/40 hover:border-[#2563EB]/30'
              }`}
            >
              {selectedScenario === sc.id && (
                <CheckCircle2 className="absolute top-3 right-3 w-4 h-4 text-[#2563EB]" />
              )}
              <div className="text-2xl mb-2">{sc.icon}</div>
              <div className="text-sm font-bold text-foreground leading-tight">{sc.label}</div>
              <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{sc.description}</div>
              <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${sc.color} text-white`}>
                {sc.badge}
              </span>
            </button>
          ))}
        </div>

        {/* Seed */}
        <div className="mt-4 pt-4 border-t border-border">
          <label className="text-xs font-semibold text-muted-foreground block mb-2">Seed determinística (demos reproduzíveis)</label>
          <div className="flex gap-2 flex-wrap">
            {SEED_PRESETS.map(s => (
              <button
                key={s}
                onClick={() => setSeed(s)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  seed === s ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-muted/40 border-border text-muted-foreground hover:border-[#2563EB]/40'
                }`}
              >
                {s}
              </button>
            ))}
            <input
              value={seed}
              onChange={e => setSeed(e.target.value)}
              placeholder="seed customizada"
              className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 w-40"
            />
          </div>
        </div>
      </div>

      {/* Ações principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Gerar tudo */}
        <div className="bg-gradient-to-br from-[#1e3a8a] to-[#1d4ed8] rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold">Gerar Tudo</div>
              <div className="text-xs text-blue-200">Cenário completo — {selectedScenarioData?.label}</div>
            </div>
          </div>
          <p className="text-xs text-blue-200 mb-4">{selectedScenarioData?.description}</p>
          <button
            onClick={() => handleGenerate('all')}
            disabled={running || !selectedCompany}
            className="w-full bg-white text-[#1d4ed8] font-bold text-sm py-3 rounded-xl hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? 'Gerando...' : 'Gerar Cenário Completo'}
          </button>
        </div>

        {/* Limpar */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-500/15 rounded-xl flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <div className="font-bold text-foreground">Limpar Dados Demo</div>
              <div className="text-xs text-muted-foreground">Remove apenas registros com is_demo_data: true</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Dados reais <strong>nunca são afetados</strong>. Apenas registros marcados como demo são removidos.
          </p>
          <button
            onClick={confirmClear}
            disabled={running || !selectedCompany || !hasDemoData}
            className="w-full bg-red-500 text-white font-bold text-sm py-3 rounded-xl hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Limpar Dados Demo
          </button>
        </div>
      </div>

      {/* Geração por módulo */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-[#2563EB]" /> Gerar por Módulo
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {MODULES.map(mod => {
            const Ic = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => handleGenerate(mod.id)}
                disabled={running || !selectedCompany}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border border-border ${mod.color} hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
              >
                <Ic className="w-5 h-5" />
                <span className="text-xs font-semibold">{mod.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress + Logs */}
      {(running || logs.length > 0) && (
        <div className="bg-card border border-border rounded-2xl p-5 text-foreground">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold flex items-center gap-2">
              {running
                ? <><Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Executando...</>
                : <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Concluído</>
              }
            </h2>
            <button onClick={() => setLogs([])} className="text-[11px] text-muted-foreground hover:text-foreground">limpar</button>
          </div>

          {progress > 0 && (
            <div className="mb-4">
              <ProgressBar value={progress} label={progressLabel} />
            </div>
          )}

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {logs.map((log, i) => (
              <LogLine key={i} type={log.type} text={`[${log.time}] ${log.text}`} />
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Confirmação de limpeza */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="font-black text-foreground">Confirmar limpeza</h3>
                <p className="text-xs text-muted-foreground">Esta ação remove permanentemente os dados demo.</p>
              </div>
            </div>

            {clearCounts && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
                <p className="text-xs font-semibold text-red-500 mb-2">Registros que serão removidos:</p>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(clearCounts).filter(([,v]) => v > 0).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs text-red-500">
                      <span className="capitalize">{k}</span>
                      <span className="font-bold">{v}</span>
                    </div>
                  ))}
                </div>
                {Object.values(clearCounts).every(v => v === 0) && (
                  <p className="text-xs text-muted-foreground">Nenhum dado demo encontrado.</p>
                )}
              </div>
            )}

            <p className="text-sm text-muted-foreground mb-4">
              <strong className="text-foreground">Dados reais não serão afetados.</strong> Apenas registros marcados com <code className="bg-muted px-1 rounded">is_demo_data: true</code> serão removidos.
            </p>

            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-2.5 px-4 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted">
                Cancelar
              </button>
              <button onClick={handleClear} className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700">
                Sim, limpar dados demo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}