// Automação entity (Commission.create) → registra "first_commission" se for a primeira.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const data = body?.data;
    if (!data?.company_id) return Response.json({ success: true, skipped: 'no_company' });

    const sdk = base44.asServiceRole;
    const existing = await sdk.entities.UserEvent.filter({
      company_id: data.company_id,
      event_type: 'first_commission',
    }, '-created_date', 1);
    if (existing && existing.length > 0) return Response.json({ success: true, skipped: 'already_tracked' });

    await sdk.entities.UserEvent.create({
      company_id: data.company_id,
      event_type: 'first_commission',
      source: 'automation',
      metadata: { commission_id: data.id, amount: data.amount },
    });
    return Response.json({ success: true, tracked: true });
  } catch (error) {
    console.error('[onCommissionCreatedEvent]', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});