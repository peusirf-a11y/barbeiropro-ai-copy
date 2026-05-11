// Fecha um caixa calculando entradas/saídas no SERVIDOR (fonte da verdade).
// Frontend só envia: register_id e final_amount (saldo contado).
// Backend: busca lançamentos desde a abertura, calcula expected_amount e difference.
//
// HARDENING: RBAC inline com ordem CallerContext → fetch via serviceRole → ensureSameCompany+ensureRole.
// Erros 404 genéricos para não vazar existência de recursos cross-tenant.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// === RBAC helpers (inlined: backend functions são deploy independente) ===
class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}
async function getCallerContext(base44, user) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);
  if (user.is_super_admin) return { role: 'super_admin', is_super_admin: true, email: user.email };
  const tm = await base44.asServiceRole.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  if (tm?.length) {
    if (tm[0].active === false) throw new AuthzError('USER_INACTIVE', 403);
    return {
      role: tm[0].role,
      company_id: tm[0].company_id,
      professional_id: tm[0].professional_id || null,
      email: user.email,
      cash_permissions: tm[0].cash_permissions || null,
      unit_ids: tm[0].unit_ids || [],
    };
  }
  const co = await base44.asServiceRole.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (co?.length) return { role: 'admin', company_id: co[0].id, email: user.email, is_owner: true };
  throw new AuthzError('NO_TEAM_MEMBER', 403);
}

// Fase 4 — permissão granular + isolamento por unidade.
const ROLE_DEFAULTS_CLOSE = {
  admin: true, financeiro: true, recepcao: false, barbeiro: false,
};
function canClose(caller) {
  if (caller.is_super_admin) return true;
  const overrides = caller.cash_permissions || {};
  if (typeof overrides.close_register === 'boolean') return overrides.close_register;
  return !!ROLE_DEFAULTS_CLOSE[caller.role];
}
const CROSS_UNIT_ROLES_CLOSE = ['admin', 'financeiro', 'super_admin'];
function canAccessUnit(caller, unit_id) {
  if (caller.is_super_admin) return true;
  if (CROSS_UNIT_ROLES_CLOSE.includes(caller.role)) return true;
  const allowed = caller.unit_ids || [];
  if (!allowed.length) return true;
  if (!unit_id) return true;
  return allowed.includes(unit_id);
}
function ensureSameCompany(caller, entity) {
  if (caller.is_super_admin) return;
  if (!entity?.company_id) throw new AuthzError('ENTITY_NO_COMPANY', 400);
  if (caller.company_id !== entity.company_id) throw new AuthzError('FORBIDDEN_TENANT', 403);
}
function ensureRole(caller, allowed) {
  if (caller.is_super_admin) return;
  if (!allowed.includes(caller.role)) throw new AuthzError('FORBIDDEN_ROLE', 403);
}
function authzErrorResponse(error) {
  if (error instanceof AuthzError) return Response.json({ success: false, error: error.code }, { status: error.status });
  return null;
}
const FINANCE_ROLES = ['admin', 'financeiro'];

// 404 genérico — não distingue "não existe" de "existe em outro tenant"
function notFound() {
  return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
}
async function logBlockedAttempt(sdk, { actor_email, action, code, target_id, metadata, company_id }) {
  try {
    await sdk.entities.AuditLog.create({
      company_id: company_id || null, // P0.5: coluna nativa (null = ação de plataforma / sem tenant)
      actor_email: actor_email || 'unknown',
      action: 'BLOCKED_ATTEMPT',
      target_type: 'Function',
      target_id: action,
      metadata: { reason: code, original_target_id: target_id, ...metadata },
    });
  } catch (e) { console.warn('[logBlockedAttempt] failed:', e.message); }
}
async function ensureCompanyNotBlocked(sdk, company_id, user_email, action) {
  if (!company_id) return;
  let co;
  try { co = await sdk.entities.Company.get(company_id); } catch { return; }
  if (!co) return;
  if (co.status === 'blocked' || co.is_blocked_by_billing === true) {
    await logBlockedAttempt(sdk, { actor_email: user_email, action, code: 'COMPANY_BLOCKED', target_id: company_id, company_id });
    throw new AuthzError('COMPANY_BLOCKED', 403);
  }
}

Deno.serve(async (req) => {
  console.log('[closeCashRegister] start');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const { register_id, final_amount, notes } = await req.json().catch(() => ({}));
    if (!register_id) return Response.json({ success: false, error: 'register_id required' }, { status: 400 });
    if (typeof final_amount !== 'number' && typeof final_amount !== 'string') {
      return Response.json({ success: false, error: 'final_amount required' }, { status: 400 });
    }

    // ORDEM CORRETA: caller PRIMEIRO, depois fetch via serviceRole, depois RBAC tenant+role
    const caller = await getCallerContext(base44, user);

    let reg;
    try {
      reg = await base44.asServiceRole.entities.CashRegister.get(register_id);
    } catch (_e) {
      return notFound(); // SDK lança 404 quando id não existe — devolve genérico
    }
    if (!reg) return notFound();

    ensureSameCompany(caller, reg);
    // Capability granular (Fase 4)
    if (!canClose(caller)) {
      console.warn('[closeCashRegister] missing cap close_register', { user: user.email });
      return Response.json({ success: false, error: 'FORBIDDEN_CAP' }, { status: 403 });
    }
    // Isolamento por unidade (Fase 4)
    if (!canAccessUnit(caller, reg.unit_id)) {
      console.warn('[closeCashRegister] forbidden unit', { user: user.email, unit_id: reg.unit_id });
      return Response.json({ success: false, error: 'FORBIDDEN_UNIT' }, { status: 403 });
    }
    await ensureCompanyNotBlocked(base44.asServiceRole, reg.company_id, user.email, 'closeCashRegister');

    if (reg.status === 'fechado') {
      return Response.json({ success: false, error: 'ALREADY_CLOSED' }, { status: 400 });
    }
    if (reg.status === 'fechando') {
      // Outro operador já está fechando este caixa. Devolvemos 409.
      // WHY (P0.3): evita 2 closes paralelos sobrescreverem snapshot.
      console.warn('[closeCashRegister] register already being closed', { register_id, closing_by: reg.closing_by });
      return Response.json({
        success: false,
        error: 'ALREADY_CLOSING',
        message: 'Este caixa já está sendo fechado. Aguarde alguns segundos.',
      }, { status: 409 });
    }

    // ─── CLAIM ATÔMICO aberto → fechando (P0.3) ─────────────────────────
    // WHY: sem isso, dois operadores podem clicar "fechar" simultaneamente,
    // ou um atendimento concluir entre o cálculo dos totais e o save → entry
    // sem cash_register_id correto / snapshot desatualizado.
    //
    // Base44 não tem update condicional real, então:
    //  1. update status='fechando' + closing_started_at + closing_by
    //  2. RE-LER o registro
    //  3. Se closing_by não bate com nosso email, OUTRO operador ganhou a corrida → 409
    //
    // Janela residual: 2 updates simultâneos no mesmo ms — last-writer-wins
    // decide qual operador "ganha". Aceitável (<10ms de race).
    const claimStartedAt = new Date().toISOString();
    try {
      await base44.asServiceRole.entities.CashRegister.update(register_id, {
        status: 'fechando',
        closing_started_at: claimStartedAt,
        closing_by: user.email,
      });
    } catch (claimErr) {
      console.error('[closeCashRegister] failed to claim fechando state:', claimErr.message);
      return Response.json({ success: false, error: 'CLAIM_FAILED' }, { status: 500 });
    }

    // Re-lê para confirmar que NÓS ganhamos o claim.
    const regAfterClaim = await base44.asServiceRole.entities.CashRegister.get(register_id);
    if (regAfterClaim.status !== 'fechando' || regAfterClaim.closing_by !== user.email) {
      console.warn('[closeCashRegister] lost race to another closer', {
        register_id,
        winner: regAfterClaim.closing_by,
        loser: user.email,
      });
      return Response.json({
        success: false,
        error: 'ALREADY_CLOSING',
        message: 'Este caixa já está sendo fechado por outro operador.',
      }, { status: 409 });
    }

    // A7: query DIRETA por cash_register_id — caixa é entidade contábil,
    // não pode depender de "últimos 2000" (truncamento silencioso).
    //
    // Estratégia:
    //  1. Lançamentos com cash_register_id == register_id (caminho moderno).
    //  2. Fallback temporal SÓ para lançamentos legados (sem cash_register_id):
    //     filtramos por created_date >= opened_at no backend, não no client.
    //
    // Importante (P0.3): leitura SEMPRE depois do claim, garantindo que
    // novos lançamentos concluídos após esse ponto NÃO vão amarrar a este caixa
    // (onAppointmentConcluded filtra status='aberto').
    const direct = await base44.asServiceRole.entities.FinancialEntry.filter(
      { company_id: reg.company_id, cash_register_id: register_id },
      '-created_date',
      5000,
    );

    // Fallback para registros legados que ainda não tinham cash_register_id.
    // Janela: opened_at → now (range determinístico, sem truncamento).
    const legacy = await base44.asServiceRole.entities.FinancialEntry.filter(
      {
        company_id: reg.company_id,
        cash_register_id: null,
        created_date: { $gte: reg.opened_at },
      },
      '-created_date',
      5000,
    );

    const since = new Date(reg.opened_at);
    const entries = [...direct, ...legacy].filter(e => {
      if (e.deleted_at) return false;
      // Direct path: já filtrou por register_id no backend, só remove deleted.
      if (e.cash_register_id) return true;
      // Legacy path: confirma janela temporal + unit (defesa em profundidade).
      const matchTime = new Date(e.created_date || e.date) >= since;
      if (!matchTime) return false;
      if (!reg.unit_id) return true;
      return !e.unit_id || e.unit_id === reg.unit_id;
    });

    // Suporta entry_kind (sangria/suprimento) além do legado type.
    const kindOf = (e) => e.entry_kind || (e.type === 'saida' ? 'saida' : 'entrada');
    let totalIn = 0, totalOut = 0, totalSangria = 0, totalSuprimento = 0;

    // M2 — payment_breakdown completo (gross_in + gross_out + net por método).
    //
    // Antes: só somávamos entradas por método → relatório mostrava "Pix: R$ 500"
    //        mas se houvesse R$ 80 de saída em Pix, o líquido real era R$ 420.
    //        Operador conciliava errado, contador via números inflados.
    //
    // Agora: cada forma de pagamento guarda gross_in, gross_out e net (in - out).
    // - Sangria e suprimento NÃO entram aqui (são fluxo de caixa, não receita
    //   por forma de pagamento — já cobertos por total_sangria/total_suprimento).
    // - Lançamento sem payment_method explícito vai para a bucket '__sem_metodo'
    //   para que o total reconcilie com totalIn/totalOut (nada "some" silencioso).
    //
    // BACKWARD COMPAT: mantemos `payment_breakdown[method] = gross_in` no nível raiz
    // (mesmo formato antigo) para não quebrar componentes que já leem assim. O detalhe
    // estruturado vai em `payment_breakdown_detail` (novo).
    const payment_breakdown = {};
    const payment_breakdown_detail = {};
    const bumpMethod = (method, side, amt) => {
      const key = method || '__sem_metodo';
      if (!payment_breakdown_detail[key]) {
        payment_breakdown_detail[key] = { gross_in: 0, gross_out: 0, net: 0 };
      }
      payment_breakdown_detail[key][side] = +(payment_breakdown_detail[key][side] + amt).toFixed(2);
      payment_breakdown_detail[key].net = +(
        payment_breakdown_detail[key].gross_in - payment_breakdown_detail[key].gross_out
      ).toFixed(2);
    };

    for (const e of entries) {
      const k = kindOf(e);
      const amt = Number(e.amount) || 0;
      if (k === 'entrada') {
        totalIn += amt;
        bumpMethod(e.payment_method, 'gross_in', amt);
        if (e.payment_method) {
          payment_breakdown[e.payment_method] = +(((payment_breakdown[e.payment_method] || 0) + amt).toFixed(2));
        }
      } else if (k === 'saida') {
        totalOut += amt;
        bumpMethod(e.payment_method, 'gross_out', amt);
      } else if (k === 'sangria')    totalSangria    += amt;
      else if (k === 'suprimento')   totalSuprimento += amt;
    }
    const expected = +((reg.initial_amount || 0) + totalIn + totalSuprimento - totalOut - totalSangria).toFixed(2);
    const final = +Number(final_amount).toFixed(2);
    const difference = +(final - expected).toFixed(2);

    // Fechamento final: fechando → fechado.
    // WHY (P0.3): se este update falhar, o caixa fica preso em 'fechando' e o
    // job repairStuckCashRegisters (10min) gera SystemAlert para intervenção manual.
    let updated;
    try {
      updated = await base44.asServiceRole.entities.CashRegister.update(register_id, {
        closed_at: new Date().toISOString(),
        final_amount: final,
        expected_amount: expected,
        difference,
        total_in: +totalIn.toFixed(2),
        total_out: +totalOut.toFixed(2),
        total_sangria: +totalSangria.toFixed(2),
        total_suprimento: +totalSuprimento.toFixed(2),
        payment_breakdown,
        // M2 — estrutura completa salva em metadata (não precisa schema migration).
        // Quem consumir: relatórios de fechamento, conciliação contábil, exports.
        metadata: { ...(reg.metadata || {}), payment_breakdown_detail },
        closed_by: user.email,
        notes: [reg.notes, notes].filter(Boolean).join(' · '),
        status: 'fechado',
      });
    } catch (finalErr) {
      console.error('[closeCashRegister] FAILED at fechando→fechado transition. Register stuck.', {
        register_id, error: finalErr.message,
      });
      // Não revertemos para 'aberto' aqui — risco de novos lançamentos entrarem
      // depois do snapshot já calculado. Job de reparo decide.
      return Response.json({
        success: false,
        error: 'FINALIZE_FAILED',
        message: 'Caixa entrou em estado "fechando" mas falhou ao finalizar. Suporte foi notificado.',
      }, { status: 500 });
    }

    // AuditLog (mutation crítica)
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        company_id: reg.company_id, // P0.5: coluna nativa
        actor_email: user.email,
        actor_is_super_admin: !!caller.is_super_admin,
        action: 'CLOSE_CASH_REGISTER',
        target_type: 'CashRegister',
        target_id: register_id,
        before: { status: 'aberto', initial_amount: reg.initial_amount },
        after: { status: 'fechado', final_amount: final, expected_amount: expected, difference },
        metadata: { company_id: reg.company_id, unit_id: reg.unit_id || null, totalIn, totalOut },
      });
    } catch (auditErr) {
      console.warn('[closeCashRegister] audit log failed:', auditErr.message);
    }

    console.log('[closeCashRegister] ok', { user: user.email, company_id: reg.company_id, register_id, expected, final, difference });
    return Response.json({ success: true, register: updated, totals: { totalIn, totalOut, totalSangria, totalSuprimento, expected, final, difference, payment_breakdown, payment_breakdown_detail } });
  } catch (error) {
    const az = authzErrorResponse(error);
    if (az) {
      console.warn('[closeCashRegister] authz blocked:', error.code);
      try {
        const sdk = createClientFromRequest(req).asServiceRole;
        let u = null; try { u = await createClientFromRequest(req).auth.me(); } catch { /* noop */ }
        await logBlockedAttempt(sdk, { actor_email: u?.email, action: 'closeCashRegister', code: error.code });
      } catch (_e) { /* noop */ }
      return az;
    }
    console.error('[closeCashRegister] error:', error.message, error.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});