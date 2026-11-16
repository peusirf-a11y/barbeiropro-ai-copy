// AppSeguranca — Configurações > Segurança

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/layout/AppLayout';
import AppPageHeader from '@/components/app/AppPageHeader';
import { Shield } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import SessionActivityStream from '@/components/security/SessionActivityStream';

export default function AppSeguranca() {
  const { user } = useAuth();

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });
  const company = companies.find(c => c.owner_email === user?.email) || companies[0];

  const { data: adminLogs = [] } = useQuery({
    queryKey: ['admin-audit-logs', company?.id],
    queryFn: () => base44.entities.AdminAuditLog.filter({ company_id: company.id }, '-created_date', 50),
    enabled: !!company?.id,
  });

  const { data: securityEvents = [] } = useQuery({
    queryKey: ['security-events-company', company?.id],
    queryFn: () => base44.entities.SecurityEvent.filter({ company_id: company.id }, '-created_date', 20),
    enabled: !!company?.id,
  });

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Segurança"
          subtitle="Trilha de auditoria e eventos de segurança da sua barbearia"
          icon={Shield}
        />

        {/* KPIs rápidos */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white dark:bg-[#0B1121]/90 rounded-2xl border border-[#E5E7EF] dark:border-white/[0.08] p-4 text-center shadow-sm">
            <div className="text-2xl font-black text-[#111827] dark:text-white">{adminLogs.length}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Ações auditadas</div>
          </div>
          <div className="bg-white dark:bg-[#0B1121]/90 rounded-2xl border border-[#E5E7EF] dark:border-white/[0.08] p-4 text-center shadow-sm">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {adminLogs.filter(l => l.severity === 'critical').length}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Ações críticas</div>
          </div>
          <div className="bg-white dark:bg-[#0B1121]/90 rounded-2xl border border-[#E5E7EF] dark:border-white/[0.08] p-4 text-center shadow-sm">
            <div className="text-2xl font-black text-red-600 dark:text-rose-400">
              {securityEvents.filter(e => e.severity === 'high' || e.severity === 'critical').length}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Alertas de segurança</div>
          </div>
        </div>

        {/* Políticas de Proteção Ativas */}
        <div className="bg-white dark:bg-[#0B1121]/90 rounded-2xl border border-[#E5E7EF] dark:border-white/[0.08] p-5 shadow-sm mb-6" data-testid="app-active-protection-policies">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-[#111827] dark:text-white">Políticas de Proteção Ativas</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Controles de segurança ativos para proteção da sua barbearia</p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-400/25">
              4 Políticas Ativas
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { name: 'Isolamento de Dados (Multi-Tenant RLS)', status: 'Ativa', desc: 'Acesso restrito exclusivamente aos membros autenticados da unidade.' },
              { name: 'Proteção contra Força Bruta (Rate Limit)', status: 'Ativa', desc: 'Bloqueio automático de tentativas suspeitas de login.' },
              { name: 'Trilha de Auditoria Imutável', status: 'Ativa', desc: 'Registro permanente de alterações financeiras, caixa e permissões.' },
              { name: 'Conformidade e Privacidade LGPD', status: 'Ativa', desc: 'Criptografia em trânsito e proteção de dados pessoais de clientes.' },
            ].map((pol) => (
              <div key={pol.name} className="rounded-xl border border-[#E5E7EF] dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{pol.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">{pol.status}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">{pol.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Activity stream com filtros integrados */}
        {company && <SessionActivityStream companyId={company.id} limit={60} />}

        <div className="mt-6 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-400/25 rounded-2xl p-4 text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
          <strong>Sobre a auditoria:</strong> Todas as ações destrutivas (exclusões, anonimizações, alterações financeiras, mudanças de permissão) são registradas automaticamente com actor, IP, data e estado antes/depois. Esses logs são imutáveis e não podem ser excluídos pelo painel.
        </div>
      </div>
    </AppLayout>
  );
}