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
      const [referrals, commissions, allPartners, allCommissions] = await Promise.all([
        sdk.entities.Referral.filter({ partner_id: partner.id }, '-created_date', 500),
        sdk.entities.Commission.filter({ partner_id: partner.id }, '-created_date', 500),
        sdk.entities.Partner.filter({ status: 'active' }, '-created_date', 500),
        sdk.entities.Commission.list('-created_date', 2000),
      ]);

      const totalReferrals = referrals.length;
      const converted = referrals.filter(r => r.status === 'converted' || r.status === 'active').length;
      const activeReferrals = referrals.filter(r => r.status === 'active').length;
      const cancelled = referrals.filter(r => r.status === 'cancelled').length;
      const conversionRate = totalReferrals > 0 ? Number(((converted / totalReferrals) * 100).toFixed(1)) : 0;

      const sumByStatus = (st) => commissions
        .filter(c => c.status === st)
        .reduce((s, c) => s + (Number(c.amount) || 0), 0);

      const balance_pending = sumByStatus('pending');
      const balance_approved = sumByStatus('approved');
      const balance_paid = sumByStatus('paid');
      const total_generated = balance_pending + balance_approved + balance_paid;

      // Receita gerada para O CORTE (soma dos invoice_amount de todas comissões não canceladas)
      const revenue_for_ocorte = commissions
        .filter(c => !['cancelled', 'chargeback'].includes(c.status))
        .reduce((s, c) => s + (Number(c.invoice_amount) || 0), 0);

      // MRR estimado: 1 comissão "ativa" mais recente por referral
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

      // Evolução mensal (últimos 6 meses) — referrals criados + comissões geradas
      const now = new Date();
      const monthlyEvolution = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const monthRefs = referrals.filter(r => {
          const dt = new Date(r.created_date);
          return dt >= d && dt < next;
        });
        const monthComms = commissions.filter(c => {
          const dt = new Date(c.created_date);
          return dt >= d && dt < next && !['cancelled', 'chargeback'].includes(c.status);
        });
        monthlyEvolution.push({
          month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
          referrals: monthRefs.length,
          converted: monthRefs.filter(r => ['converted', 'active'].includes(r.status)).length,
          commissions: Number(monthComms.reduce((s, c) => s + (Number(c.amount) || 0), 0).toFixed(2)),
        });
      }

      // Ranking pessoal: posição entre parceiros ativos por total gerado
      const partnerTotals = new Map();
      allCommissions
        .filter(c => !['cancelled', 'chargeback'].includes(c.status))
        .forEach(c => {
          partnerTotals.set(c.partner_id, (partnerTotals.get(c.partner_id) || 0) + (Number(c.amount) || 0));
        });
      const ranking = Array.from(partnerTotals.entries())
        .map(([pid, total]) => ({ pid, total }))
        .sort((a, b) => b.total - a.total);
      const myRankIndex = ranking.findIndex(r => r.pid === partner.id);
      const my_rank = myRankIndex >= 0 ? myRankIndex + 1 : null;
      const total_partners = allPartners.length;

      // Meta do mês: padrão 1000 BRL (pode ser ajustado pelo Master no futuro)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const month_generated = commissions
        .filter(c => new Date(c.created_date) >= monthStart && !['cancelled', 'chargeback'].includes(c.status))
        .reduce((s, c) => s + (Number(c.amount) || 0), 0);
      const monthly_goal = Number(partner.monthly_goal || 1000);
      const goal_progress = monthly_goal > 0 ? Math.min(100, Number(((month_generated / monthly_goal) * 100).toFixed(1))) : 0;

      // Últimas indicações e comissões (top 5)
      const recent_referrals = referrals.slice(0, 5).map(r => ({
        id: r.id, status: r.status, referred_company_name: r.referred_company_name,
        created_date: r.created_date, converted_at: r.converted_at,
      }));
      const recent_commissions = commissions.slice(0, 5).map(c => ({
        id: c.id, status: c.status, amount: c.amount,
        billing_cycle: c.billing_cycle, created_date: c.created_date,
        hold_until: c.hold_until, paid_at: c.paid_at,
      }));

      return Response.json({
        success: true,
        kpis: {
          total_referrals: totalReferrals,
          converted,
          active: activeReferrals,
          cancelled,
          conversion_rate: conversionRate,
          balance_pending: Number(balance_pending.toFixed(2)),
          balance_approved: Number(balance_approved.toFixed(2)),
          balance_paid: Number(balance_paid.toFixed(2)),
          total_generated: Number(total_generated.toFixed(2)),
          mrr_estimated: Number(mrr_estimated.toFixed(2)),
          revenue_for_ocorte: Number(revenue_for_ocorte.toFixed(2)),
          my_rank, total_partners,
          monthly_goal, month_generated: Number(month_generated.toFixed(2)), goal_progress,
        },
        monthly_evolution: monthlyEvolution,
        recent_referrals,
        recent_commissions,
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