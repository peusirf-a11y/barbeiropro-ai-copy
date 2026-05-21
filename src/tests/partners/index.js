// Runner único dos testes do módulo Partners.
// Uso: import { runAll } from './tests/partners/index.js'; const r = await runAll();

import { runReferralTrackingTests } from './referralTracking.test.js';
import { runAntiFraudTests } from './antiFraud.test.js';
import { runCommissionMathTests } from './commissionMath.test.js';
import { runIdempotencyTests } from './idempotency.test.js';

export async function runAll() {
  const reports = [];
  const safeRun = async (name, fn) => {
    try {
      const r = await fn();
      reports.push({ suite: name, ...r });
    } catch (err) {
      reports.push({ suite: name, passed: 0, failed: 1, results: [{ name: 'execution', ok: false, error: err.message }] });
    }
  };

  await safeRun('referralTracking', runReferralTrackingTests);
  await safeRun('antiFraud', runAntiFraudTests);
  await safeRun('commissionMath', runCommissionMathTests);
  await safeRun('idempotency', runIdempotencyTests);

  const total = reports.reduce((s, r) => s + r.passed + r.failed, 0);
  const passed = reports.reduce((s, r) => s + r.passed, 0);
  const failed = reports.reduce((s, r) => s + r.failed, 0);

  return {
    summary: { total, passed, failed, ok: failed === 0 },
    reports,
  };
}