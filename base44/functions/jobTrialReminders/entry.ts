// Job: roda 1x/dia. Envia email D-3 e D-1 antes do fim do trial.
// Evita duplicidade: marca campos trial_email_d3_sent / trial_email_d1_sent na empresa.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function buildEmail({ ownerName, businessName, planName, daysLeft, manageUrl }) {
  const firstName = (ownerName || '').split(' ')[0] || 'tudo certo';
  const subject = daysLeft === 1
    ? `⏰ Seu teste grátis termina amanhã, ${firstName}`
    : `Faltam ${daysLeft} dias para sua cobrança começar`;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#F8F7F3;color:#0F172A;">
  <div style="background:#fff;border-radius:16px;padding:32px 28px;border:1px solid rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#2563EB 0%,#60A5FA 100%);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="color:#fff;font-size:22px;font-weight:900;">BarberTrimly 💈</div>
      <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:4px;">Plano ${planName}</div>
    </div>
    <h1 style="font-size:22px;font-weight:900;margin:0 0 12px;">
      ${daysLeft === 1 ? `Seu teste termina amanhã, ${firstName}!` : `Faltam ${daysLeft} dias, ${firstName}`}
    </h1>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Seu período grátis no BarberTrimly está acabando. Não perca seus clientes — continue usando o sistema sem interrupção.
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
      <strong>${businessName}</strong> já está configurada e funcionando. Tudo que você precisa fazer é manter seu cartão atualizado.
    </p>
    <div style="background:#F8F7F3;border-radius:12px;padding:16px;margin:20px 0;">
      <div style="font-size:13px;color:#334155;line-height:1.7;">
        ✅ Seus dados, agendamentos e clientes ficam salvos<br>
        ✅ Cancele quando quiser direto pelo painel<br>
        ✅ Sem multa, sem fidelidade
      </div>
    </div>
    <div style="text-align:center;margin:28px 0 8px;">
      <a href="${manageUrl}" style="display:inline-block;background:#2563EB;color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Confirmar dados de pagamento →
      </a>
    </div>
    <p style="color:#94A3B8;font-size:12px;text-align:center;margin:16px 0 0;">
      Dúvidas? Responda este email.
    </p>
  </div>
  <p style="color:#94A3B8;font-size:11px;text-align:center;margin-top:16px;">© ${new Date().getFullYear()} BarberTrimly</p>
</div>`.trim();

  return { subject, html };
}

Deno.serve(async (req) => {
  console.log('JOB START: jobTrialReminders');
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // Buscar empresas em trial
    const companies = await base44.asServiceRole.entities.Company.filter(
      { subscription_status: 'trialing' },
      '-created_date',
      1000,
    );

    if (!companies || companies.length === 0) {
      console.log('JOB END: jobTrialReminders — no trialing companies');
      return Response.json({ processed: 0 });
    }
    console.log('jobTrialReminders: companies in trial =', companies.length);

    const origin = req.headers.get('origin') || `https://${req.headers.get('host') || 'barbertrimly.base44.app'}`;
    const manageUrl = `${origin}/app/configuracoes/assinatura`;

    let sentD3 = 0, sentD1 = 0, skipped = 0;

    for (const c of companies) {
      if (!c.trial_ends_at || !c.owner_email) { skipped++; continue; }

      const ends = new Date(c.trial_ends_at);
      const diffDays = Math.ceil((ends - now) / (1000 * 60 * 60 * 24));

      let target = null;
      if (diffDays === 3 && !c.trial_email_d3_sent) target = 3;
      else if (diffDays === 1 && !c.trial_email_d1_sent) target = 1;

      if (!target) { skipped++; continue; }

      const { subject, html } = buildEmail({
        ownerName: c.owner_name || '',
        businessName: c.name || 'Sua barbearia',
        planName: c.plan_name || 'Starter',
        daysLeft: target,
        manageUrl,
      });

      try {
        const sendResult = await base44.asServiceRole.functions.invoke('sendAuditedEmail', {
          to: c.owner_email,
          subject,
          body: html,
          from_name: 'BarberTrimly',
          type: target === 3 ? 'trial_reminder_d3' : 'trial_reminder_d1',
          company_id: c.id,
          metadata: { plan_name: c.plan_name, days_left: target },
        });
        const sendData = sendResult?.data || sendResult;
        if (sendData?.ok) {
          const flag = target === 3 ? { trial_email_d3_sent: true } : { trial_email_d1_sent: true };
          await base44.asServiceRole.entities.Company.update(c.id, flag);
          if (target === 3) sentD3++; else sentD1++;
          console.log('Trial reminder sent:', c.owner_email, 'D-' + target);
        } else {
          console.error('Trial reminder failed:', c.owner_email, sendData?.error);
        }
      } catch (mailErr) {
        console.error('Failed to send trial reminder to', c.owner_email, mailErr.message);
      }
    }

    console.log('JOB END: jobTrialReminders', { sentD3, sentD1, skipped });
    return Response.json({ success: true, processed: companies.length, sent_d3: sentD3, sent_d1: sentD1, skipped });
  } catch (error) {
    console.error('JOB ERROR: jobTrialReminders:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});