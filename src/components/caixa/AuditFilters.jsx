// Filtros da página de Auditoria: período, ator (email), tipo de ação.
import HistoryFilters from '@/components/caixa/HistoryFilters';

const ACTIONS = [
  { value: '',                       label: 'Todas as ações' },
  { value: 'OPEN_CASH_REGISTER',     label: 'Abertura de caixa' },
  { value: 'CLOSE_CASH_REGISTER',    label: 'Fechamento de caixa' },
  { value: 'SANGRIA',                label: 'Sangria' },
  { value: 'SUPRIMENTO',             label: 'Suprimento' },
  { value: 'EDIT_FINANCIAL_ENTRY',   label: 'Edição' },
  { value: 'DELETE_FINANCIAL_ENTRY', label: 'Exclusão' },
  { value: 'BLOCKED_ATTEMPT',        label: 'Bloqueios' },
];

export default function AuditFilters({
  preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo,
  actor, setActor, action, setAction, teamEmails = [],
}) {
  return (
    <div className="space-y-3 mb-5">
      <HistoryFilters
        preset={preset} setPreset={setPreset}
        customFrom={customFrom} setCustomFrom={setCustomFrom}
        customTo={customTo} setCustomTo={setCustomTo}
      />
      <div className="bg-white rounded-2xl border border-black/5 p-4 sm:p-5 shadow-[var(--shadow-sm)] grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1.5">Ação</label>
          <select
            value={action}
            onChange={e => setAction(e.target.value)}
            className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm bg-white"
          >
            {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1.5">Usuário</label>
          <select
            value={actor}
            onChange={e => setActor(e.target.value)}
            className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm bg-white"
          >
            <option value="">Todos</option>
            {teamEmails.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}