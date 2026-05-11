// BFF — Lista de Appointments com tenant + unit + role scope no servidor.
//
// Por que existe (BFF Fase 3):
//  - Antes: AppAgenda chamava base44.entities.Appointment.filter({ company_id })
//    direto. Frontend decidia escopo de unidade e de barbeiro.
//  - Agora: servidor resolve tudo a partir do caller. Frontend só passa filtros
//    de UI (data, unidade ativa). Mesma lógica para web e mobile.
//
// Payload (todos opcionais):
//   {
//     active_unit_id?: string,    // unidade selecionada na UI (multi-unit)
//     from?: string (ISO),        // janela de scheduled_at (inclusive)
//     to?: string (ISO),
//     limit?: number (default 500, max 2000)
//   }
//
// Regras:
//   - company_id SEMPRE derivado do caller (nunca aceito do payload)
//   - role=barbeiro → força professional_id = teamMember.professional_id
//   - Filtro de unidade aplicado server-side quando multi_unit_enabled + active_unit_id
//     (mantém compat: appointments sem unit_id ficam visíveis — legacy data)
//
// Retorno: { appointments, total, scope: { company_id, professional_id?, unit_id? } }

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
    return {
      role: 'admin',
      company_id: ownerHits[0].id,
      company: ownerHits[0],
      email: user.email,
    };
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
    email: user.email,
    professional_id: tm.professional_id || null,
    unit_ids: tm.unit_ids || [],
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const caller = await getCallerContext(base44, user);
    const body = await req.json().catch(() => ({}));
    const { active_unit_id, from, to } = body || {};
    const limit = Math.min(Math.max(parseInt(body?.limit) || 500, 1), 2000);

    const sdk = base44.asServiceRole;

    // Filtro base — tenant
    const filter = { company_id: caller.company_id };

    // Barbeiro só vê seus próprios atendimentos (defesa em profundidade —
    // o frontend já filtra, mas se alguém montar o payload na mão, segura aqui).
    if (caller.role === 'barbeiro') {
      if (!caller.professional_id) {
        // TeamMember=barbeiro sem professional_id vinculado → não enxerga nada.
        return Response.json({ appointments: [], total: 0, scope: { company_id: caller.company_id } });
      }
      filter.professional_id = caller.professional_id;
    }

    // Janela temporal (opcional) — usa $gte/$lte no scheduled_at
    if (from) filter.scheduled_at = { ...(filter.scheduled_at || {}), $gte: from };
    if (to) filter.scheduled_at = { ...(filter.scheduled_at || {}), $lte: to };

    let appointments = await sdk.entities.Appointment.filter(filter, '-scheduled_at', limit);

    // Filtro de unidade aplicado em memória (Base44 não suporta filtros OR
    // direto: queremos appointments com unit_id == active_unit_id OU sem unit_id
    // para manter compat com dados legados pré-multi-unit).
    const multiUnit = !!caller.company?.multi_unit_enabled;
    if (multiUnit && active_unit_id) {
      appointments = appointments.filter(a => !a.unit_id || a.unit_id === active_unit_id);
    }

    return Response.json({
      appointments,
      total: appointments.length,
      scope: {
        company_id: caller.company_id,
        professional_id: caller.role === 'barbeiro' ? caller.professional_id : undefined,
        unit_id: (multiUnit && active_unit_id) || undefined,
      },
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ error: error.code }, { status: error.status });
    }
    console.error('[listAppointments] error:', error.message, error.stack);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});