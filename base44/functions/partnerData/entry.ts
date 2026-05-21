// partnerData — endpoint do painel do PARCEIRO (autenticado via partnerAuth token).
//
// Actions:
//  • dashboard       → KPIs (total_referrals, converted, active, MRR estimado, balances)
//  • my_referrals    → lista de indicações do parceiro
//  • my_commissions  → histórico de comissões (todos status)
//
// Tudo escopado pelo partner_id derivado do auth_token (sem permitir override).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function _sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function _authenticate(sdk, token) {
  if (!token) return null;
  const hash = await _sha256(token);
  const list = await sdk.entities.Partner.filter({ auth_token: hash }, '-created_date', 1);
  const p = list?.[0];
  if (!p) return null;
  if (!p.auth_token_expires_at || new Date(p.auth_token_expires_at) < new Date()) return null;
  if (p.status === 'suspended') return null;
  return p;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || '').trim();
    const partner = await _authenticate(sdk, token);
    if (!partner) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const action = String(body.action || '');

    if (action === 'dashboard') {
      const [referrals, commissions] = await Promise.all([
        sdk.entities.Referral.filter({ partner_id: partner.id }, '-created_date', 500),
        sdk.entities.Commission.filter({ partner_id: partner.id }, '-created_date', 500),
      ]);

      const totalReferrals = referrals.length;
      const converted = referrals.filter(r => r.status === 'converted' || r.status === 'active').length;
      const activeReferrals = referrals.filter(r => r.status === 'active').length;
      const cancelled = referrals.filter(r => r.status === 'cancelled').length;

      const sumByStatus = (st) => commissions
        .filter(c => c.status === st)
        .reduce((s, c) => s + (Number(c.amount) || 0), 0);

      const balance_pending = sumByStatus('pending');
      const balance_approved = sumByStatus('approved');
      const balance_paid = sumByStatus('paid');

      // MRR estimado: soma do amount/billing_cycle das comissões active no último ciclo.
      // Aproximação: soma de amounts das últimas comissões approved+paid por referral_id (1 por barbearia).
      const latestByReferral = new Map();
      commissions
        .filter(c => ['approved', 'paid', 'pending'].includes(c.status))
        .forEach(c => {
          const existing = latestByReferral.get(c.referral_id);
          if (!existing || new Date(c.created_date) > new Date(existing.created_date)) {
            latestByReferral.set(c.referral_id, c);
          }
        });
      const mrr_estimated = Array.from(latestByReferral.values()).reduce((s, c) => s + (Number(c.amount) || 0), 0);

      return Response.json({
        success: true,
        kpis: {
          total_referrals: totalReferrals,
          converted,
          active: activeReferrals,
          cancelled,
          balance_pending: Number(balance_pending.toFixed(2)),
          balance_approved: Number(balance_approved.toFixed(2)),
          balance_paid: Number(balance_paid.toFixed(2)),
          mrr_estimated: Number(mrr_estimated.toFixed(2)),
        },
        partner: {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          referral_code: partner.referral_code,
          commission_percentage: partner.commission_percentage,
        },
      });
    }

    if (action === 'my_referrals') {
      const limit = Math.min(parseInt(body.limit, 10) || 50, 200);
      const filter = { partner_id: partner.id };
      if (body.status) filter.status = body.status;
      const referrals = await sdk.entities.Referral.filter(filter, '-created_date', limit);
      const sanitized = referrals.map(r => ({
        id: r.id, status: r.status, attribution_type: r.attribution_type,
        referred_company_name: r.referred_company_name,
        created_date: r.created_date, converted_at: r.converted_at,
        first_payment_at: r.first_payment_at, churned_at: r.churned_at,
      }));
      return Response.json({ success: true, referrals: sanitized });
    }

    if (action === 'my_commissions') {
      const limit = Math.min(parseInt(body.limit, 10) || 50, 200);
      const filter = { partner_id: partner.id };
      if (body.status) filter.status = body.status;
      const commissions = await sdk.entities.Commission.filter(filter, '-created_date', limit);
      const sanitized = commissions.map(c => ({
        id: c.id, status: c.status, amount: c.amount,
        commission_percentage: c.commission_percentage,
        invoice_amount: c.invoice_amount,
        billing_cycle: c.billing_cycle,
        hold_until: c.hold_until,
        approved_at: c.approved_at, paid_at: c.paid_at,
        created_date: c.created_date,
        cancellation_reason: c.cancellation_reason,
      }));
      return Response.json({ success: true, commissions: sanitized });
    }

    return Response.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err) {
    console.error('[partnerData] error:', err.message);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});