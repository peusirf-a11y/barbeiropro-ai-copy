/**
 * syncUserCompanyId — Sincroniza o company_id no user.data para que o RLS funcione.
 * 
 * O RLS das entities usa user.data.company_id para filtrar por tenant.
 * O owner pode não ter esse campo se criou a conta antes da Company ser criada
 * ou se o campo foi perdido. Esta função resolve a Company via service role
 * (by-passing RLS) e salva o company_id no user.data via auth.updateMe().
 * 
 * Idempotente: se já tem company_id correto, retorna sem fazer update.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sdk = base44.asServiceRole;

    // 1) Tenta resolver a empresa como owner
    const ownerHits = await sdk.entities.Company.filter(
      { owner_email: user.email },
      '-created_date',
      1,
    );
    let company = ownerHits?.[0];
    let role = 'owner';

    // 2) Fallback: TeamMember ativo
    if (!company) {
      const tmHits = await sdk.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
      const tm = tmHits?.[0];
      if (tm?.active !== false && tm?.company_id) {
        company = await sdk.entities.Company.get(tm.company_id).catch(() => null);
        role = 'team_member';
      }
    }

    if (!company) {
      return Response.json({ synced: false, reason: 'no_company_found' });
    }

    // 3) Verifica se já está sincronizado
    if (user.company_id === company.id) {
      return Response.json({ synced: true, already_set: true, company_id: company.id, role });
    }

    // 4) Salva company_id no user.data via updateMe (opera sobre o usuário autenticado)
    await base44.auth.updateMe({ company_id: company.id });

    console.log(`[syncUserCompanyId] company_id=${company.id} salvo para ${user.email} (${role})`);

    return Response.json({
      synced: true,
      company_id: company.id,
      company_name: company.name,
      role,
    });
  } catch (error) {
    console.error('[syncUserCompanyId] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});