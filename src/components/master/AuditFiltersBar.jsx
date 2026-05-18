// Barra de filtros do audit dashboard
import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';

const SEVERITIES = [
  { value: '', label: 'Todas' },
  { value: 'critical', label: 'Crítico' },
  { value: 'warning', label: 'Aviso' },
  { value: 'info', label: 'Info' },
];

const ACTOR_TYPES = [
  { value: '', label: 'Todos' },
  { value: 'user', label: 'Usuário' },
  { value: 'impersonation', label: 'Impersonação' },
  { value: 'system', label: 'Sistema' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'automation', label: 'Automação' },
];

const QUICK_ACTIONS = [
  'START_IMPERSONATION', 'END_IMPERSONATION',
  'CROSS_TENANT_ATTEMPT', 'PERMISSION_DENIED',
  'CASH_OPENED', 'CASH_CLOSED',
  'WHATSAPP_FAILED', 'STRIPE_ENV_MISMATCH',
];

export default function AuditFiltersBar({ onFilter }) {
  const [expanded, setExpanded] = useState(false);
  const [f, setF] = useState({
    company_id: '',
    severity: '',
    actor_type: '',
    action: '',
    actor_email: '',
    date_from: '',
    date_to: '',
    correlation_id: '',
  });

  const apply = (updates) => {
    const next = { ...f, ...updates };
    setF(next);
    // Remove campos vazios
    const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== ''));
    onFilter(clean);
  };

  const reset = () => {
    setF({ company_id: '', severity: '', actor_type: '', action: '', actor_email: '', date_from: '', date_to: '', correlation_id: '' });
    onFilter({});
  };

  const hasFilters = Object.values(f).some(v => v !== '');

  return (
    <div className="bg-card rounded-2xl border border-border p-4 shadow-[var(--shadow-sm)] space-y-3">
      {/* Linha principal */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por e-mail, action..."
            value={f.actor_email}
            onChange={e => apply({ actor_email: e.target.value })}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-[#2563EB]"
          />
        </div>
        <select
          value={f.severity}
          onChange={e => apply({ severity: e.target.value })}
          className="px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none"
        >
          {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          value={f.actor_type}
          onChange={e => apply({ actor_type: e.target.value })}
          className="px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none"
        >
          {ACTOR_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors"
        >
          <Filter className="w-4 h-4" /> Mais filtros
        </button>
        {hasFilters && (
          <button onClick={reset} className="flex items-center gap-1 px-2 py-2 rounded-xl text-sm text-red-500 hover:bg-red-500/10 transition-colors">
            <X className="w-4 h-4" /> Limpar
          </button>
        )}
      </div>

      {/* Filtros expandidos */}
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Empresa ID</label>
            <input
              type="text"
              placeholder="company_id"
              value={f.company_id}
              onChange={e => apply({ company_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Action</label>
            <input
              type="text"
              placeholder="APPOINTMENT_COMPLETED"
              value={f.action}
              onChange={e => apply({ action: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">De</label>
            <input
              type="date"
              value={f.date_from}
              onChange={e => apply({ date_from: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Até</label>
            <input
              type="date"
              value={f.date_to}
              onChange={e => apply({ date_to: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Correlation ID</label>
            <input
              type="text"
              placeholder="uuid..."
              value={f.correlation_id}
              onChange={e => apply({ correlation_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-[#2563EB] font-mono"
            />
          </div>
        </div>
      )}

      {/* Quick filters */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {QUICK_ACTIONS.map(a => (
          <button
            key={a}
            onClick={() => apply({ action: f.action === a ? '' : a })}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors border ${
              f.action === a
                ? 'bg-[#2563EB] text-white border-[#2563EB]'
                : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {a.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
    </div>
  );
}