// Sugere um horário "ideal" para reativação de cliente inativo.
// Estratégia:
//   1) Se o cliente tem favorite_professional → tenta reaproveitar.
//   2) Procura nos próximos N dias (default 7) o primeiro horário que:
//      - está dentro do business_hours da empresa,
//      - não conflita com agendamento existente,
//      - não cai em bloqueio,
//      - de preferência preenche um buraco da agenda (encaixe inteligente).
//   3) Retorna { date_iso, label } no formato amigável "quinta-feira às 15h".
//
// Usado por jobReactivation. Idempotente, sem efeitos colaterais.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DAY_KEY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

function pad2(n) { return String(n).padStart(2, '0'); }

function generateTimeSlots(openTime, closeTime, durationMin) {
  const slots = [];
  const [oh, om] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);
  let current = oh * 60 + om;
  const end = ch * 60 + cm;
  while (current + durationMin <= end) {
    slots.push(`${pad2(Math.floor(current / 60))}:${pad2(current % 60)}`);
    current += 30;
  }
  return slots;
}

function hasConflict(slotStart, durationMin, professionalId, appointments) {
  const start = slotStart.getTime();
  const end = start + durationMin * 60000;
  return appointments.some(a => {
    if (a.professional_id !== professionalId) return false;
    if (['cancelado', 'faltou'].includes(a.status)) return false;
    const aStart = new Date(a.scheduled_at).getTime();
    const aEnd = aStart + (a.__duration || 30) * 60000;
    return start < aEnd && end > aStart;
  });
}

function hitsBlock(slotStart, durationMin, professionalId, blocks) {
  const start = slotStart.getTime();
  const end = start + durationMin * 60000;
  return blocks.some(b => {
    if (b.professional_id && b.professional_id !== professionalId) return false;
    return start < new Date(b.end_time).getTime() && end > new Date(b.start_time).getTime();
  });
}

function scoreSlot(slotStart, durationMin, professionalId, appointments) {
  const start = slotStart.getTime();
  const end = start + durationMin * 60000;
  const sameDay = appointments.filter(a => {
    if (a.professional_id !== professionalId) return false;
    if (['cancelado', 'faltou'].includes(a.status)) return false;
    return new Date(a.scheduled_at).toDateString() === slotStart.toDateString();
  });
  let score = 0;
  for (const a of sameDay) {
    const aStart = new Date(a.scheduled_at).getTime();
    const aEnd = aStart + (a.__duration || 30) * 60000;
    if (Math.abs(aEnd - start) <= 5 * 60000) score += 10;
    if (Math.abs(aStart - end) <= 5 * 60000) score += 10;
  }
  if (sameDay.length === 0) score -= Math.max(0, slotStart.getHours() - 9) * 0.2;
  return score;
}

function formatLabel(date) {
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const h = date.getHours();
  const m = date.getMinutes();
  const hora = m === 0 ? `${h}h` : `${h}h${pad2(m)}`;
  return `${dias[date.getDay()]} às ${hora}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const { company_id, customer_id, days_ahead = 7 } = await req.json().catch(() => ({}));
    if (!company_id) return Response.json({ success: false, error: 'company_id required' }, { status: 400 });

    const company = await sdk.entities.Company.get(company_id);
    if (!company) return Response.json({ success: false, error: 'company not found' }, { status: 404 });

    const customer = customer_id ? await sdk.entities.Customer.get(customer_id).catch(() => null) : null;

    // Profissional preferido OU qualquer ativo
    let professionals = await sdk.entities.Professional.filter({ company_id, active: true });
    if (!professionals?.length) return Response.json({ success: true, suggestion: null });

    let preferred = null;
    if (customer?.favorite_professional) {
      preferred = professionals.find(p => p.id === customer.favorite_professional || p.name === customer.favorite_professional);
    }
    const orderedPros = preferred ? [preferred, ...professionals.filter(p => p.id !== preferred.id)] : professionals;

    // Serviço: favorite_service ou primeiro ativo
    const services = await sdk.entities.Service.filter({ company_id, active: true });
    if (!services?.length) return Response.json({ success: true, suggestion: null });
    const service = services.find(s => s.id === customer?.favorite_service || s.name === customer?.favorite_service) || services[0];
    const dur = service.duration_minutes || 30;

    // Janela de busca
    const now = new Date();
    const windowEnd = new Date(now.getTime() + days_ahead * 24 * 60 * 60 * 1000);

    const appointments = await sdk.entities.Appointment.filter({ company_id }, '-scheduled_at', 1000);
    const apptsInRange = appointments
      .filter(a => {
        const t = new Date(a.scheduled_at);
        return t >= now && t <= windowEnd;
      })
      .map(a => ({
        ...a,
        __duration: services.find(s => s.id === a.service_id)?.duration_minutes || 30,
      }));

    const blocks = await sdk.entities.BlockedTime.filter({ company_id }, '-start_time', 500);
    const blocksInRange = blocks.filter(b => new Date(b.end_time) >= now && new Date(b.start_time) <= windowEnd);

    // Varre dia a dia, profissional a profissional, achando o melhor encaixe.
    let best = null;

    for (let d = 0; d < days_ahead; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() + d);
      day.setHours(0, 0, 0, 0);

      const hours = company.business_hours?.[DAY_KEY[day.getDay()]];
      if (!hours?.active) continue;

      const slots = generateTimeSlots(hours.open || '09:00', hours.close || '19:00', dur);

      for (const pro of orderedPros) {
        for (const time of slots) {
          const [h, m] = time.split(':').map(Number);
          const slotStart = new Date(day);
          slotStart.setHours(h, m, 0, 0);
          if (slotStart <= now) continue;

          if (hasConflict(slotStart, dur, pro.id, apptsInRange)) continue;
          if (hitsBlock(slotStart, dur, pro.id, blocksInRange)) continue;

          const score = scoreSlot(slotStart, dur, pro.id, apptsInRange);
          // Bônus se for o profissional favorito do cliente
          const finalScore = pro === preferred ? score + 5 : score;

          if (!best || finalScore > best.score || (finalScore === best.score && slotStart < best.slotStart)) {
            best = { slotStart, score: finalScore, professional: pro, service };
          }

          // Otimização: para o profissional favorito, basta achar UM bom slot cedo no dia.
          if (pro === preferred && finalScore >= 15) break;
        }
        if (best && best.professional === preferred && best.score >= 15) break;
      }
      if (best && best.score >= 15) break; // encaixe perfeito → para a busca
    }

    if (!best) return Response.json({ success: true, suggestion: null });

    return Response.json({
      success: true,
      suggestion: {
        date_iso: best.slotStart.toISOString(),
        label: formatLabel(best.slotStart),
        professional_id: best.professional.id,
        professional_name: best.professional.name,
        service_id: best.service.id,
        service_name: best.service.name,
      },
    });
  } catch (error) {
    console.error('[suggestReactivationSlot] error:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});