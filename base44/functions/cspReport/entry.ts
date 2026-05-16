// cspReport — Endpoint para receber relatórios de violação CSP.
// Registra violações na entidade SecurityEvent para monitoramento.
//
// Configurar no CSP como: report-uri /api/functions/cspReport

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  // Apenas POST
  if (req.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const report = body?.['csp-report'] || body;

    if (!report) return new Response(null, { status: 204 });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ua = req.headers.get('user-agent') || 'unknown';

    // Ignora violações de extensões de browser (comuns, não acionáveis)
    const blocked = report.blocked_uri || report['blocked-uri'] || '';
    if (
      blocked.startsWith('chrome-extension://') ||
      blocked.startsWith('moz-extension://') ||
      blocked === 'inline' && report['source-file']?.includes('extension')
    ) {
      return new Response(null, { status: 204 });
    }

    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;

    await sdk.entities.SecurityEvent.create({
      event_type: 'suspicious_payload',
      severity: 'low',
      ip_address: ip,
      user_agent: ua,
      route: 'csp_violation',
      blocked: false,
      details: {
        document_uri: report['document-uri'] || report.document_uri,
        violated_directive: report['violated-directive'] || report.violated_directive,
        effective_directive: report['effective-directive'] || report.effective_directive,
        blocked_uri: blocked,
        source_file: report['source-file'] || report.source_file,
        line_number: report['line-number'] || report.line_number,
        column_number: report['column-number'] || report.column_number,
      },
    }).catch(e => console.error('[cspReport] DB error:', e.message));

    console.info('[cspReport] Violação registrada:', blocked, report['violated-directive']);

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('[cspReport] error:', error.message);
    return new Response(null, { status: 204 }); // sempre 204 (spec CSP)
  }
});