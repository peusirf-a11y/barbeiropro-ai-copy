// repairStuckCashRegisters — job de reparo do P0.3.
//
// CONTEXTO (ver docs/RACE_CONDITIONS.md §3):
// closeCashRegister usa estado intermediário 'fechando' para evitar race
// entre snapshot e novos lançamentos. Se o backend crashar entre os passos
// "claim → snapshot → finalize", o caixa fica preso em 'fechando'.
//
// ESTE JOB:
//  - Roda a cada 10 minutos.
//  - Procura CashRegister com status='fechando' há mais de STUCK_THRESHOLD_MIN.
//  - NÃO faz rollback automático (auto-revert poderia perder dados).
//  - Cria SystemAlert severity=warning para intervenção manual no painel master.
//
// FILOSOFIA: detect, alert, never auto-fix. Caixa é dinheiro real.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STUCK_THRESHOLD_MIN_DEFAULT = 5;

function _threshold() {
  const n = parseInt(Deno.env.get('STUCK_REGISTER_THRESHOLD_MIN') || '', 10);
  return Number.isFinite(n) && n > 0 ? n : STUCK_THRESHOLD_MIN_DEFAULT;
}

Deno.serve(async (req) => {
  console.log('[repairStuckCashRegisters] start');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    // Admin-only / job automation guard. trackEvent automation usa serviceRole token interno,
    // mas se chamarem manualmente, exigimos admin.
    if (user && user.role !== 'admin' && !user.is_super_admin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sdk = base44.asServiceRole;
    const thresholdMin = _threshold();
    const cutoff = new Date(Date.now() - thresholdMin * 60 * 1000).toISOString();

    // Pega TODOS os caixas em 'fechando' (geralmente são pouquíssimos).
    // WHY: não filtra por created_date — fechando é estado raro e curto, lista
    // inteira é trivial.
    const fechando = await sdk.entities.CashRegister.filter(
      { status: 'fechando' },
      '-closing_started_at',
      200,
    );

    const stuck = fechando.filter(r => {
      const started = r.closing_started_at || r.opened_at;
      return started && started < cutoff;
    });

    console.log('[repairStuckCashRegisters] found', { total_fechando: fechando.length, stuck_count: stuck.length, threshold_min: thresholdMin });

    const alerts = [];
    for (const reg of stuck) {
      // Idempotência: se já existe SystemAlert recente (últimas 24h) pra esse register, não duplica.
      const recentAlerts = await sdk.entities.SystemAlert.filter(
        { type: 'critical_error', company_id: reg.company_id, read: false },
        '-created_date',
        50,
      );
      const dup = recentAlerts.find(a => a.metadata?.register_id === reg.id);
      if (dup) {
        console.log('[repairStuckCashRegisters] alert already exists for', reg.id);
        continue;
      }

      const stuckMinutes = Math.floor((Date.now() - new Date(reg.closing_started_at || reg.opened_at).getTime()) / 60000);
      try {
        const alert = await sdk.entities.SystemAlert.create({
          type: 'critical_error',
          severity: 'warning',
          message: `Caixa preso em "fechando" há ${stuckMinutes}min. Intervenção manual necessária.`,
          company_id: reg.company_id,
          metadata: {
            register_id: reg.id,
            unit_id: reg.unit_id || null,
            closing_by: reg.closing_by || null,
            closing_started_at: reg.closing_started_at || null,
            stuck_minutes: stuckMinutes,
            kind: 'stuck_cash_register',
          },
        });
        alerts.push(alert.id);
      } catch (err) {
        console.error('[repairStuckCashRegisters] failed to create alert:', err.message);
      }
    }

    return Response.json({
      success: true,
      checked: fechando.length,
      stuck: stuck.length,
      alerts_created: alerts.length,
      threshold_min: thresholdMin,
    });
  } catch (error) {
    console.error('[repairStuckCashRegisters] error:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});