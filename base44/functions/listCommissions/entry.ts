// BFF — Lista de Commission com tenant + role + unit scope no servidor.
//
// Por que existe (BFF Fase 4):
//  - AppComissoes chamava Commission.filter direto. Barbeiro deveria ver só
//    suas próprias comissões — regra estava só no frontend (não era defesa real).
//  - Unit scope: Commission não tem unit_id próprio. Quando multi-unit,
//    derivamos via Professional.unit_ids (mesma regra do front antigo).
//
// Payload (todos opcionais):
//   {
//     active_unit_id?: string,
//     professional_id?: string,   // filtrar (admin/financeiro)
//     status?: 'pendente' | 'pago' | string[],
//     from?: string (ISO),        // janela de earned_at
//     to?: string (ISO),
//     limit?: number (default 1000, max 2000)
//   }
//
// Regras:
//   - company_id SEMPRE derivado do caller
//   - role=barbeiro → força professional_id = teamMember.professional_id
//   - professional_id explícito de outro pro → ignorado se for barbeiro
//
// Retorno: { commissions, total, scope: { company_id, professional_id?, unit_id? } }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}

async function getCallerContext(base44, user) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);
  const sdk = base44.asServiceRole;

  if (user.is_super_admin) {
    throw new AuthzError('USE_MASTER_PANEL', 403);
  }

  const ownerHits = await sdk.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (ownerHits?.length) {
    return { role: 'admin', company_id: ownerHits[0].id, company: ownerHits[0] };
  }

  const tmHits = await sdk.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  const tm = tmHits?.[0];
  if (!tm) throw new AuthzError('NO_TEAM_MEMBER', 403);
  if (tm.active === false) throw new AuthzError('USER_INACTIVE', 403);

  const company = await sdk.entities.Company.get(tm.company_id).catch(() => null);
  if (!company) throw new AuthzError('COMPANY_NOT_FOUND', 404);

  return {
    role: tm.role,
    company_id: tm.company_id,
    company,
    professional_id: tm.professional_id || null,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const caller = await getCallerContext(base44, user);
    const body = await req.json().catch(() => ({}));
    const { active_unit_id, professional_id, status, from, to } = body || {};
    const limit = Math.min(Math.max(parseInt(body?.limit) || 1000, 1), 2000);

    const sdk = base44.asServiceRole;
    const filter = { company_id: caller.company_id };

    // Barbeiro só vê as próprias comissões — defesa em profundidade
    if (caller.role === 'barbeiro') {
      if (!caller.professional_id) {
        return Response.json({ commissions: [], total: 0, scope: { company_id: caller.company_id } });
      }
      filter.professional_id = caller.professional_id;
    } else if (professional_id) {
      filter.professional_id = professional_id;
    }

    if (status) {
      if (Array.isArray(status) && status.length > 0) filter.status = { $in: status };
      else if (typeof status === 'string') filter.status = status;
    }

    if (from) filter.earned_at = { ...(filter.earned_at || {}), $gte: from };
    if (to) filter.earned_at = { ...(filter.earned_at || {}), $lte: to };

    let commissions = await sdk.entities.Commission.filter(filter, '-earned_at', limit);

    // Unit scope: Commission não tem unit_id. Derivamos via Professional.unit_ids
    // (mesma regra que o frontend antigo aplicava). Só quando multi-unit + unit ativa.
    const multiUnit = !!caller.company?.multi_unit_enabled;
    if (multiUnit && active_unit_id && commissions.length > 0) {
      const professionals = await sdk.entities.Professional.filter(
        { company_id: caller.company_id },
        null,
        500
      ).catch(() => []);
      const proIdsInUnit = new Set(
        professionals
          .filter(p => !p.unit_ids?.length || p.unit_ids.includes(active_unit_id))
          .map(p => p.id)
      );
      commissions = commissions.filter(c => !c.professional_id || proIdsInUnit.has(c.professional_id));
    }

    return Response.json({
      commissions,
      total: commissions.length,
      scope: {
        company_id: caller.company_id,
        professional_id: caller.role === 'barbeiro' ? caller.professional_id : (professional_id || undefined),
        unit_id: (multiUnit && active_unit_id) || undefined,
      },
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ error: error.code }, { status: error.status });
    }
    console.error('[listCommissions] error:', error.message, error.stack);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});