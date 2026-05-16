/**
 * purgeExpiredSessions — Job de limpeza de sessões, tokens e logs expirados.
 * 
 * Executa:
 *  - Remoção de UserSession expiradas
 *  - Limpeza de SecurityRateLimit com window_end no passado
 *  - Limpeza de SecurityEvent com mais de 90 dias
 *  - Limpeza de tokens de reset expirados nos Customers
 * 
 * Deve rodar como scheduled automation (ex: diariamente às 3h).
 * ADMIN ONLY.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const results = {
      sessions_purged: 0,
      rate_limits_purged: 0,
      security_events_purged: 0,
      reset_tokens_cleared: 0,
    };

    // 1) Purge expired UserSessions
    const expiredSessions = await base44.asServiceRole.entities.UserSession.filter(
      { is_active: true, expires_at: { $lt: now.toISOString() } },
      '-created_date',
      500
    );
    
    for (const session of expiredSessions) {
      await base44.asServiceRole.entities.UserSession.update(session.id, {
        is_active: false,
        revoked_at: now.toISOString(),
      });
      results.sessions_purged++;
    }

    // 2) Purge old SecurityRateLimit records (window_end < now)
    const oldRateLimits = await base44.asServiceRole.entities.SecurityRateLimit.filter(
      { window_end: { $lt: thirtyDaysAgo } },
      '-created_date',
      500
    );
    
    for (const rl of oldRateLimits) {
      await base44.asServiceRole.entities.SecurityRateLimit.delete(rl.id);
      results.rate_limits_purged++;
    }

    // 3) Purge old SecurityEvents (> 90 days)
    const oldEvents = await base44.asServiceRole.entities.SecurityEvent.filter(
      { created_date: { $lt: ninetyDaysAgo } },
      'created_date',
      500
    );
    
    for (const ev of oldEvents) {
      await base44.asServiceRole.entities.SecurityEvent.delete(ev.id);
      results.security_events_purged++;
    }

    // 4) Clear expired reset_tokens on Customers
    const customersWithExpiredTokens = await base44.asServiceRole.entities.Customer.filter(
      { reset_token_expires_at: { $lt: now.toISOString() }, reset_token: { $exists: true } },
      'created_date',
      500
    );
    
    for (const customer of customersWithExpiredTokens) {
      if (customer.reset_token) {
        await base44.asServiceRole.entities.Customer.update(customer.id, {
          reset_token: null,
          reset_token_expires_at: null,
        });
        results.reset_tokens_cleared++;
      }
    }

    console.log('[purgeExpiredSessions] Results:', results);

    // Log the cleanup
    await base44.asServiceRole.entities.AdminAuditLog.create({
      actor: 'system',
      actor_role: 'system',
      action: 'LGPD_ACTION',
      severity: 'info',
      metadata: { job: 'purgeExpiredSessions', results },
    });

    return Response.json({ success: true, results });
  } catch (error) {
    console.error('[purgeExpiredSessions] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});