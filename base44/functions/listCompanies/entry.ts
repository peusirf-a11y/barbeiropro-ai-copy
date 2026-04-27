// listCompanies — Super Admin only. Paginação + busca por nome/email.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('JOB START: listCompanies');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Unauthorized: Super Admin only' }, { status: 403 });
    }

    const { page = 1, page_size = 20, search = '' } = await req.json().catch(() => ({}));

    // Busca um lote suficientemente grande e filtra/pagina em memória
    // (a SDK não expõe full-text search server-side por aqui).
    const all = await base44.asServiceRole.entities.Company.list('-created_date', 1000);

    const term = String(search || '').trim().toLowerCase();
    const filtered = term
      ? all.filter(c =>
          (c.name || '').toLowerCase().includes(term) ||
          (c.owner_email || '').toLowerCase().includes(term) ||
          (c.slug || '').toLowerCase().includes(term)
        )
      : all;

    const total = filtered.length;
    const start = (Math.max(1, page) - 1) * page_size;
    const items = filtered.slice(start, start + page_size);

    return Response.json({ success: true, items, total, page, page_size });
  } catch (error) {
    console.error('JOB ERROR: listCompanies:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});