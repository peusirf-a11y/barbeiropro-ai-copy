// Painel Master da Etapa 4 — visualiza e dispara migrações soft Stripe→Asaas.
// Master-only (já protegido pelo SuperAdminRoute na rota /master).

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Company } from '@/api/entities';
import {
  ArrowRightCircle, CheckCircle2, AlertCircle, Loader2, Clock, RefreshCw,
  Mail, ChevronDown, ChevronUp, Search,
} from 'lucide-react';

const STATUS_META = {
  not_migrated:           { label: 'Stripe ativo',         color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  pending_first_payment:  { label: 'Aguardando 1º pgto.',  color: 'bg-blue-50 text-blue-700 border-blue-200',     icon: Loader2 },
  migrated:               { label: 'Migrada ✓',            color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  failed:                 { label: 'Falhou',                color: 'bg-red-50 text-red-700 border-red-200',        icon: AlertCircle },
};

function statusOf(c) {
  if (c.migration_status) return c.migration_status;
  if (c.billing_provider === 'stripe' && c.stripe_subscription_id) return 'not_migrated';
  return null;
}

export default function MigrationStripeAsaasPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | not_migrated | pending_first_payment | migrated | failed
  const [expandedId, setExpandedId] = useState(null);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['master-migration-companies'],
    queryFn: async () => {
      // Pega Companies com Stripe OU em migração. O filtro de UI refina depois.
      const all = await Company.list('-created_date', 500);
      return all.filter(c =>
        c.billing_provider === 'stripe' ||
        c.billing_provider === 'asaas_pending' ||
        (c.migration_status && c.migration_status !== 'not_migrated')
      );
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return companies.filter(c => {
      const s = statusOf(c);
      if (filter !== 'all' && s !== filter) return false;
      if (!term) return true;
      return (
        (c.name || '').toLowerCase().includes(term) ||
        (c.owner_email || '').toLowerCase().includes(term) ||
        (c.owner_name || '').toLowerCase().includes(term)
      );
    });
  }, [companies, filter, search]);

  const counts = useMemo(() => {
    const out = { all: companies.length, not_migrated: 0, pending_first_payment: 0, migrated: 0, failed: 0 };
    for (const c of companies) {
      const s = statusOf(c);
      if (s && out[s] != null) out[s]++;
    }
    return out;
  }, [companies]);

  const migrate = useMutation({
    mutationFn: (companyId) => base44.functions.invoke('migrateCompanySaasToAsaas', { company_id: companyId, send_email: true })
      .then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['master-migration-companies'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-black text-foreground tracking-tight">Migração Stripe → Asaas</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Mova assinaturas SaaS ativas do Stripe para o Asaas. Stripe segue cobrando até o 1º pagamento Asaas ser confirmado — zero cobrança dupla.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Stripe ativo" value={counts.not_migrated} tone="amber" />
        <KpiCard label="Aguardando 1º pgto" value={counts.pending_first_payment} tone="blue" />
        <KpiCard label="Migradas" value={counts.migrated} tone="emerald" />
        <KpiCard label="Falharam" value={counts.failed} tone="red" />
      </div>

      {/* Filtros */}
      <div className="ds-card flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, email, owner…"
            className="w-full pl-10 pr-3 py-2 rounded-xl border bg-background text-sm"
          />
        </div>
        <select
          value={filter} onChange={e => setFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border bg-background text-sm min-w-[180px]"
        >
          <option value="all">Todos ({counts.all})</option>
          <option value="not_migrated">Stripe ativo ({counts.not_migrated})</option>
          <option value="pending_first_payment">Aguardando 1º pgto ({counts.pending_first_payment})</option>
          <option value="migrated">Migradas ({counts.migrated})</option>
          <option value="failed">Falharam ({counts.failed})</option>
        </select>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['master-migration-companies'] })}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold hover:bg-secondary"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Lista */}
      <div className="ds-card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="w-5 h-5 inline animate-spin mr-2" /> Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma empresa nessa categoria.</div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map(c => (
              <CompanyRow
                key={c.id}
                company={c}
                expanded={expandedId === c.id}
                onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                onMigrate={() => migrate.mutate(c.id)}
                migrating={migrate.isPending && migrate.variables === c.id}
                migrationError={migrate.isError && migrate.variables === c.id ? migrate.error : null}
                migrationResult={migrate.isSuccess && migrate.variables === c.id ? migrate.data : null}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CompanyRow({ company, expanded, onToggle, onMigrate, migrating, migrationError, migrationResult }) {
  const s = statusOf(company);
  const meta = STATUS_META[s] || STATUS_META.not_migrated;
  const Icon = meta.icon;
  const canMigrate = s === 'not_migrated' || s === 'failed';

  return (
    <li>
      <div className="px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-3 hover:bg-secondary/30 cursor-pointer" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground truncate">{company.name || '—'}</span>
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
              <Icon className={`w-3 h-3 ${s === 'pending_first_payment' ? 'animate-spin' : ''}`} /> {meta.label}
            </span>
            <span className="text-[11px] text-muted-foreground">{company.plan_name || '—'}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{company.owner_email}</div>
        </div>
        <button className="text-muted-foreground hover:text-foreground p-1" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-5 pb-5 bg-secondary/20 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 text-xs">
            <Field label="Stripe Subscription ID" value={company.stripe_subscription_id} mono />
            <Field label="Asaas Subscription ID" value={company.asaas_subscription_id} mono />
            <Field label="Billing provider" value={company.billing_provider} />
            <Field label="Subscription status" value={company.subscription_status} />
            <Field label="Migração iniciada em" value={fmt(company.asaas_migration_started_at)} />
            <Field label="1º pgto Asaas" value={fmt(company.asaas_first_payment_confirmed_at)} />
            <Field label="Stripe será cancelado até" value={fmt(company.stripe_pending_cancellation_at)} />
            <Field label="Link de pagamento Asaas" value={company.asaas_payment_link_url} link />
          </div>

          {canMigrate && (
            <div className="mt-5 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <button
                onClick={() => {
                  if (!confirm(`Iniciar migração para ${company.name}?\n\nAção:\n• Cria Customer + Subscription no Asaas\n• Email é enviado ao owner\n• Stripe segue ativo até 1º pgto Asaas confirmar\n• Operação é REVERSÍVEL se Asaas falhar`)) return;
                  onMigrate();
                }}
                disabled={migrating}
                className="inline-flex items-center gap-2 bg-[#2563EB] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
              >
                {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightCircle className="w-4 h-4" />}
                Migrar agora
              </button>
              <span className="text-[12px] text-muted-foreground">
                <Mail className="w-3 h-3 inline mr-1" /> Email transacional é enviado automaticamente ao owner.
              </span>
            </div>
          )}

          {s === 'pending_first_payment' && (
            <div className="mt-5 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900">
              <strong>Aguardando confirmação do 1º pagamento Asaas.</strong><br />
              Stripe será cancelado automaticamente pelo webhook assim que <code>PAYMENT_RECEIVED</code> ou <code>PAYMENT_CONFIRMED</code> chegar.
            </div>
          )}

          {s === 'migrated' && (
            <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900">
              <strong>Migração concluída.</strong> Stripe Subscription foi cancelada. Histórico Stripe preservado para auditoria.
            </div>
          )}

          {migrationError && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-900">
              <strong>Erro:</strong> {migrationError?.response?.data?.message || migrationError.message}
            </div>
          )}

          {migrationResult?.success && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900">
              <strong>Migração iniciada com sucesso.</strong> {migrationResult.message}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Field({ label, value, mono, link }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">{label}</div>
      {!value ? (
        <div className="text-muted-foreground italic mt-0.5">—</div>
      ) : link ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline break-all mt-0.5 block">Abrir link →</a>
      ) : (
        <div className={`mt-0.5 break-all ${mono ? 'font-mono text-[11px]' : 'text-foreground'}`}>{value}</div>
      )}
    </div>
  );
}

function KpiCard({ label, value, tone }) {
  const toneMap = {
    amber:   'bg-amber-50 border-amber-200 text-amber-900',
    blue:    'bg-blue-50 border-blue-200 text-blue-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    red:     'bg-red-50 border-red-200 text-red-900',
  };
  return (
    <div className={`rounded-2xl border p-4 ${toneMap[tone] || ''}`}>
      <div className="text-xs font-semibold opacity-75">{label}</div>
      <div className="text-2xl font-black mt-1">{value}</div>
    </div>
  );
}

function fmt(iso) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
}