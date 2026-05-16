// manageSessions — Gerenciamento de sessões do cliente final.
// Ações: list, revoke, revoke_all
//
// Usa entidade UserSession para persistir sessões device-bound.
// token_hash = SHA-256 do token (nunca o token puro).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const REQUEST_ID = () => crypto.randomUUID().split('-')[0];

async function hashToken(token) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(token));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const rid = REQUEST_ID();
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const { action, company_id, token, session_id } = body;

    if (!company_id || !token) {
      return Response.json({ error: 'company_id e token obrigatórios', request_id: rid }, { status: 400 });
    }

    // Autentica o cliente pelo token
    const customers = await sdk.entities.Customer.filter({ company_id, auth_token: token }).catch(() => []);
    const customer = customers[0];
    if (!customer) {
      return Response.json({ error: 'Sessão inválida', request_id: rid }, { status: 401 });
    }
    // Verifica expiração
    if (customer.auth_token_expires_at && new Date(customer.auth_token_expires_at) < new Date()) {
      return Response.json({ error: 'Sessão expirada', request_id: rid }, { status: 401 });
    }

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (action === 'list') {
      const sessions = await sdk.entities.UserSession.filter(
        { user_id: customer.id, company_id, is_active: true },
        '-created_at', 20
      ).catch(() => []);

      const now = new Date();
      const active = sessions.filter(s => !s.revoked_at && (!s.expires_at || new Date(s.expires_at) > now));

      // Retorna sem token_hash (campo interno)
      return Response.json({
        sessions: active.map(s => ({
          id: s.id,
          device_id: s.device_id,
          ip: s.ip ? s.ip.replace(/\.\d+$/, '.***') : '—', // mascara último octeto
          user_agent: s.user_agent?.slice(0, 100),
          created_at: s.created_at,
          last_seen_at: s.last_seen_at,
          expires_at: s.expires_at,
          risk_score: s.risk_score || 'low',
        })),
      });
    }

    // ── REVOKE (sessão individual) ────────────────────────────────────────────
    if (action === 'revoke') {
      if (!session_id) return Response.json({ error: 'session_id obrigatório', request_id: rid }, { status: 400 });
      const sessions = await sdk.entities.UserSession.filter({ id: session_id, user_id: customer.id }).catch(() => []);
      const session = sessions[0];
      if (!session) return Response.json({ error: 'Sessão não encontrada', request_id: rid }, { status: 404 });

      await sdk.entities.UserSession.update(session.id, {
        is_active: false,
        revoked_at: new Date().toISOString(),
      });

      return Response.json({ success: true });
    }

    // ── REVOKE_ALL ────────────────────────────────────────────────────────────
    if (action === 'revoke_all') {
      const sessions = await sdk.entities.UserSession.filter(
        { user_id: customer.id, company_id, is_active: true },
        '-created_at', 50
      ).catch(() => []);

      const now = new Date().toISOString();
      await Promise.all(
        sessions.map(s => sdk.entities.UserSession.update(s.id, { is_active: false, revoked_at: now }).catch(() => {}))
      );

      // Invalida o token atual também
      await sdk.entities.Customer.update(customer.id, {
        auth_token: null,
        auth_token_expires_at: null,
      }).catch(() => {});

      return Response.json({ success: true, revoked: sessions.length });
    }

    // ── HEARTBEAT (renovar last_seen_at) ──────────────────────────────────────
    if (action === 'heartbeat') {
      const tokenHash = await hashToken(token);
      const sessions = await sdk.entities.UserSession.filter(
        { user_id: customer.id, token_hash: tokenHash, is_active: true },
        '-created_at', 1
      ).catch(() => []);

      if (sessions[0]) {
        await sdk.entities.UserSession.update(sessions[0].id, {
          last_seen_at: new Date().toISOString(),
        }).catch(() => {});
      }
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Ação inválida', request_id: rid }, { status: 400 });
  } catch (error) {
    console.error(`[manageSessions] rid=${rid} error:`, error.message);
    return Response.json({ error: 'INTERNAL_ERROR', request_id: rid }, { status: 500 });
  }
});