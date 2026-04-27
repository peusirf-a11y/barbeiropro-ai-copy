// activateCompany — Super Admin only. Reativa uma empresa e grava AuditLog.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('JOB START: activateCompany');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Unauthorized: Super Admin only' }, { status: 403 });
    }

    const { company_id } = await req.json();
    if (!company_id) {
      return Response.json({ success: false, error: 'company_id é obrigatório' }, { status: 400 });
    }

    const company = await base44.asServiceRole.entities.Company.get(company_id);
    if (!company) {
      return Response.json({ success: false, error: 'Empresa não encontrada' }, { status: 404 });
    }

    const before = { status: company.status };
    await base44.asServiceRole.entities.Company.update(company_id, { status: 'active' });
    const after = { status: 'active' };

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    await base44.asServiceRole.entities.AuditLog.create({
      actor_email: user.email,
      actor_is_super_admin: true,
      action: 'ACTIVATE_COMPANY',
      target_type: 'Company',
      target_id: company_id,
      before,
      after,
      ip,
    });

    console.log(`JOB END: activateCompany ${company_id} by ${user.email}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('JOB ERROR: activateCompany:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});