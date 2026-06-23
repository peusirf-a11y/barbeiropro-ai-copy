// Company360Overview — dados completos da empresa em grid de cards.
import { Building2, Mail, Phone, MapPin, FileText, User, Calendar, CreditCard, Hash, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function InfoCard({ icon: Icon, label, value, href, mono }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 shadow-[var(--shadow-sm)]">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <Icon className="w-3 h-3" /> {label}
      </div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#2563EB] hover:underline break-all">
          {value || '—'}
        </a>
      ) : (
        <div className={`text-sm font-semibold text-foreground break-all ${mono ? 'font-mono text-xs' : ''}`}>
          {value || '—'}
        </div>
      )}
    </div>
  );
}

const businessTypeLabels = {
  mei: 'MEI',
  cnpj: 'CNPJ (Empresa)',
  individual: 'Pessoa Física',
};

export default function Company360Overview({ company, plan }) {
  const addr = company.address_details || {};
  const fullAddress = [
    addr.line1, addr.line2, addr.neighborhood,
    addr.city && addr.state ? `${addr.city}/${addr.state}` : (addr.city || addr.state),
    addr.postal_code,
  ].filter(Boolean).join(', ') || company.address || '—';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">Dados da empresa</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <InfoCard icon={Building2} label="Razão / Nome" value={company.name} />
          <InfoCard icon={Briefcase} label="Tipo de negócio" value={businessTypeLabels[company.business_type] || '—'} />
          <InfoCard icon={FileText} label="CPF/CNPJ" value={company.owner_cpf_cnpj} mono />
          <InfoCard icon={Phone} label="Telefone" value={company.phone} />
          <InfoCard icon={Phone} label="WhatsApp" value={company.whatsapp} />
          <InfoCard icon={MapPin} label="Endereço" value={fullAddress} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">Proprietário</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <InfoCard icon={User} label="Nome do dono" value={company.owner_name} />
          <InfoCard icon={Mail} label="E-mail do dono" value={company.owner_email} />
          <InfoCard icon={FileText} label="CPF/CNPJ do dono" value={company.owner_cpf_cnpj} mono />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">Plano & Assinatura</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <InfoCard icon={CreditCard} label="Plano contratado" value={plan?.name || company.plan_name || 'Starter'} />
          <InfoCard icon={CreditCard} label="Status assinatura" value={company.subscription_status || '—'} />
          <InfoCard
            icon={Calendar}
            label="Trial termina em"
            value={company.trial_ends_at ? format(new Date(company.trial_ends_at), "d 'de' MMM yyyy", { locale: ptBR }) : '—'}
          />
          <InfoCard
            icon={Calendar}
            label="Próximo ciclo"
            value={company.current_period_end ? format(new Date(company.current_period_end), "d 'de' MMM yyyy", { locale: ptBR }) : '—'}
          />
          <InfoCard
            icon={Calendar}
            label="Criada em"
            value={company.created_date ? format(new Date(company.created_date), "d 'de' MMM yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
          />
          <InfoCard icon={Hash} label="ID interno" value={company.id} mono />
        </div>
      </div>
    </div>
  );
}