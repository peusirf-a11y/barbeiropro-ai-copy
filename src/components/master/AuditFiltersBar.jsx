// Barra de filtros do Audit Dashboard — com Debounce de busca e sincronização bidirecional
import { useState, useEffect, useRef } from 'react';
import { Search, Filter, X } from 'lucide-react';

const SEVERITIES = [
  { value: '', label: 'Todas severidades' },
  { value: 'critical', label: 'Crítico' },
  { value: 'warning', label: 'Aviso' },
  { value: 'info', label: 'Info' },
];

const ACTOR_TYPES = [
  { value: '', label: 'Todos atores' },
  { value: 'user', label: 'Usuário' },
  { value: 'impersonation', label: 'Impersonação' },
  { value: 'system', label: 'Sistema' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'automation', label: 'Automação' },
];

const QUICK_ACTIONS = [
  'START_IMPERSONATION',
  'END_IMPERSONATION',
  'CROSS_TENANT_ATTEMPT',
  'PERMISSION_DENIED',
  'CASH_OPENED',
  'CASH_CLOSED',
  'WHATSAPP_FAILED',
  'ASAAS_ENV_MISMATCH',
];

const INITIAL_FILTERS = {
  search: '',
  company_id: '',
  severity: '',
  actor_type: '',
  action: '',
  date_from: '',
  date_to: '',
  correlation_id: '',
};

export default function AuditFiltersBar({ value = {}, onFilter }) {
  const [expanded, setExpanded] = useState(false);
  const [f, setF] = useState({ ...INITIAL_FILTERS, ...value });
  const [searchInput, setSearchInput] = useState(value.search || '');
  const debounceRef = useRef(null);

  // Sincroniza quando o pai limpa ou altera filtros externamente (ex: clique num KPI card ou botão de Empty State)
  useEffect(() => {
    const merged = { ...INITIAL_FILTERS, ...value };
    setF(merged);
    setSearchInput(merged.search || '');
  }, [value]);

  const emitFilters = (nextState) => {
    const clean = Object.fromEntries(
      Object.entries(nextState).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    onFilter(clean);
  };

  const applyImmediate = (updates) => {
    const next = { ...f, ...updates };
    setF(next);
    emitFilters(next);
  };

  // Debounce de 350ms para busca textual livre (e-mail, usuário, action, target_id, company_id)
  const handleSearchChange = (val) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const next = { ...f, search: val };
      setF(next);
      emitFilters(next);
    }, 350);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const reset = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchInput('');
    setF(INITIAL_FILTERS);
    onFilter({});
  };

  const hasFilters = Object.values(f).some((v) => v !== '') || searchInput !== '';

  return (
    <div className="bg-card rounded-2xl border border-border p-4 shadow-[var(--shadow-sm)] space-y-3">
      {/* Linha principal */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por e-mail, usuário, action ou ID..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-[#2563EB]"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={f.severity}
          onChange={(e) => applyImmediate({ severity: e.target.value })}
          className="px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none cursor-pointer"
        >
          {SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={f.actor_type}
          onChange={(e) => applyImmediate({ actor_type: e.target.value })}
          className="px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none cursor-pointer"
        >
          {ACTOR_TYPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
            expanded
              ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB]'
              : 'border-border bg-card text-foreground hover:bg-muted'
          }`}
        >
          <Filter className="w-4 h-4" /> Mais filtros
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" /> Limpar filtros
          </button>
        )}
      </div>

      {/* Filtros expandidos */}
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-border">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
              Empresa ID
            </label>
            <input
              type="text"
              placeholder="company_id"
              value={f.company_id}
              onChange={(e) => applyImmediate({ company_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
              Action (Evento)
            </label>
            <input
              type="text"
              placeholder="Ex: APPOINTMENT_COMPLETED"
              value={f.action}
              onChange={(e) => applyImmediate({ action: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-[#2563EB] font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
              Data Inicial (De)
            </label>
            <input
              type="date"
              value={f.date_from}
              onChange={(e) => applyImmediate({ date_from: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
              Data Final (Até)
            </label>
            <input
              type="date"
              value={f.date_to}
              onChange={(e) => applyImmediate({ date_to: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
              Correlation ID
            </label>
            <input
              type="text"
              placeholder="UUID de correlação..."
              value={f.correlation_id}
              onChange={(e) => applyImmediate({ correlation_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-[#2563EB] font-mono"
            />
          </div>
        </div>
      )}

      {/* Quick Action Chips */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {QUICK_ACTIONS.map((a) => {
          const isActive = f.action === a;
          return (
            <button
              key={a}
              type="button"
              onClick={() => applyImmediate({ action: isActive ? '' : a })}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border cursor-pointer ${
                isActive
                  ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm'
                  : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
              }`}
            >
              {a.replace(/_/g, ' ')}
            </button>
          );
        })}
      </div>
    </div>
  );
}