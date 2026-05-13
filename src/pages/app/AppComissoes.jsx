import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useTeamRole } from '@/lib/useTeamRole';
import { canPayCommission } from '@/lib/rolePermissions';
import { useState } from 'react';
import { DollarSign, Check, Percent, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EmptyState from '@/components/EmptyState';
import { SkeletonPage } from '@/components/Skeletons';
import AppPageHeader from '@/components/app/AppPageHeader';
import KpiCard from '@/components/dashboard/KpiCard';
import FilterSelect from '@/components/ui/filter-select';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import { filterByUnit, filterProfessionalsByUnit } from '@/lib/unitFilter';

export default function AppComissoes() {
  const { companyId, isLoading: loadingCompany } = useCompany();
  const { activeUnitId, isMultiUnit } = useActiveUnit();
  const { data: teamRole } = useTeamRole();
  const isBarbeiro = teamRole?.role === 'barbeiro';
  const myProId = teamRole?.professional_id || null;
  const canPay = canPayCommission(teamRole?.role);

  const [period, setPeriod] = useState('this_month');
  const [filterPro, setFilterPro] = useState(isBarbeiro && myProId ? myProId : 'all');
  const queryClient = useQueryClient();

  // BFF Fase 4: comissões via listCommissions. Barbeiro é forçado server-side
  // a ver só as próprias (defesa em profundidade). Unit scope server-side via
  // Professional.unit_ids quando multi-unit.
  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ['commissions', companyId, activeUnitId, isBarbeiro ? myProId : 'all'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listCommissions', {
        active_unit_id: activeUnitId,
        limit: 1000,
      });
      return res?.data?.commissions || [];
    },
    enabled: !!companyId && (!isBarbeiro || !!myProId),
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals', companyId, activeUnitId],
    queryFn: async () => {
      const res = await base44.functions.invoke('listProfessionals', {
        active_unit_id: activeUnitId || undefined,
        active_only: false,
      });
      return res?.data?.professionals || [];
    },
    enabled: !!companyId,
  });

  // BFF Fase 6: pagamento de comissão via mutateCommission (action semântica).
  // Bloqueio de barbeiro/recepção/super-admin é server-side (defesa em profundidade).
  // Batch único (1 request em vez de N updates paralelos — menos credits, audit log único).
  const payMutation = useMutation({
    mutationFn: async (ids) => {
      const res = await base44.functions.invoke('mutateCommission', {
        action: 'mark_paid',
        commission_ids: ids,
      });
      if (!res?.data?.success) {
        const code = res?.data?.error || 'UNKNOWN';
        const map = {
          FORBIDDEN_ROLE: 'Você não tem permissão para pagar comissões.',
          COMPANY_BLOCKED: 'Operação bloqueada — empresa inativa.',
          BATCH_TOO_LARGE: 'Selecione no máximo 200 comissões por vez.',
        };
        throw new Error(map[code] || 'Não foi possível marcar como pago.');
      }
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commissions', companyId] }),
    onError: (err) => alert(err.message),
  });

  const now = new Date();
  const inPeriod = (c) => {
    const d = new Date(c.earned_at);
    if (period === 'this_month') return d >= startOfMonth(now) && d <= endOfMonth(now);
    if (period === 'last_month') { const lm = subMonths(now, 1); return d >= startOfMonth(lm) && d <= endOfMonth(lm); }
    return true;
  };

  // Unit scope já aplicado pelo backend (listCommissions). Aqui só aplicamos
  // os filtros de UI (período e profissional selecionado).
  const filtered = commissions.filter(c => inPeriod(c) && (filterPro === 'all' || c.professional_id === filterPro));

  // Resumo por profissional
  const byPro = {};
  filtered.forEach(c => {
    if (!byPro[c.professional_id]) byPro[c.professional_id] = { id: c.professional_id, name: c.professional_name, total: 0, pendente: 0, count: 0, ids_pendentes: [] };
    const row = byPro[c.professional_id];
    row.total += c.amount || 0;
    row.count += 1;
    if (c.status === 'pendente') {
      row.pendente += c.amount || 0;
      row.ids_pendentes.push(c.id);
    }
  });
  const summary = Object.values(byPro).sort((a, b) => b.total - a.total);
  const grandTotal = filtered.reduce((s, c) => s + (c.amount || 0), 0);
  const grandPending = filtered.filter(c => c.status === 'pendente').reduce((s, c) => s + (c.amount || 0), 0);

  if (loadingCompany || isLoading) {
    return <AppLayout><SkeletonPage /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Comissões"
          subtitle="Cálculo automático ao concluir atendimentos"
          icon={Percent}
        >
          {!isBarbeiro && (
            <FilterSelect value={filterPro} onChange={setFilterPro} aria-label="Filtrar por profissional">
              <option value="all">Todos os profissionais</option>
              {filterProfessionalsByUnit(professionals, activeUnitId, isMultiUnit).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </FilterSelect>
          )}
          <FilterSelect value={period} onChange={setPeriod} aria-label="Período">
            <option value="this_month">Este mês</option>
            <option value="last_month">Mês passado</option>
            <option value="all">Todo o período</option>
          </FilterSelect>
        </AppPageHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <KpiCard
            label="Total apurado"
            value={`R$ ${grandTotal.toFixed(2).replace('.', ',')}`}
            sub={`${filtered.length} atendimentos`}
            icon={DollarSign}
            tone="blue"
          />
          <KpiCard
            label="A pagar"
            value={`R$ ${grandPending.toFixed(2).replace('.', ',')}`}
            sub="Comissões pendentes"
            icon={Percent}
            tone="amber"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/8">
            <EmptyState
              icon={DollarSign}
              title="Nenhuma comissão no período"
              description="Comissões são geradas automaticamente quando um agendamento é marcado como concluído. Configure a comissão de cada profissional na tela de Profissionais."
            />
          </div>
        ) : (
          <>
            {/* Resumo por profissional */}
            <div className="bg-white rounded-2xl border border-black/5 overflow-hidden mb-6 shadow-[var(--shadow-sm)]">
              <div className="px-5 py-3 border-b border-black/5 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] bg-[#FAFBFC]">Por profissional</div>
              <div className="divide-y divide-black/5">
                {summary.map(row => (
                  <div key={row.id} className="flex items-center gap-4 p-4 flex-wrap hover:bg-[#FAFBFC] transition-colors">
                    <div className="w-9 h-9 bg-gradient-to-br from-[#2563EB] to-[#60A5FA] rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[#111827] truncate">{row.name || '–'}</div>
                      <div className="text-xs text-[#6B7280]">{row.count} atendimentos</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-[#111827]">R$ {row.total.toFixed(2)}</div>
                      {row.pendente > 0 && <div className="text-xs text-amber-600 font-semibold">R$ {row.pendente.toFixed(2)} pendente</div>}
                    </div>
                    {canPay && row.ids_pendentes.length > 0 && (
                      <button onClick={() => { if (confirm(`Marcar ${row.ids_pendentes.length} comissões de ${row.name} como pagas?`)) payMutation.mutate(row.ids_pendentes); }}
                        className="bg-[#2563EB] text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-[#1d4ed8] flex items-center gap-1.5 shadow-[0_4px_12px_rgba(37,99,235,0.25)]">
                        <Check className="w-3.5 h-3.5" />Marcar como pago
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Detalhe */}
            <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
              <div className="px-5 py-3 border-b border-black/5 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] bg-[#FAFBFC]">Detalhamento</div>
              <div className="divide-y divide-black/5 max-h-[500px] overflow-y-auto">
                {filtered.map(c => (
                  <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-[#FAFBFC] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-[#111827] truncate">{c.service_name || '–'}</div>
                      <div className="text-xs text-[#6B7280]">
                        {c.professional_name} · {format(new Date(c.earned_at), "d MMM yyyy", { locale: ptBR })}
                        {' · '}{c.commission_type === 'percent' ? `${c.commission_value}% de R$ ${c.service_price?.toFixed(2)}` : `valor fixo`}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-[#111827]">R$ {c.amount?.toFixed(2)}</div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${c.status === 'pago' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {c.status === 'pago' ? 'Pago' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}