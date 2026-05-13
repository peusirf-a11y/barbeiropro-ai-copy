// getPublicBookingData — endpoint PÚBLICO (sem auth) usado pelo PublicBooking
// para buscar serviços, profissionais e unidades de uma barbearia via slug ou company_id.
// Usa asServiceRole para bypassar RLS sem expor dados sensíveis.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { company_id } = body;

    if (!company_id) {
      return Response.json({ error: 'company_id required' }, { status: 400 });
    }

    const [services, professionals, units] = await Promise.all([
      sdk.entities.Service.filter({ company_id, active: true }, 'name', 200),
      sdk.entities.Professional.filter({ company_id, active: true }, 'name', 100),
      sdk.entities.Unit.filter({ company_id, active: true }, 'sort_order', 50),
    ]);

    return Response.json({ services, professionals, units });
  } catch (error) {
    console.error('[getPublicBookingData] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});