// Filtros da timeline de movimentações: tipo, forma de pagamento, origem, profissional, busca.
// Design System: Premium Business SaaS & Business Intelligence
import { Search, X } from 'lucide-react';
import { PAYMENT_METHODS, ORIGINS, ENTRY_KINDS } from '@/lib/cashRegister';

export default function CaixaEntryFilters({ filters, setFilters, professionals = [] }) {
  const clear = () => setFilters({});
  const hasAny = Object.values(filters).some(v => v && v !== '');

  return (
    <div className="space-y-2.5 px-4 sm:px-5 py-3 border-b border-[#E5E7EF] dark:border-[#232538] bg-[#F8FAFC] dark:bg-[#1C1E30]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#59658F] dark:text-[#8F9BBF]" strokeWidth={1.75} />
        <input
          type="text"
          placeholder="Buscar por descrição, categoria ou motivo..."
          value={filters.search || ''}
          onChange={e => setFilters({ ...filters, search: e.target.value })}
          className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-[#171827] dark:text-white placeholder:text-[#55596A]/60 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/30 transition-all font-medium"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          value={filters.kind || ''}
          onChange={e => setFilters({ ...filters, kind: e.target.value || undefined })}
          className="text-xs bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl px-2.5 py-1.5 text-[#171827] dark:text-white font-medium focus:outline-none focus:border-[#2563EB] cursor-pointer"
        >
          <option value="">Todos os tipos</option>
          {ENTRY_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <select
          value={filters.payment_method || ''}
          onChange={e => setFilters({ ...filters, payment_method: e.target.value || undefined })}
          className="text-xs bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl px-2.5 py-1.5 text-[#171827] dark:text-white font-medium focus:outline-none focus:border-[#2563EB] cursor-pointer"
        >
          <option value="">Todas as formas</option>
          {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.icon} {m.label}</option>)}
        </select>
        <select
          value={filters.origin || ''}
          onChange={e => setFilters({ ...filters, origin: e.target.value || undefined })}
          className="text-xs bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl px-2.5 py-1.5 text-[#171827] dark:text-white font-medium focus:outline-none focus:border-[#2563EB] cursor-pointer"
        >
          <option value="">Todas as origens</option>
          {ORIGINS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {professionals.length > 0 && (
          <select
            value={filters.professional_id || ''}
            onChange={e => setFilters({ ...filters, professional_id: e.target.value || undefined })}
            className="text-xs bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl px-2.5 py-1.5 text-[#171827] dark:text-white font-medium focus:outline-none focus:border-[#2563EB] cursor-pointer"
          >
            <option value="">Todos os profissionais</option>
            {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {hasAny && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1.5 text-xs text-[#59658F] dark:text-[#8F9BBF] hover:text-[#171827] dark:hover:text-white px-2.5 py-1.5 rounded-xl border border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] transition-colors cursor-pointer font-semibold"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Limpar filtros</span>
          </button>
        )}
      </div>
    </div>
  );
}