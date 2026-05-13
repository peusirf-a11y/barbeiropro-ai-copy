// Resolve a empresa do usuário autenticado (owner ou team member).
// Substitui o anti-pattern `Company.list()` no frontend (A1 — Sprint A):
// - frontend nunca executa query tenant-sensitive
// - backend escolhe deterministicamente (owner > team member)
// - super-admin recebe null (precisa usar painel master)
//
// Retorna { company, role } onde role é o vínculo do usuário com a empresa:
//   'owner'        → dono da empresa (Company.owner_email)
//   'team_member'  → registro ativo em TeamMember
//   null           → sem vínculo (super-admin puro ou usuário órfão)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function publicCompany(c) {
  // Devolvemos o objeto inteiro porque o frontend já usa muitos campos
  // (logo_url, primary_color, status, plan_id, multi_unit_enabled, etc).
  // Não há segredos no schema Company — todos os campos sensíveis (stripe secrets,
  // webhook keys) ficam em env vars, não no entity.
  return c;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ company: null, role: null }, { status: 401 });
    }

    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { impersonation_token } = body || {};

    // Impersonação: Master vê a empresa alvo
    if (impersonation_token && user.is_super_admin) {
      const sessions = await sdk.entities.ImpersonationSession.filter(
        { token: impersonation_token }, '-created_date', 1,
      );
      const session = sessions?.[0];
      if (session && !session.ended_at && new Date(session.expires_at).getTime() > Date.now() && session.actor_email === user.email) {
        const co = await sdk.entities.Company.get(session.company_id).catch(() => null);
        if (co) {
          console.log('[getMyCompany] impersonation ok', { actor: user.email, company_id: co.id });
          return Response.json({ company: publicCompany(co), role: 'admin', is_impersonating: true });
        }
      }
      return Response.json({ company: null, role: null, impersonation_error: true });
    }

    // 1) Owner: prioridade máxima — Company.owner_email é fonte da verdade.
    const ownerHits = await sdk.entities.Company.filter(
      { owner_email: user.email },
      '-created_date',
      1,
    );
    if (ownerHits?.length) {
      return Response.json({ company: publicCompany(ownerHits[0]), role: 'owner' });
    }

    // 2) Team member ativo.
    const tmHits = await sdk.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
    const tm = tmHits?.[0];
    if (tm && tm.active !== false) {
      const co = await sdk.entities.Company.get(tm.company_id).catch(() => null);
      if (co) return Response.json({ company: publicCompany(co), role: 'team_member' });
    }

    // 3) Sem vínculo: super-admin puro ou usuário órfão. Devolve null sem erro.
    return Response.json({ company: null, role: null });
  } catch (error) {
    console.error('[getMyCompany] error:', error.message);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});