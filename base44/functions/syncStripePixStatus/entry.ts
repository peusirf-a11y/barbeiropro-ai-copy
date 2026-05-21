// syncStripePixStatus — Sincroniza explicitamente a capability `pix_payments` da
// conta Stripe Connect Express da barbearia com `Company.stripe_connect_pix_enabled`,
// registrando AuditLog quando há transição (off→on ou on→off).
//
// Por que existe separado de getConnectAccountStatus:
//  - getConnectAccountStatus faz sync silencioso (sem AuditLog) em qualquer poll.
//  - syncStripePixStatus é a fonte oficial: registra evento auditável "PIX ativado"
//    ou "PIX desativado", emite SecurityEvent em falhas e é chamado por:
//      1) botão "Atualizar status" no StripeConnectCard
//      2) job pós-onboarding
//      3) webhook account.updated (já trata inline, mas pode delegar aqui no futuro)
//
// LIMITAÇÃO STRIPE BR (documentada em docs/STRIPE_PIX_CONNECT.md):
//   - A capability `pix_payments` NÃO é "requestable" via API para Express BR.
//   - O dono da barbearia precisa ativar PIX 1 vez no Stripe Express Dashboard.
//   - Aqui apenas DETECTAMOS o status real e refletimos no Base44.
//
// Segurança:
//  - Só owner da Company ou admin do team pode chamar.
//  - Tenant isolation: company_id é validado contra o caller.
//  - Nunca expõe error.message do Stripe ao cliente — usa códigos opacos.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

function getStripeSecret() {
  const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
  if (!key) throw new Error('STRIPE_SECRET_KEY missing');
  return key;
}

async function logSecurityEvent(sdk, payload) {
  try {
    await sdk.entities.SecurityEvent.create(payload);
  } catch (err) {
    console.warn('[syncStripePixStatus] SecurityEvent failed:', err.message);
  }
}

Deno.serve(async (req) => {
  const cid = crypto.randomUUID().split('-')[0];
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const stripe = new Stripe(getStripeSecret(), { apiVersion: '2024-06-20' });
    const body = await req.json().catch(() => ({}));
    const { company_id } = body;
    if (!company_id) return Response.json({ error: 'COMPANY_ID_REQUIRED' }, { status: 400 });

    const sdk = base44.asServiceRole;

    // Tenant access check — owner ou admin do team.
    const companies = await sdk.entities.Company.filter({ id: company_id });
    if (!companies.length) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
    const company = companies[0];

    const userEmailLc = (user.email || '').toLowerCase();
    const ownerEmailLc = (company.owner_email || '').toLowerCase();
    const isOwner = ownerEmailLc && ownerEmailLc === userEmailLc;
    const teamMembers = await sdk.entities.TeamMember.filter({ company_id, email: user.email });
    const isAdmin = teamMembers[0]?.role === 'admin' || user.role === 'admin';

    if (!isOwner && !isAdmin) {
      await logSecurityEvent(sdk, {
        event_type: 'cross_tenant_attempt',
        severity: 'high',
        actor_email: user.email,
        company_id,
        route: 'syncStripePixStatus',
        details: { reason: 'not_owner_not_admin' },
        blocked: true,
        request_id: cid,
      });
      return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    if (!company.stripe_connect_account_id) {
      return Response.json({
        success: false,
        pix_enabled: false,
        reason: 'NO_CONNECT_ACCOUNT',
        message: 'Conecte sua conta Stripe primeiro.',
      });
    }

    // Consulta o estado real da conta no Stripe.
    let account;
    try {
      account = await stripe.accounts.retrieve(company.stripe_connect_account_id);
    } catch (stripeErr) {
      console.error(`[syncStripePixStatus] cid=${cid} stripe error:`, stripeErr?.message);
      const msg = stripeErr?.message || '';
      const isOrphan = stripeErr?.code === 'account_invalid' || stripeErr?.code === 'resource_missing'
        || /not connected to your platform|does not exist|Application access/i.test(msg);

      await logSecurityEvent(sdk, {
        event_type: 'invalid_token',
        severity: isOrphan ? 'critical' : 'medium',
        actor_email: user.email,
        company_id,
        route: 'syncStripePixStatus',
        details: { stripe_code: stripeErr?.code || 'unknown', orphan: isOrphan },
        blocked: false,
        request_id: cid,
      });

      return Response.json({
        success: false,
        pix_enabled: false,
        reason: isOrphan ? 'STRIPE_ACCOUNT_INVALID' : 'STRIPE_ERROR',
        message: isOrphan
          ? 'A conta Stripe Connect não está mais disponível. Reconecte para continuar.'
          : 'Não foi possível verificar o PIX agora. Tente novamente em instantes.',
      }, { status: 502 });
    }

    // Detecta o status real da capability PIX.
    const pixEnabledNow = account.capabilities?.pix_payments === 'active';
    const pixEnabledBefore = !!company.stripe_connect_pix_enabled;
    const chargesEnabled = !!account.charges_enabled;
    const payoutsEnabled = !!account.payouts_enabled;
    const connectStatus = chargesEnabled
      ? 'enabled'
      : (account.requirements?.disabled_reason ? 'disabled' : 'pending');

    // Persiste status atualizado.
    const nowISO = new Date().toISOString();
    await sdk.entities.Company.update(company.id, {
      stripe_connect_status: connectStatus,
      stripe_connect_charges_enabled: chargesEnabled,
      stripe_connect_payouts_enabled: payoutsEnabled,
      stripe_connect_pix_enabled: pixEnabledNow,
    });

    // AuditLog APENAS em transição (off→on ou on→off) — evita poluir log com no-ops.
    if (pixEnabledNow !== pixEnabledBefore) {
      const action = pixEnabledNow ? 'STRIPE_PIX_ENABLED' : 'STRIPE_PIX_DISABLED';
      try {
        await sdk.entities.AuditLog.create({
          company_id,
          actor_email: user.email,
          action,
          target_type: 'Company',
          target_id: company.id,
          before: { stripe_connect_pix_enabled: pixEnabledBefore },
          after: { stripe_connect_pix_enabled: pixEnabledNow },
          metadata: {
            connect_account_id: account.id,
            connect_status: connectStatus,
            request_id: cid,
            source: 'syncStripePixStatus',
          },
        });
      } catch (err) {
        console.warn(`[syncStripePixStatus] cid=${cid} AuditLog failed:`, err.message);
      }
    }

    console.log(`[syncStripePixStatus] cid=${cid} company=${company_id} pix=${pixEnabledNow} (was ${pixEnabledBefore})`);

    return Response.json({
      success: true,
      pix_enabled: pixEnabledNow,
      changed: pixEnabledNow !== pixEnabledBefore,
      connect_status: connectStatus,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
    });
  } catch (error) {
    console.error(`[syncStripePixStatus] cid=${cid} INTERNAL_ERROR:`, error?.message, error?.stack?.split('\n').slice(0, 3).join(' | '));
    return Response.json({ error: 'INTERNAL_ERROR', correlation_id: cid }, { status: 500 });
  }
});