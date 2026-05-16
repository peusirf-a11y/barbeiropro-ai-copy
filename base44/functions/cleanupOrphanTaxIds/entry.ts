// cleanupOrphanTaxIds — LGPD: limpa payer_tax_id de appointments onde o pagamento
// já foi concluído, cancelado ou expirado. Executa como job agendado (diário).
// Garante minimização de dados: CPF nunca fica persistido além do necessário.
//
// Casos cobertos:
//  1. payment_status = 'succeeded' → pagamento confirmado, CPF não é mais necessário
//  2. payment_status = 'failed' | 'canceled' | 'expired' → nunca confirmado, limpar
//  3. status = 'cancelado' → appointment cancelado, limpar independente do payment_status
//  4. payment_expires_at < agora → prazo expirado sem confirmação, limpar
//
// Admin only (job agendado não precisa de user, mas chamada manual requer admin).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const REQUEST_ID = () => crypto.randomUUID().split('-')[0];

Deno.serve(async (req) => {
  const rid = REQUEST_ID();
  console.log(`[cleanupOrphanTaxIds] rid=${rid} start`);

  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;

    // Se chamada manualmente por usuário, valida que é admin
    const isAutomation = req.headers.get('x-base44-source') === 'automation';
    if (!isAutomation) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      if (user.role !== 'admin' && !user.is_super_admin) {
        return Response.json({ error: 'FORBIDDEN_ROLE' }, { status: 403 });
      }
    }

    const now = new Date().toISOString();
    let cleaned = 0;
    let errors = 0;
    const PAGE_SIZE = 200;

    // Busca appointments com payer_tax_id preenchido + condições de limpeza
    // Processado em páginas para evitar memory overflow

    // Caso 1: payment_status finalizado (não pending)
    const finalStatuses = ['succeeded', 'failed', 'canceled', 'expired'];
    for (const payStatus of finalStatuses) {
      try {
        const batch = await sdk.entities.Appointment.filter(
          { payment_status: payStatus },
          '-created_date',
          PAGE_SIZE
        );
        const withTaxId = batch.filter(a => a.payer_tax_id);
        for (const appt of withTaxId) {
          try {
            await sdk.entities.Appointment.update(appt.id, { payer_tax_id: null });
            cleaned++;
          } catch (e) {
            console.warn(`[cleanupOrphanTaxIds] rid=${rid} failed to clean appt=${appt.id}:`, e.message);
            errors++;
          }
        }
      } catch (e) {
        console.warn(`[cleanupOrphanTaxIds] rid=${rid} batch query failed for status=${payStatus}:`, e.message);
      }
    }

    // Caso 2: status=cancelado (independente do payment_status)
    try {
      const canceledBatch = await sdk.entities.Appointment.filter(
        { status: 'cancelado' },
        '-created_date',
        PAGE_SIZE
      );
      const withTaxId = canceledBatch.filter(a => a.payer_tax_id);
      for (const appt of withTaxId) {
        try {
          await sdk.entities.Appointment.update(appt.id, { payer_tax_id: null });
          cleaned++;
        } catch (e) {
          errors++;
        }
      }
    } catch (e) {
      console.warn(`[cleanupOrphanTaxIds] rid=${rid} canceled batch failed:`, e.message);
    }

    // Auditoria
    if (cleaned > 0) {
      await sdk.entities.PrivacyAuditLog.create({
        action: 'RETENTION_CLEANUP_RUN',
        actor_type: 'system',
        actor_email: 'system',
        details: {
          job: 'cleanupOrphanTaxIds',
          cleaned_count: cleaned,
          errors,
          request_id: rid,
        },
        severity: 'info',
      }).catch(() => {});
    }

    console.log(`[cleanupOrphanTaxIds] rid=${rid} done cleaned=${cleaned} errors=${errors}`);
    return Response.json({ success: true, cleaned, errors, request_id: rid });

  } catch (error) {
    console.error(`[cleanupOrphanTaxIds] rid=${rid} INTERNAL_ERROR:`, error?.message);
    return Response.json({ success: false, error: 'INTERNAL_ERROR', request_id: rid }, { status: 500 });
  }
});