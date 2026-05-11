// BFF — Lista de WhatsAppMessage com tenant + unit scope no servidor.
//
// Por que existe (BFF Fase 4):
//  - AppCRM e RetentionCampaignsCard chamavam WhatsAppMessage.filter direto.
//    Logs de comunicação são dados sensíveis (telefone do cliente + conteúdo).
//
// Payload (todos opcionais):
//   {
//     active_unit_id?: string,
//     customer_id?: string,        // filtrar por cliente
//     type?: string | string[],    // confirmacao, lembrete_24h, crm_*, etc.
//     status?: string | string[],  // enviado | erro | simulado
//     limit?: number (default 500, max 2000)
//   }
//
// Regras:
//   - company_id SEMPRE derivado do caller
//   - role=barbeiro → bloqueado
//   - customer_id validado (cross-tenant retorna 404)
//   - Unit scope: WhatsAppMessage tem unit_id próprio (quando aplicável).
//     Quando multi_unit_enabled + active_unit_id, filtra unit_id == active OR vazio.
//
// Retorno: { messages, total, scope: { company_id, customer_id? } }

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
  if (tm.role === 'barbeiro') throw new AuthzError('FORBIDDEN_ROLE', 403);

  const company = await sdk.entities.Company.get(tm.company_id).catch(() => null);
  if (!company) throw new AuthzError('COMPANY_NOT_FOUND', 404);

  return { role: tm.role, company_id: tm.company_id, company };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const caller = await getCallerContext(base44, user);
    const body = await req.json().catch(() => ({}));
    const { active_unit_id, customer_id, type, status } = body || {};
    const limit = Math.min(Math.max(parseInt(body?.limit) || 500, 1), 2000);

    const sdk = base44.asServiceRole;
    const filter = { company_id: caller.company_id };

    if (customer_id) {
      const cust = await sdk.entities.Customer.get(customer_id).catch(() => null);
      if (!cust || cust.company_id !== caller.company_id) {
        return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
      }
      filter.customer_id = customer_id;
    }

    if (type) {
      if (Array.isArray(type) && type.length > 0) filter.type = { $in: type };
      else if (typeof type === 'string') filter.type = type;
    }

    if (status) {
      if (Array.isArray(status) && status.length > 0) filter.status = { $in: status };
      else if (typeof status === 'string') filter.status = status;
    }

    let messages = await sdk.entities.WhatsAppMessage.filter(filter, '-sent_at', limit);

    // Unit scope (em memória — mantém compat com mensagens legadas sem unit_id)
    const multiUnit = !!caller.company?.multi_unit_enabled;
    if (multiUnit && active_unit_id) {
      messages = messages.filter(m => !m.unit_id || m.unit_id === active_unit_id);
    }

    return Response.json({
      messages,
      total: messages.length,
      scope: {
        company_id: caller.company_id,
        customer_id: customer_id || undefined,
        unit_id: (multiUnit && active_unit_id) || undefined,
      },
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ error: error.code }, { status: error.status });
    }
    console.error('[listWhatsAppMessages] error:', error.message, error.stack);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});