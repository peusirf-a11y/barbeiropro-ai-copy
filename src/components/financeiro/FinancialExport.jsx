// Módulo de exportação financeira (PDF + Excel/CSV) com filtros por
// intervalo de datas, profissional e tipo de serviço, incluindo DRE básico.
//
// Fontes de dados:
// - Appointment (status="concluido" no período): receita bruta de serviços
// - FinancialEntry (no período): entradas extras + saídas/despesas
// - Commission (no período): custo com comissões
//
// DRE Básico:
//   (+) Receita bruta (atendimentos concluídos + entradas extras)
//   (-) Comissões
//   (-) Outras despesas (saídas)
//   (=) Resultado líquido

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import { FileDown, FileSpreadsheet, FileText, X, Filter } from 'lucide-react';
import { csvCell } from '@/lib/csvSafe';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d) => d ? format(new Date(d), 'dd/MM/yyyy', { locale: ptBR }) : '–';

// Download cross-ambiente: tenta <a download>; se o navegador (ex: WebView Android)
// não suportar o atributo download ou bloquear o clique programático, abre em nova aba.
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    const supportsDownload = 'download' in a;
    a.href = url;
    if (supportsDownload) a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    window.open(url, '_blank');
  }
  // Revoga depois de um tempo (Safari/WebView precisam do URL ainda vivo durante o open)
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export default function FinancialExport({ companyId, companyName }) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [professionalId, setProfessionalId] = useState('all');
  const [serviceId, setServiceId] = useState('all');

  const { data: professionals = [] } = useQuery({
    queryKey: ['fx-professionals', companyId],
    queryFn: () => base44.entities.Professional.filter({ company_id: companyId }, 'name', 200),
    enabled: !!companyId && open,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['fx-services', companyId],
    queryFn: () => base44.entities.Service.filter({ company_id: companyId }, 'name', 300),
    enabled: !!companyId && open,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['fx-appointments', companyId],
    queryFn: () => base44.entities.Appointment.filter({ company_id: companyId, status: 'concluido' }, '-scheduled_at', 1000),
    enabled: !!companyId && open,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['fx-entries', companyId],
    queryFn: () => base44.entities.FinancialEntry.filter({ company_id: companyId }, '-date', 1000),
    enabled: !!companyId && open,
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ['fx-commissions', companyId],
    queryFn: () => base44.entities.Commission.filter({ company_id: companyId }, '-earned_at', 1000),
    enabled: !!companyId && open,
  });

  const fromDate = from ? new Date(from + 'T00:00:00') : null;
  const toDate = to ? new Date(to + 'T23:59:59') : null;

  const data = useMemo(() => {
    // Filtra por intervalo + profissional + serviço (somente atendimentos têm os 3 filtros)
    const filteredAppts = appointments.filter(a => {
      if (!inRange(a.scheduled_at, fromDate, toDate)) return false;
      if (professionalId !== 'all' && a.professional_id !== professionalId) return false;
      if (serviceId !== 'all' && a.service_id !== serviceId) return false;
      return true;
    });

    // FinancialEntry: filtra por intervalo. Não tem profissional/serviço,
    // então quando filtros adicionais estão ativos, ignoramos entradas extras
    // e despesas (DRE será baseado apenas nos atendimentos do filtro).
    const restrictiveFilter = professionalId !== 'all' || serviceId !== 'all';
    const filteredEntries = restrictiveFilter
      ? []
      : entries.filter(e => inRange(e.date, fromDate, toDate));

    const filteredCommissions = commissions.filter(c => {
      if (!inRange(c.earned_at, fromDate, toDate)) return false;
      if (professionalId !== 'all' && c.professional_id !== professionalId) return false;
      return true;
    });

    const receitaAtendimentos = filteredAppts.reduce((s, a) => s + (a.price || 0), 0);
    const entradasExtras = filteredEntries.filter(e => e.type === 'entrada').reduce((s, e) => s + (e.amount || 0), 0);
    const saidas = filteredEntries.filter(e => e.type === 'saida').reduce((s, e) => s + (e.amount || 0), 0);
    const totalComissoes = filteredCommissions.reduce((s, c) => s + (c.amount || 0), 0);

    const receitaBruta = receitaAtendimentos + entradasExtras;
    const resultadoLiquido = receitaBruta - totalComissoes - saidas;
    const margem = receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0;

    // Saídas por categoria
    const saidasPorCategoria = {};
    filteredEntries.filter(e => e.type === 'saida').forEach(e => {
      const cat = e.category || 'Outros';
      saidasPorCategoria[cat] = (saidasPorCategoria[cat] || 0) + (e.amount || 0);
    });

    // Receita por profissional
    const receitaPorPro = {};
    filteredAppts.forEach(a => {
      const k = a.professional_name || 'Sem profissional';
      receitaPorPro[k] = (receitaPorPro[k] || 0) + (a.price || 0);
    });

    return {
      filteredAppts,
      filteredEntries,
      filteredCommissions,
      receitaAtendimentos,
      entradasExtras,
      saidas,
      totalComissoes,
      receitaBruta,
      resultadoLiquido,
      margem,
      saidasPorCategoria,
      receitaPorPro,
      restrictiveFilter,
    };
  }, [appointments, entries, commissions, fromDate, toDate, professionalId, serviceId]);

  const periodLabel = `${fmtDate(from)} a ${fmtDate(to)}`;
  const proLabel = professionalId === 'all' ? 'Todos' : (professionals.find(p => p.id === professionalId)?.name || '–');
  const svcLabel = serviceId === 'all' ? 'Todos' : (services.find(s => s.id === serviceId)?.name || '–');

  /* ─────────────── EXPORT: EXCEL (CSV com BOM, abre no Excel) ───────────────
   * M10 — usamos csvCell de lib/csvSafe.js que ALÉM de escapar aspas/separador,
   * bloqueia CSV injection (valores que começam com =, +, -, @, etc.).
   */
  const exportExcel = () => {
    const sep = ';';
    const escape = (v) => csvCell(v, sep);
    const lines = [];
    lines.push(`DRE - ${companyName || 'Barbearia'}`);
    lines.push(`Período: ${periodLabel}`);
    lines.push(`Profissional: ${proLabel}`);
    lines.push(`Serviço: ${svcLabel}`);
    lines.push('');
    lines.push('DRE BÁSICO');
    lines.push(['Linha', 'Valor (R$)'].join(sep));
    lines.push([escape('(+) Receita atendimentos'), data.receitaAtendimentos.toFixed(2).replace('.', ',')].join(sep));
    lines.push([escape('(+) Entradas extras'), data.entradasExtras.toFixed(2).replace('.', ',')].join(sep));
    lines.push([escape('(=) Receita bruta'), data.receitaBruta.toFixed(2).replace('.', ',')].join(sep));
    lines.push([escape('(-) Comissões'), data.totalComissoes.toFixed(2).replace('.', ',')].join(sep));
    lines.push([escape('(-) Despesas'), data.saidas.toFixed(2).replace('.', ',')].join(sep));
    lines.push([escape('(=) Resultado líquido'), data.resultadoLiquido.toFixed(2).replace('.', ',')].join(sep));
    lines.push([escape('Margem (%)'), data.margem.toFixed(2).replace('.', ',')].join(sep));
    lines.push('');

    lines.push('ATENDIMENTOS CONCLUÍDOS');
    lines.push(['Data', 'Cliente', 'Profissional', 'Serviço', 'Valor (R$)'].map(escape).join(sep));
    data.filteredAppts.forEach(a => {
      lines.push([
        escape(fmtDate(a.scheduled_at)),
        escape(a.customer_name || '–'),
        escape(a.professional_name || '–'),
        escape(a.service_name || '–'),
        (a.price || 0).toFixed(2).replace('.', ','),
      ].join(sep));
    });
    lines.push('');

    if (!data.restrictiveFilter) {
      lines.push('LANÇAMENTOS FINANCEIROS');
      lines.push(['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor (R$)'].map(escape).join(sep));
      data.filteredEntries.forEach(e => {
        lines.push([
          escape(fmtDate(e.date)),
          escape(e.type === 'entrada' ? 'Entrada' : 'Saída'),
          escape(e.category || '–'),
          escape(e.description || '–'),
          (e.amount || 0).toFixed(2).replace('.', ','),
        ].join(sep));
      });
      lines.push('');
    }

    lines.push('COMISSÕES');
    lines.push(['Data', 'Profissional', 'Serviço', 'Valor serviço (R$)', 'Comissão (R$)'].map(escape).join(sep));
    data.filteredCommissions.forEach(c => {
      lines.push([
        escape(fmtDate(c.earned_at)),
        escape(c.professional_name || '–'),
        escape(c.service_name || '–'),
        (c.service_price || 0).toFixed(2).replace('.', ','),
        (c.amount || 0).toFixed(2).replace('.', ','),
      ].join(sep));
    });

    const csv = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `financeiro-${from}-a-${to}.csv`);
  };

  /* ─────────────── EXPORT: PDF ─────────────── */
  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`Relatório Financeiro`, 14, y);
    y += 7;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(companyName || 'Barbearia', 14, y);
    y += 8;

    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Período: ${periodLabel}`, 14, y); y += 4;
    doc.text(`Profissional: ${proLabel}`, 14, y); y += 4;
    doc.text(`Serviço: ${svcLabel}`, 14, y); y += 4;
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, y);
    y += 8;
    doc.setTextColor(0);

    // DRE BLOCK
    doc.setFillColor(239, 246, 255);
    doc.rect(14, y, pageWidth - 28, 8, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DRE Básico', 16, y + 5.5);
    y += 12;

    const dreRows = [
      ['(+) Receita atendimentos', data.receitaAtendimentos],
      ['(+) Entradas extras', data.entradasExtras],
      ['(=) Receita bruta', data.receitaBruta, true],
      ['(-) Comissões', -data.totalComissoes],
      ['(-) Despesas', -data.saidas],
      ['(=) Resultado líquido', data.resultadoLiquido, true],
    ];

    doc.setFontSize(10);
    dreRows.forEach(([label, value, bold]) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(label, 16, y);
      const txt = fmtBRL(value);
      doc.text(txt, pageWidth - 16, y, { align: 'right' });
      y += 6;
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Margem: ${data.margem.toFixed(1)}%`, 16, y);
    y += 8;
    doc.setTextColor(0);

    // Receita por profissional
    if (Object.keys(data.receitaPorPro).length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFillColor(239, 246, 255);
      doc.rect(14, y, pageWidth - 28, 8, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Receita por profissional', 16, y + 5.5);
      y += 12;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      Object.entries(data.receitaPorPro).sort((a, b) => b[1] - a[1]).forEach(([name, val]) => {
        doc.text(name, 16, y);
        doc.text(fmtBRL(val), pageWidth - 16, y, { align: 'right' });
        y += 6;
        if (y > 280) { doc.addPage(); y = 20; }
      });
      y += 4;
    }

    // Despesas por categoria
    if (!data.restrictiveFilter && Object.keys(data.saidasPorCategoria).length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFillColor(254, 242, 242);
      doc.rect(14, y, pageWidth - 28, 8, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Despesas por categoria', 16, y + 5.5);
      y += 12;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      Object.entries(data.saidasPorCategoria).sort((a, b) => b[1] - a[1]).forEach(([cat, val]) => {
        doc.text(cat, 16, y);
        doc.text(fmtBRL(val), pageWidth - 16, y, { align: 'right' });
        y += 6;
        if (y > 280) { doc.addPage(); y = 20; }
      });
      y += 4;
    }

    // Atendimentos
    if (data.filteredAppts.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Atendimentos concluídos (${data.filteredAppts.length})`, 14, y);
      y += 6;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(250, 251, 252);
      doc.rect(14, y - 4, pageWidth - 28, 6, 'F');
      doc.text('Data', 16, y); doc.text('Cliente', 42, y); doc.text('Profissional', 90, y);
      doc.text('Serviço', 130, y); doc.text('Valor', pageWidth - 16, y, { align: 'right' });
      y += 5;
      doc.setFont('helvetica', 'normal');
      data.filteredAppts.slice(0, 200).forEach(a => {
        if (y > 285) { doc.addPage(); y = 20; }
        doc.text(fmtDate(a.scheduled_at), 16, y);
        doc.text((a.customer_name || '–').slice(0, 22), 42, y);
        doc.text((a.professional_name || '–').slice(0, 18), 90, y);
        doc.text((a.service_name || '–').slice(0, 22), 130, y);
        doc.text(fmtBRL(a.price), pageWidth - 16, y, { align: 'right' });
        y += 4.5;
      });
      if (data.filteredAppts.length > 200) {
        doc.setTextColor(120);
        doc.text(`... e mais ${data.filteredAppts.length - 200} atendimentos (use o Excel para a lista completa)`, 16, y + 2);
        doc.setTextColor(0);
      }
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`${companyName || 'Barbearia'} · ${i}/${pageCount}`, pageWidth / 2, 290, { align: 'center' });
    }

    const blob = doc.output('blob');
    downloadBlob(blob, `financeiro-${from}-a-${to}.pdf`);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2.5 border border-white/10 bg-white/[0.04] text-white/85 rounded-xl text-sm font-semibold hover:border-[#60A5FA]/40 hover:text-[#93C5FD] hover:bg-white/[0.08] backdrop-blur-md transition-all"
      >
        <FileDown className="w-4 h-4" />
        Exportar
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setOpen(false)}>
          <div className="bg-[#0A1124] border border-white/8 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_30px_80px_rgba(0,0,0,0.7)]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-xl bg-white/[0.04] ring-1 ring-blue-400/25 flex items-center justify-center">
                  <span className="absolute inset-0 rounded-xl bg-[#60A5FA]/30 blur-md opacity-60" aria-hidden="true" />
                  <FileDown className="relative w-5 h-5 text-[#93C5FD]" />
                </div>
                <div>
                  <h3 className="font-bold text-white tracking-tight">Exportar relatório financeiro</h3>
                  <p className="text-xs text-white/55">DRE + lançamentos em PDF ou Excel</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/55"><X className="w-5 h-5" /></button>
            </div>

            {/* Filtros */}
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/55">
                <Filter className="w-3.5 h-3.5" /> Filtros
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-white/60 block mb-1.5">De *</label>
                  <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/60 block mb-1.5">Até *</label>
                  <input type="date" value={to} onChange={e => setTo(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/60 block mb-1.5">Profissional</label>
                  <select value={professionalId} onChange={e => setProfessionalId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20">
                    <option value="all" className="bg-[#0A1124]">Todos os profissionais</option>
                    {professionals.map(p => <option key={p.id} value={p.id} className="bg-[#0A1124]">{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/60 block mb-1.5">Serviço</label>
                  <select value={serviceId} onChange={e => setServiceId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20">
                    <option value="all" className="bg-[#0A1124]">Todos os serviços</option>
                    {services.map(s => <option key={s.id} value={s.id} className="bg-[#0A1124]">{s.name}</option>)}
                  </select>
                </div>
              </div>

              {data.restrictiveFilter && (
                <div className="text-[11px] text-amber-200 bg-amber-400/[0.08] border border-amber-400/25 rounded-lg p-2.5 leading-relaxed">
                  Com filtros de profissional/serviço ativos, o DRE considera apenas os atendimentos e comissões correspondentes.
                  Lançamentos manuais (entradas/saídas) são incluídos somente quando os filtros estão em "Todos".
                </div>
              )}

              {/* Preview do DRE */}
              <div className="bg-white/[0.025] rounded-xl border border-white/8 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55 mb-3">Pré-visualização do DRE</div>
                <DreRow label="(+) Receita atendimentos" value={data.receitaAtendimentos} />
                <DreRow label="(+) Entradas extras" value={data.entradasExtras} />
                <DreRow label="(=) Receita bruta" value={data.receitaBruta} bold />
                <DreRow label="(-) Comissões" value={-data.totalComissoes} />
                <DreRow label="(-) Despesas" value={-data.saidas} />
                <div className="border-t border-white/10 my-2" />
                <DreRow
                  label="(=) Resultado líquido"
                  value={data.resultadoLiquido}
                  bold
                  highlight={data.resultadoLiquido >= 0 ? 'green' : 'red'}
                />
                <div className="text-[11px] text-white/55 mt-1.5">
                  Margem: <span className="font-semibold text-white">{data.margem.toFixed(1)}%</span> ·
                  {' '}{data.filteredAppts.length} atendimentos
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="p-5 border-t border-white/8 flex flex-col sm:flex-row gap-2">
              <button onClick={() => setOpen(false)}
                className="sm:flex-1 px-4 py-2.5 border border-white/10 rounded-xl text-sm font-semibold text-white/80 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                Cancelar
              </button>
              <button onClick={exportExcel}
                className="sm:flex-1 px-4 py-2.5 border border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-200 rounded-xl text-sm font-semibold hover:bg-emerald-400/[0.14] transition-colors flex items-center justify-center gap-2">
                <FileSpreadsheet className="w-4 h-4" /> Excel (.csv)
              </button>
              <button onClick={exportPDF}
                className="sm:flex-1 px-4 py-2.5 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-xl text-sm font-semibold hover:brightness-110 shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DreRow({ label, value, bold, highlight }) {
  const color =
    highlight === 'green' ? 'text-emerald-300' :
    highlight === 'red' ? 'text-rose-300' :
    value < 0 ? 'text-rose-300' : 'text-white';
  return (
    <div className={`flex items-center justify-between py-1 text-sm ${bold ? 'font-bold' : ''}`}>
      <span className={bold ? 'text-white' : 'text-white/55'}>{label}</span>
      <span className={color}>{fmtBRL(value)}</span>
    </div>
  );
}