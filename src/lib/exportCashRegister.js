// Exportações da página de Relatórios do Caixa (Fase 3).
// - exportRegistersCSV: gera CSV (Excel-compatible) — uma linha por caixa.
// - exportRegistersPDF: gera PDF com KPIs + lista de caixas + DRE consolidado.
//
// Mantém simples: usa jspdf (já instalado) e gera Blob → download via <a>.

import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPaymentMethodLabel } from '@/lib/cashRegister';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
const fmtDate = (d) => d ? format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—';

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// CSV — uma linha por caixa, separador `;` para abrir no Excel-BR por padrão.
// ---------------------------------------------------------------------------
export function exportRegistersCSV(summaries, { companyName = 'Caixa', range = '' } = {}) {
  const header = [
    'Abertura', 'Fechamento', 'Aberto por', 'Fechado por',
    'Inicial', 'Entradas', 'Saídas', 'Suprimento', 'Sangria',
    'Esperado', 'Conferido', 'Diferença',
    'Atendimentos', 'Ticket médio',
  ];
  const lines = [header.join(';')];

  for (const s of summaries) {
    const r = s.register;
    const t = s.totals;
    lines.push([
      fmtDate(r.opened_at),
      fmtDate(r.closed_at),
      r.opened_by || '',
      r.closed_by || '',
      t.initial.toFixed(2).replace('.', ','),
      t.totalIn.toFixed(2).replace('.', ','),
      t.totalOut.toFixed(2).replace('.', ','),
      t.totalSuprimento.toFixed(2).replace('.', ','),
      t.totalSangria.toFixed(2).replace('.', ','),
      t.expected.toFixed(2).replace('.', ','),
      t.final != null ? t.final.toFixed(2).replace('.', ',') : '',
      t.difference != null ? t.difference.toFixed(2).replace('.', ',') : '',
      s.dre.appointment_count,
      s.dre.ticket_avg.toFixed(2).replace('.', ','),
    ].join(';'));
  }

  // BOM para Excel reconhecer UTF-8
  const csv = '\ufeff' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const filename = `relatorio-caixa-${(companyName || 'oCorte').toLowerCase().replace(/\s+/g, '-')}-${range || format(new Date(), 'yyyy-MM-dd')}.csv`;
  triggerDownload(blob, filename);
}

// ---------------------------------------------------------------------------
// PDF — KPIs + DRE consolidado + lista de caixas.
// ---------------------------------------------------------------------------
export function exportRegistersPDF(summaries, kpis, { companyName = 'O Corte', rangeLabel = '' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN = 36;
  let y = MARGIN;

  const ensureSpace = (need = 60) => {
    if (y + need > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
  };

  // ---- Header ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text(companyName, MARGIN, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`Relatório de Caixa${rangeLabel ? ` · ${rangeLabel}` : ''}`, MARGIN, y);
  y += 12;
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, MARGIN, y);
  y += 20;

  // ---- KPI strip ----
  const drawKpi = (x, w, label, value, color = [17,24,39]) => {
    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(250, 251, 252);
    doc.roundedRect(x, y, w, 56, 6, 6, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), x + 10, y + 18);
    doc.setFontSize(14);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, x + 10, y + 40);
  };
  const kpiW = (PAGE_W - MARGIN * 2 - 18) / 4;
  drawKpi(MARGIN, kpiW, 'Faturamento', fmt(kpis.gross_in), [16,185,129]);
  drawKpi(MARGIN + kpiW + 6, kpiW, 'Líquido', fmt(kpis.net), kpis.net >= 0 ? [16,185,129] : [239,68,68]);
  drawKpi(MARGIN + (kpiW + 6) * 2, kpiW, 'Atendimentos', String(kpis.appointment_count), [37,99,235]);
  drawKpi(MARGIN + (kpiW + 6) * 3, kpiW, 'Ticket médio', fmt(kpis.ticket_avg), [37,99,235]);
  y += 70;

  // ---- DRE consolidado ----
  ensureSpace(160);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('DRE do período', MARGIN, y);
  y += 14;

  doc.setDrawColor(229, 231, 235);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 10;

  const dreLine = (label, value, color = [17,24,39], bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(label, MARGIN, y);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, PAGE_W - MARGIN, y, { align: 'right' });
    y += 14;
  };
  dreLine('Faturamento bruto',  fmt(kpis.gross_in),         [16,185,129]);
  dreLine('Suprimentos',        `+${fmt(kpis.total_suprimento)}`, [37,99,235]);
  dreLine('Saídas',             `-${fmt(kpis.total_out)}`,  [239,68,68]);
  dreLine('Sangrias',           `-${fmt(kpis.total_sangria)}`, [234,88,12]);
  doc.setDrawColor(229, 231, 235);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y); y += 10;
  dreLine('Resultado líquido',  fmt(kpis.net), kpis.net >= 0 ? [16,185,129] : [239,68,68], true);
  y += 6;

  // Diferença acumulada (sobra/falta)
  if (kpis.diff_total !== 0 || kpis.diff_positive !== 0 || kpis.diff_negative !== 0) {
    dreLine('Sobra acumulada',  `+${fmt(kpis.diff_positive)}`, [16,185,129]);
    dreLine('Falta acumulada',  fmt(kpis.diff_negative), [239,68,68]);
    dreLine('Saldo de divergência', fmt(kpis.diff_total), kpis.diff_total >= 0 ? [16,185,129] : [239,68,68], true);
    y += 6;
  }

  // ---- Breakdown por forma de pagamento ----
  const breakdown = Object.entries(kpis.payment_breakdown || {}).sort((a, b) => b[1] - a[1]);
  if (breakdown.length > 0) {
    ensureSpace(40 + breakdown.length * 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text('Entradas por forma de pagamento', MARGIN, y);
    y += 14;
    doc.setDrawColor(229, 231, 235);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 10;
    for (const [method, amount] of breakdown) {
      dreLine(getPaymentMethodLabel(method), fmt(amount));
    }
    y += 6;
  }

  // ---- Top profissionais ----
  if (kpis.by_professional?.length) {
    ensureSpace(40 + kpis.by_professional.length * 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text('Ranking por profissional', MARGIN, y);
    y += 14;
    doc.setDrawColor(229, 231, 235);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 10;
    for (const p of kpis.by_professional.slice(0, 10)) {
      dreLine(`${p.professional_name} · ${p.appointments} atend.`, fmt(p.revenue));
    }
    y += 6;
  }

  // ---- Lista de caixas ----
  ensureSpace(60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(`Caixas fechados (${summaries.length})`, MARGIN, y);
  y += 14;
  doc.setDrawColor(229, 231, 235);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  doc.setFontSize(9);
  for (const s of summaries) {
    ensureSpace(40);
    const r = s.register;
    const t = s.totals;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(`${fmtDate(r.opened_at)} → ${fmtDate(r.closed_at)}`, MARGIN, y);
    if (t.difference != null && t.difference !== 0) {
      doc.setTextColor(t.difference > 0 ? 16 : 239, t.difference > 0 ? 185 : 68, t.difference > 0 ? 129 : 68);
      doc.text(`${t.difference > 0 ? '+' : ''}${fmt(t.difference)}`, PAGE_W - MARGIN, y, { align: 'right' });
    }
    y += 12;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    const meta = [
      `Inicial ${fmt(t.initial)}`,
      `Entradas ${fmt(t.totalIn)}`,
      `Saídas ${fmt(t.totalOut)}`,
      `Esperado ${fmt(t.expected)}`,
      t.final != null ? `Conferido ${fmt(t.final)}` : null,
      r.closed_by ? `por ${r.closed_by}` : null,
    ].filter(Boolean).join('  ·  ');
    doc.text(meta, MARGIN, y);
    y += 16;
  }

  const filename = `relatorio-caixa-${(companyName || 'oCorte').toLowerCase().replace(/\s+/g, '-')}-${rangeLabel || format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}

// Export individual de um único caixa (drill-down) com todas as movimentações.
export function exportSingleRegisterPDF(summary, { companyName = 'O Corte' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN = 36;
  let y = MARGIN;

  const ensureSpace = (need = 60) => {
    if (y + need > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
  };

  const r = summary.register;
  const t = summary.totals;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(17, 24, 39);
  doc.text(`${companyName} — Fechamento de caixa`, MARGIN, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`Aberto em ${fmtDate(r.opened_at)} ${r.opened_by ? `por ${r.opened_by}` : ''}`, MARGIN, y); y += 12;
  doc.text(`Fechado em ${fmtDate(r.closed_at)} ${r.closed_by ? `por ${r.closed_by}` : ''}`, MARGIN, y); y += 18;

  // Totals block
  const line = (label, value, color = [17,24,39], bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(label, MARGIN, y);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, PAGE_W - MARGIN, y, { align: 'right' });
    y += 14;
  };
  doc.setDrawColor(229, 231, 235);
  line('Saldo inicial', fmt(t.initial));
  line('Entradas',      `+${fmt(t.totalIn)}`,        [16,185,129]);
  line('Suprimentos',   `+${fmt(t.totalSuprimento)}`,[37,99,235]);
  line('Saídas',        `-${fmt(t.totalOut)}`,        [239,68,68]);
  line('Sangrias',      `-${fmt(t.totalSangria)}`,    [234,88,12]);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y); y += 10;
  line('Esperado',  fmt(t.expected), [17,24,39], true);
  if (t.final != null) line('Conferido', fmt(t.final), [17,24,39], true);
  if (t.difference != null) line('Diferença', `${t.difference > 0 ? '+' : ''}${fmt(t.difference)}`, t.difference >= 0 ? [16,185,129] : [239,68,68], true);
  y += 6;

  // Breakdown
  const breakdown = Object.entries(t.breakdown || {}).sort((a, b) => b[1] - a[1]);
  if (breakdown.length) {
    ensureSpace(40 + breakdown.length * 16);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(17,24,39);
    doc.text('Por forma de pagamento', MARGIN, y); y += 14;
    doc.line(MARGIN, y, PAGE_W - MARGIN, y); y += 10;
    for (const [m, v] of breakdown) line(getPaymentMethodLabel(m), fmt(v));
    y += 6;
  }

  // Movimentações
  if (summary.entries?.length) {
    ensureSpace(60);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(17,24,39);
    doc.text(`Movimentações (${summary.entries.length})`, MARGIN, y); y += 14;
    doc.line(MARGIN, y, PAGE_W - MARGIN, y); y += 8;
    doc.setFontSize(9);
    for (const e of summary.entries) {
      ensureSpace(24);
      const sign = (e.entry_kind === 'saida' || e.entry_kind === 'sangria') ? '-' : '+';
      const color = sign === '+' ? [16,185,129] : [239,68,68];
      doc.setFont('helvetica', 'bold'); doc.setTextColor(17,24,39);
      doc.text((e.description || e.category || e.entry_kind || 'Lançamento').slice(0, 70), MARGIN, y);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(`${sign}${fmt(e.amount)}`, PAGE_W - MARGIN, y, { align: 'right' });
      y += 11;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(107,114,128);
      const meta = [
        e.entry_kind || e.type,
        e.payment_method ? getPaymentMethodLabel(e.payment_method) : null,
        e.created_date ? format(new Date(e.created_date), "dd/MM HH:mm") : null,
      ].filter(Boolean).join(' · ');
      doc.text(meta, MARGIN, y);
      y += 13;
    }
  }

  doc.save(`fechamento-${format(new Date(r.opened_at), 'yyyy-MM-dd')}.pdf`);
}