// Central de consentimentos cross-tenant — tabela global com filtros.

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, Filter, Download } from 'lucide-react';

const CONSENT_LABELS = {
  whatsapp_marketing: 'Marketing WhatsApp',
  email_marketing: 'E-mail marketing',
  automated_reminders: 'Lembretes automáticos',
  post_service_review: 'Avaliação pós-atendimento',
  ai_recommendations: 'Recomendações personalizadas',
  data_processing_general: 'Tratamento geral de dados',
};

const SOURCE_LABELS = {
  booking_flow: 'Agendamento',
  customer_dashboard: 'Área do cliente',
  staff_on_behalf: 'Atendente',
  import: 'Importação',
  api: 'API',
};

export default function ComplianceConsents({ consents, companies, loadingConsents }) {
  const [filterCompany, setFilterCompany] = useState('');
  const [filterType, setFilterType]       = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [page, setPage] = useState(0);
  const PER_PAGE = 30;

  const filtered = useMemo(() => {
    return consents.filter(c => {
      if (filterCompany && c.company_id !== filterCompany) return false;
      if (filterType   && c.consent_type !== filterType)   return false;
      if (filterStatus === 'granted' && !c.granted) return false;
      if (filterStatus === 'revoked' && c.granted)  return false;
      return true;
    });
  }, [consents, filterCompany, filterType, filterStatus]);

  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const exportCSV = () => {
    const headers = ['empresa','tipo','status','origem','data','ip','user_agent','versao_legal'];
    const rows = filtered.map(c => {
      const co = companies.find(co => co.id === c.company_id);
      return [
        co?.name || c.company_id,
        CONSENT_LABELS[c.consent_type] || c.consent_type,
        c.granted ? 'Ativo' : 'Revogado',
        c.source || '—',
        c.granted_at ? format(new Date(c.granted_at), 'dd/MM/yyyy HH:mm') : '—',
        c.ip_address || '—',
        c.user_agent || '—',
        c.legal_text_version || '—',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `consentimentos_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="text-[11px] font-semibold text-gray-500 block mb-1">Tenant</label>
            <select value={filterCompany} onChange={e => { setFilterCompany(e.target.value); setPage(0); }}
              className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Todos</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[11px] font-semibold text-gray-500 block mb-1">Tipo</label>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0); }}
              className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Todos</option>
              {Object.entries(CONSENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-[11px] font-semibold text-gray-500 block mb-1">Status</label>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
              className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Todos</option>
              <option value="granted">Ativo</option>
              <option value="revoked">Revogado</option>
            </select>
          </div>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-black/10 bg-white rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap">
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </button>
        </div>
        <div className="mt-2 text-[11px] text-gray-400">{filtered.length.toLocaleString()} registros</div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-[#FAFBFC]">
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Tenant</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Tipo</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Status</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Origem</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Data</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Versão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {loadingConsents ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">Carregando…</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">Nenhum registro encontrado.</td></tr>
              ) : paginated.map(c => {
                const co = companies.find(co => co.id === c.company_id);
                return (
                  <tr key={c.id} className="hover:bg-[#FAFBFC] transition-colors">
                    <td className="px-4 py-2.5 font-medium text-[#111827] text-[13px]">{co?.name || <span className="font-mono text-gray-400">{c.company_id?.slice(-8)}</span>}</td>
                    <td className="px-4 py-2.5 text-[13px] text-gray-700">{CONSENT_LABELS[c.consent_type] || c.consent_type}</td>
                    <td className="px-4 py-2.5">
                      {c.granted
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Ativo</span>
                        : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Revogado</span>}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-500">{SOURCE_LABELS[c.source] || c.source || '—'}</td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-500 whitespace-nowrap">{c.granted_at ? format(new Date(c.granted_at), "dd/MM/yy HH:mm") : '—'}</td>
                    <td className="px-4 py-2.5 text-[12px] font-mono text-gray-400">{c.legal_text_version || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-black/5 flex items-center justify-between">
            <span className="text-[12px] text-gray-400">Pág. {page + 1} de {totalPages}</span>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-2.5 py-1 rounded-lg text-xs border border-black/10 disabled:opacity-40 hover:bg-gray-50">‹ Ant.</button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-2.5 py-1 rounded-lg text-xs border border-black/10 disabled:opacity-40 hover:bg-gray-50">Próx. ›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}