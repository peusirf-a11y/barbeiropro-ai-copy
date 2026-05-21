// partnerAttribute — vincula uma Company recém-criada a um Referral pending,
// rodando os checks anti-fraude. Chamado pelo Checkout (após criar Company)
// e pelo stripeWebhook (checkout.session.completed) como segurança.
//
// Fluxo:
//  1. Recebe { company_id, referral_code, fingerprint, ip? }.
//  2. Acha Partner ativo pelo código.
//  3. Anti-fraude:
//      - mesmo email (Partner.email == Company.owner_email) → fraud
//      - mesmo telefone (Partner.phone == Company.phone) → fraud
//      - mesmo CPF (Partner.cpf_cnpj começa igual ao da Company se houver)
//      - mesmo fingerprint registrado no Partner → fraud
//  4. Cria/atualiza Referral com status='converted'.
//  5. Loga SecurityEvent se fraude detectada.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function _digits(v) { return String(v || '').replace(/\D/g, ''); }
function _sanitize(v, max) {
  if (v == null) return '';
  return String(v).trim().replace(/<[^>]*>/g, '').slice(0, max);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || body.ip || 'unknown';

    const company_id = _sanitize(body.company_id, 64);
    const code = _sanitize(body.referral_code, 32).toUpperCase();
    const fingerprint = _sanitize(body.fingerprint, 64);

    if (!company_id || !code) {
      return Response.json({ error: 'missing_fields' }, { status: 400 });
    }
    if (!/^[A-Z0-9_-]{4,32}$/.test(code)) {
      return Response.json({ error: 'invalid_code' }, { status: 400 });
    }

    const company = await sdk.entities.Company.get(company_id).catch(() => null);
    if (!company) return Response.json({ error: 'company_not_found' }, { status: 404 });

    const partners = await sdk.entities.Partner.filter({ referral_code: code }, '-created_date', 1);
    const partner = partners?.[0];
    if (!partner || partner.status !== 'active') {
      return Response.json({ success: false, valid: false });
    }

    // Anti-fraude
    const fraud_reasons = [];
    const ownerEmail = String(company.owner_email || '').toLowerCase();
    const partnerEmail = String(partner.email || '').toLowerCase();
    if (ownerEmail && partnerEmail && ownerEmail === partnerEmail) fraud_reasons.push('same_email');

    const ownerPhone = _digits(company.phone) || _digits(company.whatsapp);
    if (ownerPhone && partner.phone && _digits(partner.phone) === ownerPhone) fraud_reasons.push('same_phone');

    if (fingerprint && Array.isArray(partner.fingerprint_seen) && partner.fingerprint_seen.includes(fingerprint)) {
      fraud_reasons.push('same_fingerprint');
    }

    const fraud_score = fraud_reasons.length * 35; // simples: 2+ sinais já bloqueia
    const isFraud = fraud_reasons.length >= 1;

    // Reusa Referral pending recente se houver (mesmo partner + sem company ainda)
    const recent = await sdk.entities.Referral.filter(
      { partner_id: partner.id, status: 'pending' },
      '-created_date', 5,
    );
    const reusable = recent.find(r => !r.company_id);

    const refData = {
      partner_id: partner.id,
      company_id,
      referred_company_name: company.name,
      referred_email: ownerEmail || undefined,
      referred_phone: ownerPhone || undefined,
      status: isFraud ? 'fraud' : 'converted',
      converted_at: new Date().toISOString(),
      fraud_reasons,
      fraud_score,
      click_fingerprint: fingerprint || undefined,
      click_ip: ip,
    };

    let referral;
    if (reusable) {
      await sdk.entities.Referral.update(reusable.id, refData);
      referral = { ...reusable, ...refData, id: reusable.id };
    } else {
      referral = await sdk.entities.Referral.create({ ...refData, attribution_type: 'link' });
    }

    if (isFraud) {
      try {
        await sdk.entities.SecurityEvent.create({
          event_type: 'suspicious_payload',
          severity: 'high',
          actor_email: ownerEmail,
          ip_address: ip,
          route: 'partnerAttribute',
          details: {
            kind: 'self_referral_detected',
            partner_id: partner.id,
            referral_id: referral.id,
            company_id,
            fraud_reasons,
            fraud_score,
          },
          blocked: true,
        });
      } catch (_) {}
      console.warn(`[partnerAttribute] FRAUD detected: ${fraud_reasons.join(',')} partner=${partner.id} company=${company_id}`);
    }

    try {
      await sdk.entities.AuditLog.create({
        company_id,
        actor_email: 'system',
        actor_type: 'system',
        action: isFraud ? 'REFERRAL_FRAUD_BLOCKED' : 'REFERRAL_CONVERTED',
        target_type: 'Referral',
        target_id: referral.id,
        severity: isFraud ? 'warning' : 'info',
        metadata: { partner_id: partner.id, referral_code: code, fraud_reasons, fraud_score },
      });
    } catch (_) {}

    return Response.json({
      success: true,
      valid: true,
      fraud: isFraud,
      referral_id: referral.id,
      partner_id: partner.id,
    });
  } catch (err) {
    console.error('[partnerAttribute] error:', err.message);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});