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
  enviado: 'bg-emerald-400/[0.12] text-emerald-200 border-emerald-400/30',
  simulado: 'bg-blue-400/[0.12] text-blue-200 border-blue-400/30',
  erro: 'bg-rose-400/[0.12] text-rose-200 border-rose-400/30',
};

export default function CRMHistoryTab({ messages }) {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all'
    ? messages
    : filter === 'crm'
      ? messages.filter(m => m.type?.startsWith('crm_'))
      : filter === 'transactional'
        ? messages.filter(m => !m.type?.startsWith('crm_'))
        : messages.filter(m => m.type === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'Todas' },
          { id: 'crm', label: 'Campanhas CRM' },
          { id: 'transactional', label: 'Transacionais' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === f.id
                ? 'bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white border-transparent shadow-[0_4px_12px_rgba(37,99,235,0.35)] ring-1 ring-white/15'
                : 'bg-white/[0.04] text-white/70 border-white/10 hover:border-blue-400/40 hover:text-[#93C5FD] hover:bg-white/[0.08]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02] border-b border-white/8">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-white/55 text-[11px] uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-white/55 text-[11px] uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-white/55 text-[11px] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-white/55 text-[11px] uppercase tracking-wider hidden md:table-cell">Mensagem</th>
                <th className="text-left px-4 py-3 font-semibold text-white/55 text-[11px] uppercase tracking-wider">Quando</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-white/40">Nenhuma mensagem ainda</td></tr>
              )}
              {filtered.slice(0, 200).map(m => (
                <tr key={m.id} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{m.customer_name || '–'}</div>
                    <div className="text-xs text-white/45">{m.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/65">{TYPE_LABELS[m.type] || m.type}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[m.status] || 'bg-white/[0.06] text-white/65 border-white/15'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/60 hidden md:table-cell max-w-md truncate">{m.message_text}</td>
                  <td className="px-4 py-3 text-xs text-white/45 whitespace-nowrap">
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