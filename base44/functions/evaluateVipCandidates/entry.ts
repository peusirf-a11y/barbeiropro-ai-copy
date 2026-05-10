// Avalia candidatos automáticos a VIP de uma empresa (read-only).
// Criterios: lifecycle=fiel, >=10 atend, ticket>=1.5x media, >=5 visitas/6m, nao dispensado.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MIN_APPOINTMENTS = 10;
const TICKET_MULTIPLIER = 1.5;
const FREQ_DAYS = 35;
const DISMISS_COOLDOWN_DAYS = 60;
const WINDOW_DAYS = 180;

function daysSince(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((Date.now() - t) / 86400000);
}

function evaluate(customer, customerAppointments, companyAvgTicket) {
  if (customer.status === 'vip') return null;
  if (customer.vip_dismissed_at && daysSince(customer.vip_dismissed_at) < DISMISS_COOLDOWN_DAYS) return null;
  if (customer.lifecycle_status !== 'fiel') return null;

  const concluded = customerAppointments.filter(a => a.status === 'concluido');
  const total = concluded.length;
  if (total < MIN_APPOINTMENTS) return null;

  const totalSpent = concluded.reduce((s, a) => s + (Number(a.price) || 0), 0);
  const customerAvg = totalSpent / total;
  const ticketRatio = companyAvgTicket > 0 ? customerAvg / companyAvgTicket : 0;

  const sixMonthsAgo = Date.now() - WINDOW_DAYS * 86400000;
  const recent = concluded.filter(a => new Date(a.scheduled_at).getTime() >= sixMonthsAgo);
  const recentCount = recent.length;
  const expectedRecent = Math.floor(WINDOW_DAYS / FREQ_DAYS);

  const ticketOk = ticketRatio >= TICKET_MULTIPLIER;
  const freqOk = recentCount >= expectedRecent;
  if (!ticketOk || !freqOk) return null;

  const reasons = [
    `Ticket medio ${ticketRatio.toFixed(1)}x a media da casa`,
    `${recentCount} visitas nos ultimos 6 meses`,
    `${total} atendimentos no historico`,
  ];

  const ticketScore = Math.min(40, (ticketRatio / TICKET_MULTIPLIER) * 40);
  const freqScore = Math.min(40, (recentCount / Math.max(expectedRecent, 1)) * 40);
  const volScore = Math.min(20, (total / MIN_APPOINTMENTS) * 20);
  const score = Math.round(ticketScore + freqScore + volScore);

  return {
    score,
    reasons,
    metrics: {
      total,
      customerAvg: Math.round(customerAvg * 100) / 100,
      companyAvgTicket: Math.round(companyAvgTicket * 100) / 100,
      ticketRatio: Math.round(ticketRatio * 100) / 100,
      recentCount,
      totalSpent: Math.round(totalSpent * 100) / 100,
    },
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { company_id } = await req.json().catch(() => ({}));
    if (!company_id) return Response.json({ error: 'company_id required' }, { status: 400 });

    const sdk = base44.asServiceRole;

    const [customers, allConcluded] = await Promise.all([
      sdk.entities.Customer.filter({ company_id }, '-created_date', 1000),
      sdk.entities.Appointment.filter({ company_id, status: 'concluido' }, '-scheduled_at', 5000),
    ]);

    const totalRevenue = allConcluded.reduce((s, a) => s + (Number(a.price) || 0), 0);
    const companyAvgTicket = allConcluded.length > 0 ? totalRevenue / allConcluded.length : 0;

    const apptsByCustomer = {};
    for (const a of allConcluded) {
      if (!a.customer_id) continue;
      if (!apptsByCustomer[a.customer_id]) apptsByCustomer[a.customer_id] = [];
      apptsByCustomer[a.customer_id].push(a);
    }

    const candidates = [];
    for (const c of customers) {
      const result = evaluate(c, apptsByCustomer[c.id] || [], companyAvgTicket);
      if (result) {
        candidates.push({
          customer: {
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            total_appointments: c.total_appointments,
            last_completed_at: c.last_completed_at,
          },
          ...result,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    return Response.json({
      success: true,
      candidates,
      company_avg_ticket: Math.round(companyAvgTicket * 100) / 100,
      total_customers: customers.length,
    });
  } catch (error) {
    console.error('[evaluateVipCandidates] error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});