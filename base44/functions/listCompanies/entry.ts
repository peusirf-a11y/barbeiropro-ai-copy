// listCompanies — Super Admin only. Paginação + busca por nome/email/slug.
// Estratégia:
//   - Sem busca: list paginado direto (escala para milhares de empresas).
//   - Com busca: faz match em prefixo via filter() quando possível, senão
//     varre em lotes (limite de segurança 5000) e filtra em memória.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SEARCH_SCAN_LIMIT = 5000;

Deno.serve(async (req) => {
  console.log('JOB START: listCompanies');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Unauthorized: Super Admin only' }, { status: 403 });
    }

    const { page = 1, page_size = 20, search = '' } = await req.json().catch(() => ({}));
    const safePage = Math.max(1, Number(page) || 1);
    const safeSize = Math.min(100, Math.max(1, Number(page_size) || 20));
    const term = String(search || '').trim().toLowerCase();

    // Caminho rápido: sem busca, lista paginada total via count + slice
    if (!term) {
      // Tenta usar count() se disponível
      let total = 0;
      try {
        total = await base44.asServiceRole.entities.Company.count();
      } catch {
        // Fallback: estima baseado no offset
        total = await base44.asServiceRole.entities.Company.list('-created_date', SEARCH_SCAN_LIMIT)
          .then(arr => arr.length);
      }
      const items = await base44.asServiceRole.entities.Company.list(
        '-created_date',
        safeSize,
        (safePage - 1) * safeSize
      );
      return Response.json({ success: true, items, total, page: safePage, page_size: safeSize });
    }

    // Caminho com busca: scan limitado + filtro em memória
    const all = await base44.asServiceRole.entities.Company.list('-created_date', SEARCH_SCAN_LIMIT);
    const filtered = all.filter(c =>
      (c.name || '').toLowerCase().includes(term) ||
      (c.owner_email || '').toLowerCase().includes(term) ||
      (c.slug || '').toLowerCase().includes(term)
    );
    const total = filtered.length;
    const start = (safePage - 1) * safeSize;
    const items = filtered.slice(start, start + safeSize);
    return Response.json({
      success: true,
      items,
      total,
      page: safePage,
      page_size: safeSize,
      truncated: all.length >= SEARCH_SCAN_LIMIT,
    });
  } catch (error) {
    console.error('JOB ERROR: listCompanies:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});