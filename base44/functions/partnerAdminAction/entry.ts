// partnerAdminAction — endpoint MASTER (super_admin) para gestão de parceiros.
//
// Actions:
//  • list_partners         { status?, search?, cursor?, limit? }
//  • approve_partner       { partner_id }
//  • suspend_partner       { partner_id, reason? }
//  • activate_partner      { partner_id }
//  • update_partner        { partner_id, commission_percentage?, notes? }
//  • list_commissions      { status?, partner_id?, cursor?, limit? }
//  • mark_commission_paid  { commission_id, payment_reference }
//  • cancel_commission     { commission_id, reason? }
//
// Todas as ações ficam em AuditLog e exigem user.is_super_admin.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function _sanitize(v, max) {
  if (v == null) return '';
  return String(v).trim().replace(/<[^>]*>/g, '').slice(0, max);
}

async function _audit(sdk, { actor, action, target_id, target_type, before, after, metadata, severity = 'info' }) {
  try {
    await sdk.entities.AuditLog.create({
      actor_email: actor, actor_type: 'user', action, target_type, target_id,
      before, after, metadata, severity,
    });
  } catch (err) { console.warn('[partnerAdminAction] audit failed:', err.message); }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (!user.is_super_admin) {
      return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    if (action === 'kpis') {
      // KPIs globais do programa: parceiros por status, comissões a pagar/pagas mês,
      // indicações convertidas no mês corrente.
      // IMPORTANTE: a entidade Commission é compartilhada entre dois domínios —
      // (1) programa de parceiros/afiliados (tem partner_id) e
      // (2) comissão interna de barbeiro por atendimento (tem professional_id, sem partner_id).
      // Aqui só nos interessam as do programa de parceiros → filtramos por partner_id existir.
      const [partners, allCommissions, referrals] = await Promise.all([
        sdk.entities.Partner.list('-created_date', 500),
        sdk.entities.Commission.list('-created_date', 1000),
        sdk.entities.Referral.list('-created_date', 1000),
      ]);
      const commissions = allCommissions.filter(c => !!c.partner_id);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const inThisMonth = (iso) => iso && new Date(iso) >= monthStart;

      const partnersActive = partners.filter(p => p.status === 'active').length;
      const partnersPending = partners.filter(p => p.status === 'pending').length;
      const partnersSuspended = partners.filter(p => p.status === 'suspended').length;

      const commissionsHold = commissions.filter(c => c.status === 'pending');
      const commissionsApproved = commissions.filter(c => c.status === 'approved');
      const commissionsPaidMonth = commissions.filter(c => c.status === 'paid' && inThisMonth(c.paid_at));

      const sum = (arr) => arr.reduce((s, c) => s + (Number(c.amount) || 0), 0);

      const referralsConvertedMonth = referrals.filter(r =>
        ['converted', 'active'].includes(r.status) && inThisMonth(r.converted_at || r.created_date)
      ).length;

      return Response.json({
        success: true,
        kpis: {
          partners_active: partnersActive,
          partners_pending: partnersPending,
          partners_suspended: partnersSuspended,
          commissions_hold_count: commissionsHold.length,
          commissions_hold_amount: sum(commissionsHold),
          commissions_to_pay_count: commissionsApproved.length,
          commissions_to_pay_amount: sum(commissionsApproved),
          commissions_paid_month_count: commissionsPaidMonth.length,
          commissions_paid_month_amount: sum(commissionsPaidMonth),
          referrals_converted_month: referralsConvertedMonth,
        },
      });
    }

    if (action === 'partner_detail') {
      // Detalhe completo de um parceiro: dados + métricas agregadas.
      const id = _sanitize(body.partner_id, 64);
      const partner = await sdk.entities.Partner.get(id).catch(() => null);
      if (!partner) return Response.json({ error: 'not_found' }, { status: 404 });
      const [referrals, commissions] = await Promise.all([
        sdk.entities.Referral.filter({ partner_id: id }, '-created_date', 500),
        sdk.entities.Commission.filter({ partner_id: id }, '-created_date', 500),
      ]);
      const sum = (arr) => arr.reduce((s, c) => s + (Number(c.amount) || 0), 0);
      const summary = {
        referrals_total: referrals.length,
        referrals_converted: referrals.filter(r => ['converted', 'active'].includes(r.status)).length,
        referrals_active: referrals.filter(r => r.status === 'active').length,
        referrals_fraud: referrals.filter(r => r.status === 'fraud').length,
        commissions_total_count: commissions.length,
        commissions_hold_amount: sum(commissions.filter(c => c.status === 'pending')),
        commissions_to_pay_amount: sum(commissions.filter(c => c.status === 'approved')),
        commissions_paid_amount: sum(commissions.filter(c => c.status === 'paid')),
      };
      return Response.json({
        success: true,
        partner: {
          id: partner.id, name: partner.name, email: partner.email, phone: partner.phone,
          cpf_cnpj: partner.cpf_cnpj, pix_key: partner.pix_key,
          referral_code: partner.referral_code, status: partner.status,
          commission_percentage: partner.commission_percentage,
          approved_at: partner.approved_at, approved_by: partner.approved_by,
          suspended_at: partner.suspended_at, suspended_by: partner.suspended_by,
          suspension_reason: partner.suspension_reason,
          created_date: partner.created_date, notes: partner.notes,
        },
        summary,
        referrals: referrals.slice(0, 100),
        commissions: commissions.slice(0, 100),
      });
    }

    if (action === 'list_partners') {
      const limit = Math.min(parseInt(body.limit, 10) || 50, 200);
      const filter = {};
      if (body.status) filter.status = body.status;
      let partners = await sdk.entities.Partner.filter(filter, '-created_date', limit);
      const search = _sanitize(body.search, 100).toLowerCase();
      if (search) {
        partners = partners.filter(p =>
          (p.name || '').toLowerCase().includes(search) ||
          (p.email || '').toLowerCase().includes(search) ||
          (p.referral_code || '').toLowerCase().includes(search),
        );
      }
      const sanitized = partners.map(p => ({
        id: p.id, name: p.name, email: p.email, phone: p.phone,
        cpf_cnpj: p.cpf_cnpj, pix_key: p.pix_key,
        referral_code: p.referral_code, status: p.status,
        commission_percentage: p.commission_percentage,
        approved_at: p.approved_at, approved_by: p.approved_by,
        created_date: p.created_date, notes: p.notes,
      }));
      return Response.json({ success: true, partners: sanitized });
    }

    if (action === 'approve_partner') {
      const id = _sanitize(body.partner_id, 64);
      const partner = await sdk.entities.Partner.get(id).catch(() => null);
      if (!partner) return Response.json({ error: 'not_found' }, { status: 404 });
      if (partner.status === 'active') return Response.json({ success: true, already_active: true });
      const before = { status: partner.status };
      await sdk.entities.Partner.update(id, {
        status: 'active',
        approved_at: new Date().toISOString(),
        approved_by: user.email,
        suspended_at: null, suspended_by: null, suspension_reason: null,
      });
      await _audit(sdk, { actor: user.email, action: 'PARTNER_APPROVED', target_id: id, target_type: 'Partner', before, after: { status: 'active' } });

      // Email best-effort
      try {
        const appUrl = Deno.env.get('APP_URL') || 'https://ocorte.base44.app';
        await sdk.functions.invoke('sendAuditedEmail', {
          to: partner.email,
          subject: 'Seu cadastro de parceiro foi aprovado! 🎉',
          body: `<p>Olá ${partner.name},</p><p>Seu cadastro foi aprovado. Seu código de indicação é <b>${partner.referral_code}</b>.</p><p>Link de indicação:</p><p><a href="${appUrl}/?ref=${partner.referral_code}">${appUrl}/?ref=${partner.referral_code}</a></p><p>Acesse seu painel:</p><p><a href="${appUrl}/parceiro" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Painel de Parceiros</a></p>`,
          from_name: 'O CORTE', type: 'partner_approved',
        });
      } catch (_) {}

      return Response.json({ success: true });
    }

    if (action === 'suspend_partner') {
      const id = _sanitize(body.partner_id, 64);
      const partner = await sdk.entities.Partner.get(id).catch(() => null);
      if (!partner) return Response.json({ error: 'not_found' }, { status: 404 });
      const reason = _sanitize(body.reason, 300);
      const before = { status: partner.status };
      await sdk.entities.Partner.update(id, {
        status: 'suspended',
        suspended_at: new Date().toISOString(),
        suspended_by: user.email,
        suspension_reason: reason || 'Sem motivo informado',
        auth_token: null, magic_token: null,
      });
      await _audit(sdk, { actor: user.email, action: 'PARTNER_SUSPENDED', target_id: id, target_type: 'Partner', before, after: { status: 'suspended', reason }, severity: 'warning' });
      return Response.json({ success: true });
    }

    if (action === 'activate_partner') {
      const id = _sanitize(body.partner_id, 64);
      await sdk.entities.Partner.update(id, {
        status: 'active', suspended_at: null, suspended_by: null, suspension_reason: null,
      });
      await _audit(sdk, { actor: user.email, action: 'PARTNER_REACTIVATED', target_id: id, target_type: 'Partner' });
      return Response.json({ success: true });
    }

    if (action === 'update_partner') {
      const id = _sanitize(body.partner_id, 64);
      const partner = await sdk.entities.Partner.get(id).catch(() => null);
      if (!partner) return Response.json({ error: 'not_found' }, { status: 404 });
      const patch = {};
      if (body.commission_percentage !== undefined) {
        const pct = Number(body.commission_percentage);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
          return Response.json({ error: 'invalid_percentage' }, { status: 400 });
        }
        patch.commission_percentage = pct;
      }
      if (body.notes !== undefined) patch.notes = _sanitize(body.notes, 1000);
      if (Object.keys(patch).length === 0) return Response.json({ success: true });
      const before = { commission_percentage: partner.commission_percentage, notes: partner.notes };
      await sdk.entities.Partner.update(id, patch);
      await _audit(sdk, { actor: user.email, action: 'PARTNER_UPDATED', target_id: id, target_type: 'Partner', before, after: patch });
      return Response.json({ success: true });
    }

    if (action === 'list_commissions') {
      const limit = Math.min(parseInt(body.limit, 10) || 50, 200);
      const filter = {};
      if (body.status) filter.status = body.status;
      if (body.partner_id) filter.partner_id = body.partner_id;
      // Defesa: Commission é compartilhada com comissões internas de barbeiro
      // (que usam professional_id e não partner_id). Aqui só queremos as do
      // programa de afiliados. Buscamos um pouco mais e filtramos pós-query.
      const raw = await sdk.entities.Commission.filter(filter, '-created_date', Math.max(limit * 2, 200));
      const commissions = raw.filter(c => !!c.partner_id).slice(0, limit);
      return Response.json({ success: true, commissions });
    }

    if (action === 'list_referrals') {
      const limit = Math.min(parseInt(body.limit, 10) || 50, 200);
      const filter = {};
      if (body.partner_id) filter.partner_id = body.partner_id;
      if (body.status) filter.status = body.status;
      const referrals = await sdk.entities.Referral.filter(filter, '-created_date', limit);
      return Response.json({ success: true, referrals });
    }

    if (action === 'mark_commission_paid') {
      const id = _sanitize(body.commission_id, 64);
      const ref = _sanitize(body.payment_reference, 100);
      const c = await sdk.entities.Commission.get(id).catch(() => null);
      if (!c) return Response.json({ error: 'not_found' }, { status: 404 });
      if (c.status !== 'approved') {
        return Response.json({ error: 'not_approved', message: 'Comissão precisa estar aprovada antes de marcar como paga.' }, { status: 400 });
      }
      await sdk.entities.Commission.update(id, {
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: user.email,
        payment_reference: ref || undefined,
      });
      await _audit(sdk, { actor: user.email, action: 'COMMISSION_PAID', target_id: id, target_type: 'Commission', before: { status: c.status }, after: { status: 'paid', payment_reference: ref } });
      return Response.json({ success: true });
    }

    if (action === 'cancel_commission') {
      const id = _sanitize(body.commission_id, 64);
      const c = await sdk.entities.Commission.get(id).catch(() => null);
      if (!c) return Response.json({ error: 'not_found' }, { status: 404 });
      const reason = _sanitize(body.reason, 300) || 'manual_master';
      await sdk.entities.Commission.update(id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      });
      await _audit(sdk, { actor: user.email, action: 'COMMISSION_CANCELLED', target_id: id, target_type: 'Commission', before: { status: c.status }, after: { status: 'cancelled', reason }, severity: 'warning' });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err) {
    console.error('[partnerAdminAction] error:', err.message);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});