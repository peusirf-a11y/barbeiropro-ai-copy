// Página dedicada de Auditoria do Caixa (Fase 4).
// Acesso: caps.view_audit (default admin/financeiro; ajustável por TeamMember).
import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { Shield } from 'lucide-react';

import { useCompany } from '@/hooks/useCompany';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import { useCashPermissions } from '@/hooks/useCashPermissions';

import AppPageHeader from '@/components/app/AppPageHeader';
import { SkeletonPage } from '@/components/Skeletons';
import AllUnitsNotice from '@/components/units/AllUnitsNotice';

import { resolveRange } from '@/components/caixa/HistoryFilters';
import AuditFilters from '@/components/caixa/AuditFilters';
import AuditTimeline from '@/components/caixa/AuditTimeline';

export default function AppCaixaAuditoria() {
  const { companyId, isLoading: loadingCompany } = useCompany();
  const { activeUnitId } = useActiveUnit();
  const { can, isLoading: loadingPerms } = useCashPermissions();

  const [preset, setPreset] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');

  const { from, to, label: rangeLabel } = useMemo(
    () => resolveRange(preset, customFrom, customTo), [preset, customFrom, customTo]
  );

  // Lista de e-mails para filtro
  const { data: team = [] } = useQuery({
    queryKey: ['team-audit', companyId],
    queryFn: () => base44.entities.TeamMember.filter({ company_id: companyId }, null, 200),
    enabled: !!companyId,
  });
  const teamEmails = useMemo(() => team.map(m => m.email).filter(Boolean), [team]);

  // Mapa de unidades para mostrar badge no evento
  const { data: units = [] } = useQuery({
    queryKey: ['units-audit', companyId],
    queryFn: () => base44.entities.Unit.filter({ company_id: companyId }, 'sort_order', 50),
    enabled: !!companyId,
  });
  const unitsMap = useMemo(() => {
    const m = {};
    for (const u of units) m[u.id] = u.name;
    return m;
  }, [units]);

  // Fetch eventos (sempre via backend para enforcement)
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['cash-audit', companyId, activeUnitId, from?.toISOString(), to?.toISOString(), actor, action],
    queryFn: async () => {
      const res = await base44.functions.invoke('getCashAudit', {
        from: from?.toISOString(),
        to: to?.toISOString(),
        unit_id: activeUnitId || undefined,
        actor_email: actor || undefined,
        action: action || undefined,
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || 'Falha ao buscar auditoria');
      return res.data.events || [];
    },
    enabled: !!companyId && can('view_audit'),
    staleTime: 30_000,
  });

  if (loadingCompany || loadingPerms) return <AppLayout><SkeletonPage /></AppLayout>;

  if (!can('view_audit')) {
    return <Navigate to="/app/caixa" replace />;
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Auditoria do Caixa"
          subtitle={`Trilha de quem fez o quê · ${rangeLabel}`}
          icon={Shield}
        />

        <AllUnitsNotice message="Auditoria consolidada de todas as unidades acessíveis. Selecione uma unidade para ver apenas ela." />

        <AuditFilters
          preset={preset} setPreset={setPreset}
          customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo} setCustomTo={setCustomTo}
          actor={actor} setActor={setActor}
          action={action} setAction={setAction}
          teamEmails={teamEmails}
        />

        {loadingEvents ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-10 text-center text-sm text-white/55">
            Carregando eventos…
          </div>
        ) : (
          <AuditTimeline events={events} unitsMap={unitsMap} />
        )}
      </div>
    </AppLayout>
  );
}