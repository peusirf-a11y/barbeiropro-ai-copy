// Aba "Indicações" do /master/partners — visualização completa e auditável de indicações da plataforma.
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { referralKeys } from '@/lib/partnerKeys';
import {
  FileText,
  AlertTriangle,
  Search,
  Users,
  Building2,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Loader2,
  FilterX,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS = {
  pending: {
    label: 'Clicou / Pendente',
    badge: 'bg-white/10 text-white/70 border-white/15',
    dot: 'bg-white/40',
  },
  converted: {
    label: 'Convertido (Trial)',
    badge: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
    dot: 'bg-amber-400',
  },
  active: {
    label: 'Assinante Ativo',
    badge: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
    dot: 'bg-emerald-400',
  },
  cancelled: {
    label: 'Cancelado',
    badge: 'bg-rose-500/15 text-rose-200 border-rose-400/25',
    dot: 'bg-rose-400',
  },
  fraud: {
    label: 'Suspeita de Fraude',
    badge: 'bg-rose-500/25 text-rose-200 border-rose-400/45',
    dot: 'bg-rose-500',
  },
};

const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');

const formatDateSafe = (raw) => {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '—';
    return format(d, 'dd MMM yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
};

export default function MasterPartnersReferralsTab({
  statusFilter: initialStatusFilter = 'all',
  partners = [],
  visible: initialVisible = 25,
  onLoadMore
}) {
  const [localStatus, setLocalStatus] = useState(initialStatusFilter);
  const [searchTerm, setSearchTerm] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('all');
  const [limit, setLimit] = useState(initialVisible);

  const referralsQ = useQuery({
    queryKey: referralKeys.list({ status: localStatus, partnerId: partnerFilter, search: searchTerm }),
    queryFn: async () => {
      const res = await base44.functions.invoke('partnerAdminAction', {
        action: 'list_referrals',
        status: localStatus === 'all' ? undefined : localStatus,
        partner_id: partnerFilter === 'all' ? undefined : partnerFilter,
        search: searchTerm.trim() || undefined,
        limit: 200,
      });
      return res?.data?.referrals || [];
    },
    staleTime: 15_000,
  });

  const referrals = useMemo(() => referralsQ.data || [], [referralsQ.data]);

  // KPIs calculados da amostra de indicações
  const kpis = useMemo(() => {
    const total = referrals.length;
    const active = referrals.filter(r => r.status === 'active').length;
    const trial = referrals.filter(r => r.status === 'converted').length;
    const pending = referrals.filter(r => r.status === 'pending').length;
    const totalCommission = referrals
      .filter(r => r.status === 'active')
      .reduce((sum, r) => sum + (Number(r.commission) || 0), 0);

    return { total, active, trial, pending, totalCommission };
  }, [referrals]);

  const partnerById = (id) => {
    if (!partners || !Array.isArray(partners)) return null;
    return partners.find((p) => p.id === id);
  };

  const handleResetFilters = () => {
    setLocalStatus('all');
    setSearchTerm('');
    setPartnerFilter('all');
  };

  return (
    <section
      data-testid="referrals-section"
      aria-label="Painel de Indicações"
      className="space-y-6"
    >
      {/* Cards de Métricas de Indicações */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-4">
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Total de Indicações</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">{kpis.total}</div>
          <div className="text-[11px] text-white/40 mt-1">Registradas na plataforma</div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-4">
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Assinantes Ativos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-300">{kpis.active}</div>
          <div className="text-[11px] text-white/40 mt-1">Gerando receita mensal</div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-4">
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Em Trial / Avaliação</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300">{kpis.trial}</div>
          <div className="text-[11px] text-white/40 mt-1">Convertidos aguardando assinatura</div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-4">
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Comissões Estimadas</span>
            <ArrowUpRight className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-300">{brl(kpis.totalCommission)}</div>
          <div className="text-[11px] text-white/40 mt-1">Projeção por ciclo</div>
        </div>
      </div>

      {/* Toolbar de Filtros e Busca */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filtro por Status */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'Todas as Indicações' },
            { id: 'active', label: 'Ativas (Pagando)' },
            { id: 'converted', label: 'Em Trial' },
            { id: 'pending', label: 'Cliques / Pendentes' },
            { id: 'cancelled', label: 'Canceladas' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setLocalStatus(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                localStatus === f.id
                  ? 'bg-white text-[#050816] shadow-sm font-bold'
                  : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white border border-white/8'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Busca e Filtro de Parceiro */}
        <div className="flex items-center gap-2">
          {partners && partners.length > 0 && (
            <select
              value={partnerFilter}
              onChange={(e) => setPartnerFilter(e.target.value)}
              className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#60A5FA]"
            >
              <option value="all" className="bg-[#0b1120] text-white">Todos os parceiros</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0b1120] text-white">
                  {p.name} ({p.referral_code || p.id?.slice(0, 6)})
                </option>
              ))}
            </select>
          )}

          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar barbearia, e-mail..."
              className="w-full pl-9 pr-3 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA]"
            />
          </div>
        </div>
      </div>

      {/* Conteúdo da Tabela / Estado Vazio */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.025] backdrop-blur-xl overflow-hidden shadow-2xl">
        {referralsQ.isLoading ? (
          <div className="p-14 text-center text-white/50 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#60A5FA]" />
            <span className="text-sm">Carregando indicações da plataforma...</span>
          </div>
        ) : referrals.length === 0 ? (
          <div
            data-testid="referrals-empty-state"
            className="p-16 text-center text-white/60 flex flex-col items-center justify-center max-w-md mx-auto"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-4 text-white/40">
              <FileText className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">Nenhuma indicação encontrada</h4>
            <p className="text-xs text-white/50 leading-relaxed mb-5">
              {searchTerm || localStatus !== 'all' || partnerFilter !== 'all'
                ? 'Nenhum registro de indicação corresponde aos filtros aplicados. Tente ajustar os termos de busca ou selecionar outro status.'
                : 'Ainda não há indicações cadastradas. Conforme os parceiros compartilharem seus links e códigos de referência, as barbearias indicadas aparecerão aqui.'}
            </p>
            {(searchTerm || localStatus !== 'all' || partnerFilter !== 'all') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-semibold transition-colors"
              >
                <FilterX className="w-3.5 h-3.5" />
                Limpar Filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table data-testid="referrals-table" className="w-full text-left text-sm text-white/80 min-w-[880px]">
              <thead className="bg-white/[0.03] text-white/50 text-[11px] uppercase tracking-wider border-b border-white/8">
                <tr>
                  <th className="py-3.5 px-4">Data</th>
                  <th className="py-3.5 px-4">Parceiro Responsável</th>
                  <th className="py-3.5 px-4">Barbearia Indicada</th>
                  <th className="py-3.5 px-4">Origem / Canal</th>
                  <th className="py-3.5 px-4">Plano & Comissão</th>
                  <th className="py-3.5 px-4">Status da Conversão</th>
                  <th className="py-3.5 px-4">Integridade / Sinais</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {referrals.slice(0, limit).map((r) => {
                  const s = STATUS[r.status] || STATUS.pending;
                  const partner = partnerById(r.partner_id) || {
                    name: r.partner_name,
                    referral_code: r.referral_code,
                  };

                  return (
                    <tr
                      key={r.id}
                      data-testid={`referral-row-${r.id}`}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Data */}
                      <td className="py-3.5 px-4 text-white/55 text-xs whitespace-nowrap">
                        {formatDateSafe(r.created_date || r.created_at)}
                      </td>

                      {/* Parceiro */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/25 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            <Users className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-white">
                              {partner?.name || r.partner_name || <span className="text-white/40">Parceiro</span>}
                            </div>
                            <div className="flex items-center gap-1 font-mono text-[10px] text-[#93C5FD]">
                              <Tag className="w-2.5 h-2.5 opacity-60" />
                              {partner?.referral_code || r.referral_code || 'LINK-DIRETO'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Barbearia */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            <Building2 className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-white">
                              {r.referred_company_name || r.company_name || 'Barbearia Cadastrada'}
                            </div>
                            <div className="text-[11px] text-white/40">
                              {r.referred_email || 'Email não informado'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Origem */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/8 text-white/70 border border-white/15 text-[11px] font-medium capitalize">
                          {r.attribution_type || 'link'}
                        </span>
                      </td>

                      {/* Plano & Comissão */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="text-xs font-semibold text-white/90">
                            Plano {r.plan_name || 'Master'}
                          </div>
                          <div className="text-[11px] font-bold text-emerald-300">
                            {r.commission ? `${brl(r.commission)} / mês` : '—'}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </td>

                      {/* Sinais / Fraude */}
                      <td className="py-3.5 px-4 text-xs">
                        {r.fraud_reasons?.length ? (
                          <div className="flex items-center gap-1.5 text-rose-300">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate max-w-[180px]" title={r.fraud_reasons.join(', ')}>
                              {r.fraud_reasons.join(', ')}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-emerald-400/80 text-[11px]">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Verificada</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação / Carregar mais */}
        {limit < referrals.length && (
          <div className="p-4 border-t border-white/8 text-center bg-white/[0.01]">
            <button
              type="button"
              data-testid="load-more-referrals"
              onClick={() => {
                if (onLoadMore) onLoadMore();
                setLimit((prev) => prev + 25);
              }}
              className="text-xs font-bold text-[#93C5FD] hover:underline cursor-pointer"
            >
              Carregar mais indicações ({referrals.length - limit} restantes)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}