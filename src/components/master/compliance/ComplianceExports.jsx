// Exportações LGPD — log de todas as exportações de dados realizadas.

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Download, Search } from 'lucide-react';

export default function ComplianceExports({ privacyLogs, companies }) {
  const [filterCo, setFilterCo] = useState('');

  const exportLogs = useMemo(() => privacyLogs
    .filter(l => ['DATA_EXPORT_REQUESTED','DATA_EXPORT_DOWNLOADED'].includes(l.action))
    .filter(l => !filterCo || l.company_id === filterCo)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date)),
    [privacyLogs, filterCo]);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { label: 'Total de exportações', value: exportLogs.filter(l=>l.action==='DATA_EXPORT_REQUESTED').length, color:'text-[#2563EB]' },
          { label: 'Downloads realizados', value: exportLogs.filter(l=>l.action==='DATA_EXPORT_DOWNLOADED').length, color:'text-emerald-600' },
          { label: 'Tenants envolvidos',   value: [...new Set(exportLogs.map(l=>l.company_id))].length, color:'text-violet-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-black/5 p-4 shadow-sm text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-gray-400" />
            <span className="font-bold text-sm text-[#111827]">Histórico de exportações</span>
          </div>
          <select value={filterCo} onChange={e => setFilterCo(e.target.value)}
            className="px-3 py-1.5 border border-black/10 rounded-lg text-xs focus:outline-none">
            <option value="">Todos os tenants</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {exportLogs.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">Nenhuma exportação registrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-[#FAFBFC]">
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Evento</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Responsável</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Tenant</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Cliente ID</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {exportLogs.map(l => {
                const co = companies.find(c => c.id === l.company_id);
                return (
                  <tr key={l.id} className="hover:bg-[#FAFBFC]">
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${l.action === 'DATA_EXPORT_REQUESTED' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {l.action === 'DATA_EXPORT_REQUESTED' ? 'Solicitado' : 'Baixado'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-gray-700">{l.actor_email || '—'}</td>
                    <td className="px-4 py-2.5 text-[13px] font-medium text-[#111827]">{co?.name || l.company_id?.slice(-8) || '—'}</td>
                    <td className="px-4 py-2.5 text-[12px] font-mono text-gray-400">{l.customer_id?.slice(-8) || '—'}</td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-500 whitespace-nowrap">{l.created_date ? format(new Date(l.created_date), "dd/MM/yy HH:mm") : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}