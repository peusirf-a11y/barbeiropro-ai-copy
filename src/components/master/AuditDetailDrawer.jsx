// Drawer lateral com detalhes completos de um AuditLog entry
import { createPortal } from 'react-dom';
import { X, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

function JsonViewer({ data }) {
  if (!data) return <span className="text-gray-400 text-xs">—</span>;
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    return (
      <pre className="text-[11px] font-mono text-[#1e293b] bg-[#F8FAFC] border border-black/5 rounded-xl p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">
        {str}
      </pre>
    );
  } catch {
    return <span className="text-xs text-gray-500">{String(data)}</span>;
  }
}

function Field({ label, value, mono = false }) {
  const [copied, setCopied] = useState(false);
  if (!value && value !== 0) return null;
  const str = String(value);
  const handleCopy = () => {
    navigator.clipboard.writeText(str).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">{label}</div>
      <div className={`flex items-center gap-2 text-sm text-[#111827] ${mono ? 'font-mono' : ''}`}>
        <span className="flex-1 break-all">{str}</span>
        <button onClick={handleCopy} className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors">
          {copied ? <span className="text-[10px] text-green-500">✓</span> : <Copy className="w-3 h-3 text-gray-400" />}
        </button>
      </div>
    </div>
  );
}

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  info: 'bg-blue-50 text-blue-600 border-blue-100',
};

export default function AuditDetailDrawer({ log, onClose }) {
  if (!log) return null;
  const date = log.created_date ? format(new Date(log.created_date), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : '—';
  const sev = SEVERITY_COLORS[log.severity] || SEVERITY_COLORS.info;

  const drawer = (
    <div className="fixed inset-0 z-[9999] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${sev}`}>
              {log.severity?.toUpperCase() || 'INFO'}
            </span>
            <span className="font-bold text-sm text-[#111827] font-mono">{log.action}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 modal-scroll">
          {/* Ator */}
          <section>
            <h3 className="text-xs font-bold text-[#111827] uppercase tracking-wider mb-3">Ator</h3>
            <div className="space-y-2.5">
              <Field label="E-mail" value={log.actor_email} />
              <Field label="Tipo" value={log.actor_type} />
              <Field label="Nome" value={log.actor_name} />
              <Field label="ID" value={log.actor_id} mono />
              {log.actor_is_super_admin && (
                <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 border border-purple-100">
                  Super Admin
                </span>
              )}
            </div>
          </section>

          {/* Alvo */}
          <section>
            <h3 className="text-xs font-bold text-[#111827] uppercase tracking-wider mb-3">Alvo</h3>
            <div className="space-y-2.5">
              <Field label="Tipo" value={log.target_type} />
              <Field label="ID" value={log.target_id} mono />
              <Field label="Empresa" value={log.company_id} mono />
              <Field label="Unidade" value={log.unit_id} mono />
              {log.impersonated_company_id && (
                <Field label="Empresa Impersonada" value={log.impersonated_company_id} mono />
              )}
            </div>
          </section>

          {/* Request */}
          <section>
            <h3 className="text-xs font-bold text-[#111827] uppercase tracking-wider mb-3">Request</h3>
            <div className="space-y-2.5">
              <Field label="Data/Hora" value={date} />
              <Field label="IP" value={log.ip || log.ip_address} mono />
              <Field label="Correlation ID" value={log.correlation_id} mono />
              <Field label="Request ID" value={log.request_id} mono />
              {log.user_agent && <Field label="User-Agent" value={log.user_agent} />}
            </div>
          </section>

          {/* Diff before/after */}
          {(log.before || log.after) && (
            <section>
              <h3 className="text-xs font-bold text-[#111827] uppercase tracking-wider mb-3">Diff</h3>
              <div className="space-y-3">
                {log.before && (
                  <div>
                    <div className="text-[11px] font-semibold text-red-500 mb-1">Antes</div>
                    <JsonViewer data={log.before} />
                  </div>
                )}
                {log.after && (
                  <div>
                    <div className="text-[11px] font-semibold text-green-500 mb-1">Depois</div>
                    <JsonViewer data={log.after} />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Metadata */}
          {log.metadata && (
            <section>
              <h3 className="text-xs font-bold text-[#111827] uppercase tracking-wider mb-3">Metadata</h3>
              <JsonViewer data={log.metadata} />
            </section>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(drawer, document.body) : null;
}