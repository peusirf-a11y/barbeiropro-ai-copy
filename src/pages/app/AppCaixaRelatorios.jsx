// Página Relatórios do Caixa (Fase 3).
// Filtros de período → KPIs + DRE + lista de caixas fechados → drill-down + export PDF/CSV.
import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { BarChart2, Download, FileText } from 'lucide-react';

import { useCompany } from '@/hooks/useCompany';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import { filterByUnit } from '@/lib/unitFilter';

import AppPageHeader from '@/components/app/AppPageHeader';
import { SkeletonPage } from '@/components/Skeletons';
import EmptyState from '@/components/EmptyState';
import AllUnitsNotice from '@/components/units/AllUnitsNotice';

import HistoryFilters, { resolveRange } from '@/components/caixa/HistoryFilters';
import HistoryKpis from '@/components/caixa/HistoryKpis';
import HistoryDreCard from '@/components/caixa/HistoryDreCard';
import HistoryTable from '@/components/caixa/HistoryTable';
import CashRegisterDetailModal from '@/components/caixa/CashRegisterDetailModal';

import { buildRegisterSummaries, consolidateKpis, filterRegistersInRange } from '@/lib/cashRegisterReports';
import { exportRegistersCSV, exportRegistersPDF, exportSingleRegisterPDF } from '@/lib/exportCashRegister';

export default function AppCaixaRelatorios() {
  const { company, companyId, isLoading: loadingCompany } = useCompany();
  const { activeUnitId, isMultiUnit } = useActiveUnit();

  const [preset, setPreset] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selected, setSelected] = useState(null);

  const { from, to, label: rangeLabel } = useMemo(
    () => resolveRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  // Caixas (todos os fechados; filtramos por período no client)
  const { data: registersRaw = [], isLoading: loadingRegisters } = useQuery({
    queryKey: ['cash-registers-reports', companyId, activeUnitId],
    queryFn: () => base44.entities.CashRegister.filter({ company_id: companyId }, '-opened_at', 500),
    enabled: !!companyId,
  });

  // Movimentações (para drill-down e fallback de snapshots ausentes)
  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['cash-entries-reports', companyId, activeUnitId],
    queryFn: () => base44.entities.FinancialEntry.filter({ company_id: companyId }, '-created_date', 2000),
    enabled: !!companyId,
  });

  // Profissionais para enriquecer ranking
  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals-reports', companyId],
    queryFn: () => base44.entities.Professional.filter({ company_id: companyId }, null, 200),
    enabled: !!companyId,
  });
  const professionalsMap = useMemo(() => {
    const m = {};
    for (const p of professionals) m[p.id] = { name: p.name };
    return m;
  }, [professionals]);

  // Pipeline: filtra por unidade ativa → filtra por período → constrói sumários → KPIs
  const summaries = useMemo(() => {
    const byUnit = filterByUnit(registersRaw, activeUnitId, isMultiUnit);
    const inRange = filterRegistersInRange(byUnit, from, to);
    return buildRegisterSummaries(inRange, entries, professionalsMap);
  }, [registersRaw, entries, professionalsMap, activeUnitId, isMultiUnit, from, to]);

  const kpis = useMemo(() => consolidateKpis(summaries), [summaries]);

  const handleExportPdf = () => exportRegistersPDF(summaries, kpis, { companyName: company?.name, rangeLabel });
  const handleExportCsv = () => exportRegistersCSV(summaries, { companyName: company?.name, range: rangeLabel.replace(/[\/ ]/g, '-') });
  const handleExportSingle = (s) => exportSingleRegisterPDF(s, { companyName: company?.name });

  if (loadingCompany || loadingRegisters || loadingEntries) {
    return <AppLayout><SkeletonPage /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Relatórios do Caixa"
          subtitle={`DRE consolidado, histórico de fechamentos e exportação · ${rangeLabel}`}
          icon={BarChart2}
        >
          <div className="flex gap-2">
            <button
              onClick={handleExportCsv}
              disabled={!summaries.length}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-semibold text-white/85 hover:border-[#60A5FA]/40 hover:text-[#93C5FD] hover:bg-white/[0.08] backdrop-blur-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />Excel
            </button>
            <button
              onClick={handleExportPdf}
              disabled={!summaries.length}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white text-sm font-semibold hover:brightness-110 shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />PDF
            </button>
          </div>
        </AppPageHeader>

        <AllUnitsNotice message="Relatório consolidado de todas as unidades. Selecione uma unidade para ver apenas ela." />

        <HistoryFilters
          preset={preset}
          setPreset={setPreset}
          customFrom={customFrom}
          setCustomFrom={setCustomFrom}
          customTo={customTo}
          setCustomTo={setCustomTo}
        />

        {summaries.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md">
            <EmptyState
              icon={BarChart2}
              title="Nada para reportar ainda"
              description="Nenhum caixa fechado neste período. Ajuste o filtro acima ou feche o caixa do dia para começar a ver dados aqui."
            />
          </div>
        ) : (
          <>
            <HistoryKpis kpis={kpis} />
            <HistoryDreCard kpis={kpis} />
            <HistoryTable
              summaries={summaries}
              onSelect={setSelected}
              onExport={handleExportSingle}
            />
          </>
        )}

        <CashRegisterDetailModal
          open={!!selected}
          onClose={() => setSelected(null)}
          summary={selected}
          onExport={handleExportSingle}
        />
      </div>
    </AppLayout>
  );
}