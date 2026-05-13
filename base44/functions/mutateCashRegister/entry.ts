// BFF — Abre um novo CashRegister com tenant scope no servidor.
// Evita que o frontend precise ter user.data.company_id preenchido para criar via RLS.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}

async function getCallerContext(base44, user) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);
  const sdk = base44.asServiceRole;

  const ownerHits = await sdk.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (ownerHits?.length) {
    return { role: 'admin', company_id: ownerHits[0].id, email: user.email };
  }

  if (user.is_super_admin) throw new AuthzError('USE_MASTER_PANEL', 403);

  const tmHits = await sdk.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  const tm = tmHits?.[0];
  if (!tm) throw new AuthzError('NO_TEAM_MEMBER', 403);
  if (tm.active === false) throw new AuthzError('USER_INACTIVE', 403);

  return { role: tm.role, company_id: tm.company_id, email: user.email };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const caller = await getCallerContext(base44, user);

    const body = await req.json().catch(() => ({}));
    const { action, register_id, initial_amount, unit_id, notes } = body || {};

    const sdk = base44.asServiceRole;

    if (action === 'open') {
      // Verifica se já tem caixa aberto para esta empresa/unidade
      const existing = await sdk.entities.CashRegister.filter(
        { company_id: caller.company_id, status: 'aberto' },
        '-opened_at', 1
      );
      if (existing?.length) {
        return Response.json({ error: 'ALREADY_OPEN' }, { status: 409 });
      }

      const register = await sdk.entities.CashRegister.create({
        company_id: caller.company_id,
        unit_id: unit_id || undefined,
        opened_at: new Date().toISOString(),
        initial_amount: +initial_amount || 0,
        opened_by: user.email,
        notes: notes || undefined,
        status: 'aberto',
      });

      console.log('[mutateCashRegister] opened', { user: user.email, register_id: register.id });
      return Response.json({ success: true, register });
    }

    return Response.json({ error: 'INVALID_ACTION' }, { status: 400 });
  } catch (error) {
    if (error.code && error.status) {
      return Response.json({ error: error.code }, { status: error.status });
    }
    console.error('[mutateCashRegister] error:', error.message);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});