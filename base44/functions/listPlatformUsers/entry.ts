// listPlatformUsers — devolve apenas usuários "vivos" da plataforma:
// 1. Super admins (sempre aparecem — são donos da operação O CORTE)
// 2. Usuários com Company ativa (owner_email vinculado)
// 3. Usuários com BarberCredential ativa
//
// Users órfãos (Company deletada e sem credencial) são filtrados para não
// poluírem a tela com fantasmas. A plataforma Base44 não apaga o User
// quando a Company é removida — esse cruzamento é responsabilidade nossa.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [users, companies, creds] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 500),
      base44.asServiceRole.entities.Company.list('-created_date', 2000).catch(() => []),
      base44.asServiceRole.entities.BarberCredential.list('-created_date', 2000).catch(() => []),
    ]);

    const norm = (e) => String(e || '').toLowerCase().trim();
    const emailsWithCompany = new Set(companies.map(c => norm(c.owner_email)).filter(Boolean));
    const emailsWithCred = new Set(creds.map(c => norm(c.email)).filter(Boolean));

    const activeUsers = users.filter(u => {
      if (u.is_super_admin) return true;
      const email = norm(u.email);
      if (!email) return false;
      return emailsWithCompany.has(email) || emailsWithCred.has(email);
    });

    return Response.json({
      users: activeUsers,
      stats: {
        total: users.length,
        active: activeUsers.length,
        orphans_hidden: users.length - activeUsers.length,
      },
    });
  } catch (error) {
    console.error('[listPlatformUsers]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});