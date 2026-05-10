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
  enviado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  simulado: 'bg-blue-50 text-blue-700 border-blue-200',
  erro: 'bg-red-50 text-red-700 border-red-200',
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
                ? 'bg-[#2563EB] text-white border-[#2563EB]'
                : 'bg-white text-gray-600 border-black/10 hover:border-[#2563EB] hover:text-[#2563EB]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#FAFBFC] border-b border-black/5">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Mensagem</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Quando</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">Nenhuma mensagem ainda</td></tr>
              )}
              {filtered.slice(0, 200).map(m => (
                <tr key={m.id} className="border-b border-black/5 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#1B1C1E]">{m.customer_name || '–'}</div>
                    <div className="text-xs text-gray-400">{m.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{TYPE_LABELS[m.type] || m.type}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[m.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 hidden md:table-cell max-w-md truncate">{m.message_text}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
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