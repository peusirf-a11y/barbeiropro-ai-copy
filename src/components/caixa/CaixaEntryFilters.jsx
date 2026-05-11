// Filtros da timeline de movimentações: tipo, forma de pagamento, origem, profissional, busca.
import { Search, X } from 'lucide-react';
import { PAYMENT_METHODS, ORIGINS, ENTRY_KINDS } from '@/lib/cashRegister';

export default function CaixaEntryFilters({ filters, setFilters, professionals = [] }) {
  const clear = () => setFilters({});
  const hasAny = Object.values(filters).some(v => v && v !== '');

  return (
    <div className="space-y-2 px-4 sm:px-5 py-3 border-b border-black/5 bg-[#FAFBFC]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
        <input
          type="text"
          placeholder="Buscar por descrição, categoria ou motivo..."
          value={filters.search || ''}
          onChange={e => setFilters({ ...filters, search: e.target.value })}
          className="w-full pl-9 pr-3 py-2 text-sm border border-black/10 rounded-lg bg-white"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          value={filters.kind || ''}
          onChange={e => setFilters({ ...filters, kind: e.target.value || undefined })}
          className="text-xs border border-black/10 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="">Todos os tipos</option>
          {ENTRY_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <select
          value={filters.payment_method || ''}
          onChange={e => setFilters({ ...filters, payment_method: e.target.value || undefined })}
          className="text-xs border border-black/10 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="">Todas as formas</option>
          {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.icon} {m.label}</option>)}
        </select>
        <select
          value={filters.origin || ''}
          onChange={e => setFilters({ ...filters, origin: e.target.value || undefined })}
          className="text-xs border border-black/10 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="">Todas as origens</option>
          {ORIGINS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {professionals.length > 0 && (
          <select
            value={filters.professional_id || ''}
            onChange={e => setFilters({ ...filters, professional_id: e.target.value || undefined })}
            className="text-xs border border-black/10 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="">Todos os profissionais</option>
            {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {hasAny && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#111827] px-2 py-1.5"
          >
            <X className="w-3 h-3" />Limpar
          </button>
        )}
      </div>
    </div>
  );
}