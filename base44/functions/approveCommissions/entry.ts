// approveCommissions — job scheduled (1x/dia) que aprova comissões pending
// cujo hold_until já passou. Roda também checks finais antes de aprovar:
//   • Referral não pode estar status='cancelled' ou 'fraud'.
//   • Company ainda precisa ter assinatura ativa (subscription_status='active'|'trialing').
//
// Idempotente: comissões já approved/paid/cancelled são ignoradas.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    // Permite execução pelo scheduler (sem user) ou admin manual.
    if (user && !user.is_super_admin && user.role !== 'admin') {
      return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    const sdk = base44.asServiceRole;
    const nowISO = new Date().toISOString();

    const pending = await sdk.entities.Commission.filter({ status: 'pending' }, '-created_date', 300);
    const eligible = pending.filter(c => c.hold_until && c.hold_until <= nowISO);

    let approved = 0;
    let cancelled = 0;
    for (const c of eligible) {
      try {
        // Re-check referral + company antes de aprovar
        const ref = await sdk.entities.Referral.get(c.referral_id).catch(() => null);
        if (!ref || ref.status === 'fraud' || ref.status === 'cancelled') {
          await sdk.entities.Commission.update(c.id, {
            status: 'cancelled',
            cancelled_at: nowISO,
            cancellation_reason: ref?.status === 'fraud' ? 'auto_indicacao' : 'churn_rapido',
          });
          cancelled++;
          continue;
        }
        const co = await sdk.entities.Company.get(c.company_id).catch(() => null);
        if (!co || !['active', 'trialing'].includes(co.subscription_status)) {
          // Barbearia já não está mais ativa — cancela.
          await sdk.entities.Commission.update(c.id, {
            status: 'cancelled',
            cancelled_at: nowISO,
            cancellation_reason: 'company_inactive',
          });
          cancelled++;
          continue;
        }
        await sdk.entities.Commission.update(c.id, {
          status: 'approved',
          approved_at: nowISO,
        });
        approved++;
      } catch (err) {
        console.error('[approveCommissions] failed for', c.id, err.message);
      }
    }

    console.log(`[approveCommissions] eligible=${eligible.length} approved=${approved} cancelled=${cancelled}`);
    return Response.json({ success: true, checked: pending.length, approved, cancelled });
  } catch (err) {
    console.error('[approveCommissions] error:', err.message);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});