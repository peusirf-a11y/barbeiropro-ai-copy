// Aba "Histórico" — todas as mensagens (transacionais + CRM) enviadas.
// Inclui filtro por tipo e indicador de status.

import { useState } from 'react';

const TYPE_LABELS = {
  confirmacao: 'Confirmação',
  lembrete_24h: 'Lembrete 24h',
  lembrete_2h: 'Lembrete 2h',
  pos_atendimento: 'Pós-atendimento',
  reativacao: 'Reativação (IA)',
  crm_primeira_visita: 'Boas-vindas',
  crm_em_risco: 'Em risco',
  crm_inativo: 'Inativo',
  crm_perdido: 'Perdido',
  crm_vip_inativo: 'VIP em risco',
  crm_fiel_sem_plano: 'Cliente fiel s/ plano',
};

const STATUS_BADGE = {
  enviado: 'bg-emerald-50 dark:bg-emerald-400/[0.12] text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-400/30',
  simulado: 'bg-blue-50 dark:bg-blue-400/[0.12] text-blue-700 dark:text-blue-200 border-blue-200 dark:border-blue-400/30',
  erro: 'bg-rose-50 dark:bg-rose-400/[0.12] text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-400/30',
};

export default function CRMHistoryTab({ messages }) {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all'
    ? messages
    : filter === 'crm'
      ? messages.filter((m) => m.type?.startsWith('crm_'))
      : filter === 'transactional'
        ? messages.filter((m) => !m.type?.startsWith('crm_'))
        : messages.filter((m) => m.type === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'Todas' },
          { id: 'crm', label: 'Campanhas CRM' },
          { id: 'transactional', label: 'Transacionais' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
              filter === f.id
                ? 'bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white border-transparent shadow-sm ring-1 ring-white/15'
                : 'bg-white dark:bg-white/[0.04] text-slate-600 dark:text-white/70 border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-400/40 hover:text-[#2563EB] dark:hover:text-[#93C5FD]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.025] backdrop-blur-md overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-white/55 text-[11px] uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-white/55 text-[11px] uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-white/55 text-[11px] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-white/55 text-[11px] uppercase tracking-wider hidden md:table-cell">Mensagem</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-white/55 text-[11px] uppercase tracking-wider">Quando</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400 dark:text-white/40">
                    Nenhuma mensagem enviada ainda
                  </td>
                </tr>
              )}
              {filtered.slice(0, 200).map((m) => (
                <tr key={m.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-white">{m.customer_name || '–'}</div>
                    <div className="text-xs text-slate-500 dark:text-white/45">{m.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-white/65">{TYPE_LABELS[m.type] || m.type}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[m.status] || 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-white/65 border-slate-200 dark:border-white/15'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-white/60 hidden md:table-cell max-w-md truncate">{m.message_text}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-white/45 whitespace-nowrap">
                    {m.sent_at ? new Date(m.sent_at).toLocaleString('pt-BR') : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}