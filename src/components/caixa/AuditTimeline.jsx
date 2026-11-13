// Timeline visual da auditoria do Caixa.
// Design System: Premium Business SaaS & Business Intelligence
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Trash2, Lock, Unlock, ArrowUpFromLine, ArrowDownToLine, ShieldOff } from 'lucide-react';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

const ACTION_META = {
  OPEN_CASH_REGISTER:     { label: 'Abriu o caixa',         icon: Unlock,           color: 'text-[#2563EB] dark:text-blue-300',   bg: 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40' },
  CLOSE_CASH_REGISTER:    { label: 'Fechou o caixa',        icon: Lock,             color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40' },
  EDIT_FINANCIAL_ENTRY:   { label: 'Editou lançamento',     icon: Pencil,           color: 'text-amber-600 dark:text-amber-300',   bg: 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40' },
  DELETE_FINANCIAL_ENTRY: { label: 'Excluiu lançamento',    icon: Trash2,           color: 'text-rose-600 dark:text-rose-300',    bg: 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40' },
  SANGRIA:                { label: 'Registrou sangria',     icon: ArrowUpFromLine,  color: 'text-amber-600 dark:text-amber-300',  bg: 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40' },
  SUPRIMENTO:             { label: 'Registrou suprimento',  icon: ArrowDownToLine,  color: 'text-[#2563EB] dark:text-blue-300',   bg: 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40' },
  BLOCKED_ATTEMPT:        { label: 'Tentativa bloqueada',   icon: ShieldOff,        color: 'text-rose-600 dark:text-rose-300',    bg: 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40' },
};

function renderPayload(ev) {
  if (ev.action === 'CLOSE_CASH_REGISTER' && ev.after) {
    const diff = ev.after.difference;
    return (
      <span className="text-xs text-[#55596A] dark:text-[#8F9BBF] font-medium">
        Conferido <strong className="tabular-nums font-bold text-[#171827] dark:text-white">{fmt(ev.after.final_amount)}</strong> · Esperado <strong className="tabular-nums font-bold text-[#171827] dark:text-white">{fmt(ev.after.expected_amount)}</strong>
        {diff != null && diff !== 0 && (
          <span className={`ml-1.5 font-bold tabular-nums ${diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            ({diff > 0 ? '+' : ''}{fmt(diff)})
          </span>
        )}
      </span>
    );
  }
  if (ev.action === 'OPEN_CASH_REGISTER') {
    return <span className="text-xs text-[#55596A] dark:text-[#8F9BBF] font-medium">Saldo inicial <strong className="tabular-nums font-bold text-[#171827] dark:text-white">{fmt(ev.after?.initial_amount)}</strong></span>;
  }
  if (ev.action === 'SANGRIA' || ev.action === 'SUPRIMENTO') {
    return (
      <span className="text-xs text-[#55596A] dark:text-[#8F9BBF] font-medium">
        <strong className="tabular-nums font-bold text-[#171827] dark:text-white">{fmt(ev.after?.amount)}</strong>
        {ev.after?.justification && <span className="italic"> · "{ev.after.justification}"</span>}
      </span>
    );
  }
  if (ev.action === 'EDIT_FINANCIAL_ENTRY') {
    const changes = Object.keys(ev.after || {}).filter(k => k !== 'edited_at' && k !== 'edited_by');
    return (
      <span className="text-xs text-[#55596A] dark:text-[#8F9BBF] font-medium">
        Campos alterados: {changes.join(', ') || '—'}
        {ev.before?.amount != null && ev.after?.amount != null && (
          <> · <span className="tabular-nums">{fmt(ev.before.amount)}</span> → <strong className="tabular-nums font-bold text-[#171827] dark:text-white">{fmt(ev.after.amount)}</strong></>
        )}
      </span>
    );
  }
  if (ev.action === 'DELETE_FINANCIAL_ENTRY') {
    return (
      <span className="text-xs text-[#55596A] dark:text-[#8F9BBF] font-medium">
        {ev.before?.description || '—'} · <strong className="tabular-nums font-bold text-[#171827] dark:text-white">{fmt(ev.before?.amount)}</strong>
        {ev.after?.deletion_reason && <span className="italic"> · "{ev.after.deletion_reason}"</span>}
      </span>
    );
  }
  if (ev.action === 'BLOCKED_ATTEMPT') {
    return <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">Acesso negado: {ev.metadata?.reason || '—'}</span>;
  }
  return null;
}

export default function AuditTimeline({ events, unitsMap = {} }) {
  if (!events?.length) {
    return (
      <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] shadow-sm p-12 text-center text-xs sm:text-sm text-[#55596A] dark:text-[#8F9BBF] font-medium">
        Nenhum evento de auditoria encontrado para o período selecionado.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E5E7EF] dark:border-[#232538] text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-[#8F9BBF] bg-[#F8FAFC] dark:bg-[#1C1E30] flex items-center justify-between">
        <span>Timeline de Ações</span>
        <span className="text-xs font-semibold normal-case tracking-normal text-[#55596A] dark:text-[#8F9BBF] tabular-nums">{events.length} eventos auditados</span>
      </div>
      <div className="divide-y divide-[#E5E7EF] dark:divide-[#232538] max-h-[640px] overflow-y-auto">
        {events.map(ev => {
          const meta = ACTION_META[ev.action] || { label: ev.action, icon: Pencil, color: 'text-[#55596A]', bg: 'bg-[#F1F2F7] border border-[#E5E7EF]' };
          const Icon = meta.icon;
          return (
            <div key={ev.id} className="flex items-start gap-3.5 p-4 hover:bg-[#F8FAFC] dark:hover:bg-[#1C1E30] transition-colors">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                <Icon className={`w-4 h-4 ${meta.color}`} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-[#171827] dark:text-white">{meta.label}</span>
                  <span className="text-xs text-[#55596A] dark:text-[#8F9BBF] font-medium">por <strong className="text-[#171827] dark:text-white font-semibold">{ev.actor_email}</strong></span>
                  {ev.unit_id && unitsMap[ev.unit_id] && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-[#DBEAFE] dark:border-blue-800/40">
                      {unitsMap[ev.unit_id]}
                    </span>
                  )}
                </div>
                <div className="mt-1">{renderPayload(ev)}</div>
              </div>
              <div className="text-xs text-[#55596A] dark:text-[#8F9BBF] font-semibold tabular-nums whitespace-nowrap flex-shrink-0">
                {format(new Date(ev.timestamp), "d MMM, HH:mm", { locale: ptBR })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}