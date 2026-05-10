// Página dedicada de uma empresa (Master). Permite gestão de:
//   - Visão geral / dados básicos
//   - Funcionalidades (overrides de features)
//   - Plano (link para o gerenciador de planos)
//
// Rota: /master/barbearias/:id

import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useState } from 'react';
import { ArrowLeft, Building2, Layers, Mail, Globe, CreditCard } from 'lucide-react';
import CompanyFeatureOverrides from '@/components/master/CompanyFeatureOverrides';

const TABS = [
  { key: 'overview',     label: 'Visão geral',    icon: Building2 },
  { key: 'features',     label: 'Funcionalidades', icon: Layers },
];

const statusConfig = {
  active:   { label: 'Ativa',     color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  trial:    { label: 'Trial',     color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  inactive: { label: 'Inativa',   color: 'bg-gray-100 text-gray-600 border border-gray-200' },
  blocked:  { label: 'Bloqueada', color: 'bg-red-50 text-red-700 border border-red-200' },
};

export default function MasterCompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');

  const { data: company, isLoading } = useQuery({
    queryKey: ['master-company', id],
    queryFn: () => base44.entities.Company.get(id),
    enabled: !!id,
  });

  const { data: plan } = useQuery({
    queryKey: ['master-company-plan', company?.plan_id],
    queryFn: () => base44.entities.Plan.get(company.plan_id),
    enabled: !!company?.plan_id,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-[#6B7280] text-sm">Carregando…</div>;
  }

  if (!company) {
    return (
      <div className="p-8 text-center">
        <div className="text-[#6B7280] text-sm">Empresa não encontrada.</div>
        <button onClick={() => navigate('/master/barbearias')} className="mt-3 text-sm text-[#2563EB] font-semibold hover:underline">Voltar para barbearias</button>
      </div>
    );
  }

  const statusInfo = statusConfig[company.status] || statusConfig.active;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => navigate('/master/barbearias')} className="text-xs text-[#6B7280] hover:text-[#2563EB] inline-flex items-center gap-1 mb-2 font-medium">
          <ArrowLeft className="w-3.5 h-3.5" /> Barbearias
        </button>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-black text-[#111827] tracking-tight">{company.name}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-[#EFF6FF] text-[#2563EB] rounded-full border border-[#DBEAFE]">
                {plan?.name || company.plan_name || 'Starter'}
              </span>
              {company.owner_email && (
                <span className="text-xs text-[#6B7280] inline-flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {company.owner_email}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-black/5">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-1.5 border-b-2 transition-colors ${
                active
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoCard icon={Building2} label="Nome" value={company.name} />
          <InfoCard icon={Mail} label="E-mail do dono" value={company.owner_email || '—'} />
          <InfoCard
            icon={Globe}
            label="Slug público"
            value={company.slug ? `/agendar/${company.slug}` : '—'}
            href={company.slug ? `/agendar/${company.slug}` : null}
          />
          <InfoCard icon={CreditCard} label="Plano" value={plan?.name || company.plan_name || 'Starter'} />
          <InfoCard icon={CreditCard} label="Status assinatura" value={company.subscription_status || '—'} />
          <InfoCard icon={Building2} label="Criada em" value={company.created_date ? new Date(company.created_date).toLocaleDateString('pt-BR') : '—'} />
        </div>
      )}

      {tab === 'features' && (
        <CompanyFeatureOverrides company={company} plan={plan} />
      )}
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, href }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-[var(--shadow-sm)]">
      <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#2563EB] hover:underline break-all">
          {value}
        </a>
      ) : (
        <div className="text-sm font-semibold text-[#111827] break-all">{value}</div>
      )}
    </div>
  );
}