// Timeline visual da auditoria do Caixa.
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Trash2, Lock, Unlock, ArrowUpFromLine, ArrowDownToLine, ShieldOff } from 'lucide-react';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

const ACTION_META = {
  OPEN_CASH_REGISTER:     { label: 'Abriu o caixa',         icon: Unlock,           color: 'text-[#2563EB]', bg: 'bg-blue-50 ring-blue-100' },
  CLOSE_CASH_REGISTER:    { label: 'Fechou o caixa',        icon: Lock,             color: 'text-emerald-600', bg: 'bg-emerald-50 ring-emerald-100' },
  EDIT_FINANCIAL_ENTRY:   { label: 'Editou lançamento',     icon: Pencil,           color: 'text-amber-600',  bg: 'bg-amber-50 ring-amber-100' },
  DELETE_FINANCIAL_ENTRY: { label: 'Excluiu lançamento',    icon: Trash2,           color: 'text-red-500',    bg: 'bg-red-50 ring-red-100' },
  SANGRIA:                { label: 'Registrou sangria',     icon: ArrowUpFromLine,  color: 'text-orange-600', bg: 'bg-orange-50 ring-orange-100' },
  SUPRIMENTO:             { label: 'Registrou suprimento',  icon: ArrowDownToLine,  color: 'text-[#2563EB]',  bg: 'bg-blue-50 ring-blue-100' },
  BLOCKED_ATTEMPT:        { label: 'Tentativa bloqueada',   icon: ShieldOff,        color: 'text-red-500',    bg: 'bg-red-50 ring-red-100' },
};

function renderPayload(ev) {
  if (ev.action === 'CLOSE_CASH_REGISTER' && ev.after) {
    const diff = ev.after.difference;
    return (
      <span className="text-xs text-[#6B7280]">
        Conferido {fmt(ev.after.final_amount)} · Esperado {fmt(ev.after.expected_amount)}
        {diff != null && diff !== 0 && (
          <span className={`ml-1 font-bold ${diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            ({diff > 0 ? '+' : ''}{fmt(diff)})
          </span>
        )}
      </span>
    );
  }
  if (ev.action === 'OPEN_CASH_REGISTER') {
    return <span className="text-xs text-[#6B7280]">Saldo inicial {fmt(ev.after?.initial_amount)}</span>;
  }
  if (ev.action === 'SANGRIA' || ev.action === 'SUPRIMENTO') {
    return (
      <span className="text-xs text-[#6B7280]">
        {fmt(ev.after?.amount)}
        {ev.after?.justification && <span className="italic"> · "{ev.after.justification}"</span>}
      </span>
    );
  }
  if (ev.action === 'EDIT_FINANCIAL_ENTRY') {
    const changes = Object.keys(ev.after || {}).filter(k => k !== 'edited_at' && k !== 'edited_by');
    return (
      <span className="text-xs text-[#6B7280]">
        Alterou: {changes.join(', ') || '—'}
        {ev.before?.amount != null && ev.after?.amount != null && (
          <> · {fmt(ev.before.amount)} → {fmt(ev.after.amount)}</>
        )}
      </span>
    );
  }
  if (ev.action === 'DELETE_FINANCIAL_ENTRY') {
    return (
      <span className="text-xs text-[#6B7280]">
        {ev.before?.description || '—'} · {fmt(ev.before?.amount)}
        {ev.after?.deletion_reason && <span className="italic"> · "{ev.after.deletion_reason}"</span>}
      </span>
    );
  }
  if (ev.action === 'BLOCKED_ATTEMPT') {
    return <span className="text-xs text-red-500">Acesso negado: {ev.metadata?.reason || '—'}</span>;
  }
  return null;
}

export default function AuditTimeline({ events, unitsMap = {} }) {
  if (!events?.length) {
    return (
      <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-sm text-[#6B7280] shadow-[var(--shadow-sm)]">
        Nenhum evento de auditoria encontrado.
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="px-5 py-3 border-b border-black/5 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] bg-[#FAFBFC] flex items-center justify-between">
        <span>Timeline</span>
        <span className="text-[10px] font-medium normal-case tracking-normal">{events.length} eventos</span>
      </div>
      <div className="divide-y divide-black/5 max-h-[640px] overflow-y-auto">
        {events.map(ev => {
          const meta = ACTION_META[ev.action] || { label: ev.action, icon: Pencil, color: 'text-[#6B7280]', bg: 'bg-gray-50 ring-gray-100' };
          const Icon = meta.icon;
          return (
            <div key={ev.id} className="flex items-start gap-3 p-4 hover:bg-[#FAFBFC] transition-colors">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ${meta.bg}`}>
                <Icon className={`w-4 h-4 ${meta.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-[#111827]">{meta.label}</span>
                  <span className="text-xs text-[#6B7280]">por <b className="text-[#111827]">{ev.actor_email}</b></span>
                  {ev.unit_id && unitsMap[ev.unit_id] && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                      {unitsMap[ev.unit_id]}
                    </span>
                  )}
                </div>
                <div className="mt-0.5">{renderPayload(ev)}</div>
              </div>
              <div className="text-[11px] text-[#6B7280] whitespace-nowrap flex-shrink-0">
                {format(new Date(ev.timestamp), "d MMM, HH:mm", { locale: ptBR })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}