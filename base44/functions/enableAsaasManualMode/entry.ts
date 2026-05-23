// enableAsaasManualMode — Modo híbrido Asaas (PF/CPF)
//
// Asaas não permite criar subaccount para Pessoa Física (CPF apenas).
// Para essas barbearias, ativamos o modo manual:
//   - asaas_split_mode = 'manual'
//   - asaas_subaccount_status = 'not_available_pf'
//   - asaas_pix_enabled = true
// Pagamentos PIX e cartão continuam funcionando (recebimento na conta master O CORTE)
// e o repasse à barbearia é feito manualmente (PIX semanal/mensal).
//
// Auth: admin/owner da Company.
// Idempotente: se já está ativo no modo manual, retorna estado atual sem alteração.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function digitsOnly(v) { return String(v || '').replace(/\D+/g, ''); }

Deno.serve(async (req) => {
  const corrId = crypto.randomUUID().split('-')[0];
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { company_id, cpf_cnpj } = body;
    if (!company_id) return Response.json({ error: 'company_id_required' }, { status: 400 });

    const company = await sdk.entities.Company.get(company_id).catch(() => null);
    if (!company) return Response.json({ error: 'company_not_found' }, { status: 404 });

    const isOwner = company.owner_email === user.email;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      await sdk.entities.SecurityEvent.create({
        event_type: 'cross_tenant_attempt', severity: 'high',
        company_id, actor_email: user.email,
        route: 'enableAsaasManualMode',
        details: { reason: 'not_owner' }, blocked: true,
      }).catch(() => {});
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    // Bloqueia se já tem subaccount automática ativa
    if (company.asaas_subaccount_id && company.asaas_subaccount_status === 'active') {
      return Response.json({
        error: 'already_automatic',
        message: 'Esta conta já está em modo automático (split). Não é possível trocar para manual.',
      }, { status: 409 });
    }

    // Valida CPF (deve ter 11 dígitos — modo manual é exclusivo de PF)
    const cpfNorm = digitsOnly(cpf_cnpj || company.owner_cpf_cnpj);
    if (cpfNorm.length !== 11) {
      return Response.json({
        error: 'cpf_required',
        message: 'Informe um CPF válido (11 dígitos). Para CNPJ, use a ativação automática com split.',
      }, { status: 400 });
    }

    const updates = {
      owner_cpf_cnpj: cpfNorm,
      asaas_split_mode: 'manual',
      asaas_subaccount_status: 'not_available_pf',
      asaas_pix_enabled: true,
      asaas_split_percentage: 100,
    };

    await sdk.entities.Company.update(company.id, updates);

    // Audit log
    await sdk.entities.AdminAuditLog.create({
      actor: user.email,
      actor_role: isAdmin ? 'admin' : 'admin',
      company_id,
      target_entity: 'Company', target_id: company.id,
      action: 'STRIPE_CONNECTED',
      after: { asaas_split_mode: 'manual', asaas_subaccount_status: 'not_available_pf' },
      severity: 'info',
      metadata: {
        provider: 'asaas',
        event: 'asaas_manual_mode_enabled',
        document_type: 'cpf',
        activation_source: 'app_pagamentos',
      },
    }).catch(() => {});

    console.log('[enableAsaasManualMode] ok', { corrId, company_id, mode: 'manual', doc: 'cpf' });

    return Response.json({
      ok: true,
      asaas_split_mode: 'manual',
      asaas_subaccount_status: 'not_available_pf',
      asaas_pix_enabled: true,
    });
  } catch (err) {
    console.error('[enableAsaasManualMode] fatal', { corrId, msg: err.message, stack: err.stack });
    return Response.json({ error: 'internal_error', message: err.message }, { status: 500 });
  }
});