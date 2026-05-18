// Timeline visual da auditoria do Caixa.
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Trash2, Lock, Unlock, ArrowUpFromLine, ArrowDownToLine, ShieldOff } from 'lucide-react';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

const ACTION_META = {
  OPEN_CASH_REGISTER:     { label: 'Abriu o caixa',         icon: Unlock,           color: 'text-[#93C5FD]',   bg: 'bg-blue-400/[0.12] ring-blue-400/30' },
  CLOSE_CASH_REGISTER:    { label: 'Fechou o caixa',        icon: Lock,             color: 'text-emerald-300', bg: 'bg-emerald-400/[0.12] ring-emerald-400/30' },
  EDIT_FINANCIAL_ENTRY:   { label: 'Editou lançamento',     icon: Pencil,           color: 'text-amber-300',   bg: 'bg-amber-400/[0.12] ring-amber-400/30' },
  DELETE_FINANCIAL_ENTRY: { label: 'Excluiu lançamento',    icon: Trash2,           color: 'text-rose-300',    bg: 'bg-rose-400/[0.12] ring-rose-400/30' },
  SANGRIA:                { label: 'Registrou sangria',     icon: ArrowUpFromLine,  color: 'text-orange-300',  bg: 'bg-orange-400/[0.12] ring-orange-400/30' },
  SUPRIMENTO:             { label: 'Registrou suprimento',  icon: ArrowDownToLine,  color: 'text-[#93C5FD]',   bg: 'bg-blue-400/[0.12] ring-blue-400/30' },
  BLOCKED_ATTEMPT:        { label: 'Tentativa bloqueada',   icon: ShieldOff,        color: 'text-rose-300',    bg: 'bg-rose-400/[0.12] ring-rose-400/30' },
};

function renderPayload(ev) {
  if (ev.action === 'CLOSE_CASH_REGISTER' && ev.after) {
    const diff = ev.after.difference;
    return (
      <span className="text-xs text-white/55">
        Conferido {fmt(ev.after.final_amount)} · Esperado {fmt(ev.after.expected_amount)}
        {diff != null && diff !== 0 && (
          <span className={`ml-1 font-bold ${diff > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            ({diff > 0 ? '+' : ''}{fmt(diff)})
          </span>
        )}
      </span>
    );
  }
  if (ev.action === 'OPEN_CASH_REGISTER') {
    return <span className="text-xs text-white/55">Saldo inicial {fmt(ev.after?.initial_amount)}</span>;
  }
  if (ev.action === 'SANGRIA' || ev.action === 'SUPRIMENTO') {
    return (
      <span className="text-xs text-white/55">
        {fmt(ev.after?.amount)}
        {ev.after?.justification && <span className="italic"> · "{ev.after.justification}"</span>}
      </span>
    );
  }
  if (ev.action === 'EDIT_FINANCIAL_ENTRY') {
    const changes = Object.keys(ev.after || {}).filter(k => k !== 'edited_at' && k !== 'edited_by');
    return (
      <span className="text-xs text-white/55">
        Alterou: {changes.join(', ') || '—'}
        {ev.before?.amount != null && ev.after?.amount != null && (
          <> · {fmt(ev.before.amount)} → {fmt(ev.after.amount)}</>
        )}
      </span>
    );
  }
  if (ev.action === 'DELETE_FINANCIAL_ENTRY') {
    return (
      <span className="text-xs text-white/55">
        {ev.before?.description || '—'} · {fmt(ev.before?.amount)}
        {ev.after?.deletion_reason && <span className="italic"> · "{ev.after.deletion_reason}"</span>}
      </span>
    );
  }
  if (ev.action === 'BLOCKED_ATTEMPT') {
    return <span className="text-xs text-rose-300">Acesso negado: {ev.metadata?.reason || '—'}</span>;
  }
  return null;
}

export default function AuditTimeline({ events, unitsMap = {} }) {
  if (!events?.length) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-10 text-center text-sm text-white/55">
        Nenhum evento de auditoria encontrado.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden">
      <div className="px-5 py-3 border-b border-white/8 text-[11px] font-semibold uppercase tracking-wider text-white/55 bg-white/[0.02] flex items-center justify-between">
        <span>Timeline</span>
        <span className="text-[10px] font-medium normal-case tracking-normal">{events.length} eventos</span>
      </div>
      <div className="divide-y divide-white/5 max-h-[640px] overflow-y-auto">
        {events.map(ev => {
          const meta = ACTION_META[ev.action] || { label: ev.action, icon: Pencil, color: 'text-white/55', bg: 'bg-white/[0.04] ring-white/10' };
          const Icon = meta.icon;
          return (
            <div key={ev.id} className="flex items-start gap-3 p-4 hover:bg-white/[0.04] transition-colors">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ${meta.bg}`}>
                <Icon className={`w-4 h-4 ${meta.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-white">{meta.label}</span>
                  <span className="text-xs text-white/55">por <b className="text-white/85">{ev.actor_email}</b></span>
                  {ev.unit_id && unitsMap[ev.unit_id] && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-400/[0.12] text-violet-200 border border-violet-400/30">
                      {unitsMap[ev.unit_id]}
                    </span>
                  )}
                </div>
                <div className="mt-0.5">{renderPayload(ev)}</div>
              </div>
              <div className="text-[11px] text-white/45 whitespace-nowrap flex-shrink-0">
                {format(new Date(ev.timestamp), "d MMM, HH:mm", { locale: ptBR })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}