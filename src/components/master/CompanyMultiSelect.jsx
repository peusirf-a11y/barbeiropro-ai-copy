// Seletor reutilizável de empresas para campos como "allowed_company_ids".
// Mostra nome+slug, mas armazena APENAS Company.id (o backend espera IDs).
//
// Props:
//   - value: string[]  → IDs selecionados
//   - onChange: (ids: string[]) => void
//   - variant: 'light' | 'dark'  (combina com PlanVisibilityControl)
//   - placeholder?: string

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, X, Building2, Check, Loader2 } from 'lucide-react';

export default function CompanyMultiSelect({
  value = [],
  onChange,
  variant = 'light',
  placeholder = 'Buscar empresa por nome ou slug…',
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  // Carrega todas as Companies uma vez. App tem dezenas/centenas de tenants,
  // não milhares — list() é OK aqui. Se um dia escalar, troca por busca server-side.
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['all-companies-for-select'],
    queryFn: () => base44.entities.Company.list('-created_date', 500),
    staleTime: 5 * 60_000,
  });

  const byId = useMemo(() => {
    const m = new Map();
    companies.forEach(c => m.set(c.id, c));
    return m;
  }, [companies]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies.slice(0, 30);
    return companies
      .filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.slug || '').toLowerCase().includes(q) ||
        (c.id || '').toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [companies, query]);

  const selected = (value || []).map(id => byId.get(id)).filter(Boolean);
  const unknownIds = (value || []).filter(id => !byId.get(id));

  const toggle = (id) => {
    const has = (value || []).includes(id);
    onChange?.(has ? value.filter(x => x !== id) : [...value, id]);
  };
  const removeId = (id) => onChange?.((value || []).filter(x => x !== id));

  const isDark = variant === 'dark';
  const styles = isDark
    ? {
        wrap: 'border-white/10 bg-white/[0.04]',
        input: 'bg-white/[0.04] border-white/10 text-white placeholder:text-white/40',
        chip: 'bg-blue-500/15 text-[#93C5FD] border-blue-400/30',
        list: 'bg-[#0A1124] border-white/10',
        item: 'hover:bg-white/[0.06] text-white',
        itemActive: 'bg-blue-500/15 text-[#93C5FD]',
        muted: 'text-white/45',
      }
    : {
        wrap: 'border-border bg-background',
        input: 'bg-background border-border text-foreground placeholder:text-muted-foreground',
        chip: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
        list: 'bg-card border-border',
        item: 'hover:bg-muted text-foreground',
        itemActive: 'bg-blue-500/15 text-blue-600',
        muted: 'text-muted-foreground',
      };

  return (
    <div className="space-y-2">
      {/* Chips de selecionados */}
      {(selected.length > 0 || unknownIds.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(c => (
            <span key={c.id} className={`inline-flex items-center gap-1.5 text-xs font-semibold pl-2.5 pr-1 py-1 rounded-full border ${styles.chip}`}>
              <Building2 className="w-3 h-3" />
              <span className="truncate max-w-[160px]">{c.name}</span>
              {c.slug && <span className={`text-[10px] font-normal ${styles.muted}`}>/{c.slug}</span>}
              <button type="button" onClick={() => removeId(c.id)} className="ml-0.5 p-0.5 hover:bg-white/10 rounded-full" aria-label="Remover">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {unknownIds.map(id => (
            <span key={id} className={`inline-flex items-center gap-1.5 text-[11px] font-mono pl-2.5 pr-1 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600`}>
              <span className="truncate max-w-[120px]">{id}</span>
              <button type="button" onClick={() => removeId(id)} className="p-0.5 hover:bg-white/10 rounded-full" aria-label="Remover">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Busca + dropdown */}
      <div className={`relative border rounded-xl ${styles.wrap}`}>
        <div className="flex items-center gap-2 px-3 py-2">
          <Search className={`w-4 h-4 ${styles.muted} flex-shrink-0`} />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder}
            className={`flex-1 bg-transparent text-sm outline-none border-0 ${styles.input.replace('border-', '').replace('bg-', '')}`}
          />
          {isLoading && <Loader2 className={`w-3.5 h-3.5 animate-spin ${styles.muted}`} />}
        </div>

        {open && (
          <div className={`absolute z-30 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-xl border shadow-lg ${styles.list}`}>
            {filtered.length === 0 ? (
              <div className={`px-3 py-4 text-sm text-center ${styles.muted}`}>
                {query ? 'Nenhuma empresa encontrada.' : 'Digite para buscar.'}
              </div>
            ) : (
              filtered.map(c => {
                const checked = (value || []).includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); toggle(c.id); }}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors ${checked ? styles.itemActive : styles.item}`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${checked ? 'bg-blue-500 border-blue-500' : 'border-current opacity-30'}`}>
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{c.name || '(sem nome)'}</div>
                      <div className={`text-[11px] ${styles.muted} truncate`}>
                        {c.slug ? `/${c.slug}` : c.id}
                        {c.owner_email && <span> · {c.owner_email}</span>}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}