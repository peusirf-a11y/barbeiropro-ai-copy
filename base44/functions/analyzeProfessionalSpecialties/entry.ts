// analyzeProfessionalSpecialties — Sugere especialidades de um barbeiro
// a partir do histórico REAL de atendimentos.
//
// Regras:
// - Usa apenas appointments concluídos do barbeiro.
// - Calcula por serviço: volume, ticket médio e (quando houver) avg rating.
// - Limiar mínimo para análise: 20 atendimentos concluídos no total.
//   Abaixo disso retorna lista vazia (sem inventar especialidades).
// - A IA mapeia os SERVIÇOS REAIS para tags canônicas e dá confiança 0-100.
// - Confiança é "clampada" pelo volume bruto: serviço com pouco volume
//   nunca pode receber confiança alta (proteção contra alucinação).
//
// Body: { professional_id: string }
// Retorna: { success, specialties: [{tag, confidence, evidence}], analyzed_at, signature }
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MIN_TOTAL_APPOINTMENTS = 20;

// Lista canônica fechada de especialidades aceitas — IA deve escolher SOMENTE dessas.
const CANONICAL_TAGS = [
  'Degradê',
  'Corte Clássico',
  'Corte Social',
  'Corte Infantil',
  'Barba',
  'Navalhado',
  'Pigmentação',
  'Visagismo',
  'Design de Sobrancelha',
  'Atendimento Premium',
  'Cortes Modernos',
  'Estilo Afro',
  'Cortes Cacheados',
];

function milestoneOf(n) {
  // Marcos de 50 em 50 — usados como signature pra detectar "vale reanalisar".
  return Math.floor(n / 50) * 50;
}

// Clamp de confiança baseado no volume de atendimentos que sustenta a tag.
// Evita "Degradê 95%" com só 10 cortes. Espelhamos os critérios do produto.
function maxConfidenceForVolume(serviceVolume) {
  if (serviceVolume >= 100) return 97;
  if (serviceVolume >= 80) return 92;
  if (serviceVolume >= 60) return 85;
  if (serviceVolume >= 40) return 75;
  if (serviceVolume >= 20) return 65;
  if (serviceVolume >= 10) return 55;
  return 0; // abaixo de 10: descarta
}

Deno.serve(async (req) => {
  console.log('FUNCTION START: analyzeProfessionalSpecialties');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { professional_id } = body;
    if (!professional_id) {
      return Response.json({ error: 'professional_id é obrigatório' }, { status: 400 });
    }

    const pro = await base44.entities.Professional.get(professional_id);
    if (!pro) return Response.json({ error: 'Profissional não encontrado' }, { status: 404 });

    // === Coleta histórico real ===
    const completed = await base44.entities.Appointment.filter({
      company_id: pro.company_id,
      professional_id: pro.id,
      status: 'concluido',
    });

    const totalAppointments = completed.length;

    if (totalAppointments < MIN_TOTAL_APPOINTMENTS) {
      return Response.json({
        success: true,
        specialties: [],
        analyzed_at: new Date().toISOString(),
        reason: 'volume_insuficiente',
        total_appointments: totalAppointments,
        min_required: MIN_TOTAL_APPOINTMENTS,
      });
    }

    // Carrega catálogo de serviços da empresa (id → nome, preço, categoria)
    const services = await base44.entities.Service.filter({ company_id: pro.company_id });
    const svcMap = new Map(services.map(s => [s.id, s]));

    // Reviews para avg rating por serviço (best effort)
    let reviewsByAppointment = new Map();
    try {
      const reviews = await base44.entities.Review.filter({
        company_id: pro.company_id,
        professional_id: pro.id,
      });
      reviewsByAppointment = new Map(reviews.map(r => [r.appointment_id, r]));
    } catch (e) {
      console.log('[analyzeProfessionalSpecialties] Review indisponível:', e.message);
    }

    // Agrega por serviço
    const byService = new Map();
    for (const a of completed) {
      const sid = a.service_id;
      if (!sid) continue;
      const svc = svcMap.get(sid);
      if (!svc) continue;
      let entry = byService.get(sid);
      if (!entry) {
        entry = { name: svc.name, count: 0, sumPrice: 0, ratingSum: 0, ratingCount: 0 };
        byService.set(sid, entry);
      }
      entry.count += 1;
      entry.sumPrice += Number(a.price || svc.price || 0);
      const rv = reviewsByAppointment.get(a.id);
      if (rv?.rating) {
        entry.ratingSum += Number(rv.rating);
        entry.ratingCount += 1;
      }
    }

    // Monta lista compacta para a IA — somente serviços com pelo menos 5 atendimentos
    const serviceStats = [...byService.values()]
      .filter(e => e.count >= 5)
      .map(e => ({
        service_name: e.name,
        count: e.count,
        avg_ticket: Number((e.sumPrice / e.count).toFixed(2)),
        avg_rating: e.ratingCount ? Number((e.ratingSum / e.ratingCount).toFixed(2)) : null,
      }))
      .sort((a, b) => b.count - a.count);

    if (serviceStats.length === 0) {
      return Response.json({
        success: true,
        specialties: [],
        analyzed_at: new Date().toISOString(),
        reason: 'mix_insuficiente',
        total_appointments: totalAppointments,
      });
    }

    const prompt = `Você é um analista que identifica especialidades de barbeiros em uma plataforma chamada O CORTE.

DADOS REAIS DO BARBEIRO (atendimentos concluídos, agregados por serviço):
${JSON.stringify(serviceStats, null, 2)}

Total de atendimentos concluídos: ${totalAppointments}

LISTA CANÔNICA DE ESPECIALIDADES (use APENAS estas tags, escritas EXATAMENTE assim):
${CANONICAL_TAGS.map(t => `- ${t}`).join('\n')}

INSTRUÇÕES:
1. Para cada serviço real, identifique a qual tag canônica ele corresponde (match semântico pelo nome).
   - Ex: "Corte Degradê", "Fade", "Low Fade" → Degradê
   - Ex: "Barba completa", "Barba na navalha" → Barba (e também Navalhado, se for o caso)
   - Ex: "Corte criança", "Kids" → Corte Infantil
   - Ex: "Sobrancelha" → Design de Sobrancelha
   - Ex: "Corte social", "Executivo" → Corte Social
   - Se um serviço não casar com NENHUMA tag canônica, ignore-o.
2. Agregue os serviços por tag (uma tag pode receber sinal de vários serviços parecidos).
3. Confiança 0-100 deve refletir:
   - VOLUME de atendimentos da tag (peso principal — quanto maior, maior a confiança)
   - Boa avaliação média (avg_rating ≥ 4.5) reforça a confiança
   - Ticket médio elevado pode reforçar tags premium (Visagismo, Atendimento Premium)
4. Só retorne tags com confiança >= 55. Máximo 6 tags.
5. NUNCA invente uma especialidade que não tenha lastro nos dados acima.
6. Para cada tag, escreva uma "evidence" curta em português citando o NÚMERO concreto.
   Ex: "87 cortes degradê realizados", "62 atendimentos de barba com nota média 4.8".
7. Não use emojis. Não use aspas no texto.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          specialties: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tag: { type: 'string' },
                confidence: { type: 'number' },
                evidence: { type: 'string' },
                supporting_service_names: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Nomes dos serviços reais que sustentam a tag (para validação).',
                },
              },
              required: ['tag', 'confidence', 'evidence'],
            },
          },
        },
        required: ['specialties'],
      },
    });

    const raw = Array.isArray(result?.specialties) ? result.specialties : [];

    // === Validação anti-alucinação ===
    // 1. Só tags canônicas.
    // 2. Calcula volume total que sustenta a tag a partir dos supporting_service_names
    //    para clampar a confiança ao máximo permitido pelo volume real.
    const validated = [];
    for (const item of raw) {
      if (!item?.tag || !CANONICAL_TAGS.includes(item.tag)) continue;
      const supportingNames = Array.isArray(item.supporting_service_names) ? item.supporting_service_names : [];
      let supportingVolume = 0;
      for (const sName of supportingNames) {
        const hit = serviceStats.find(s => s.service_name === sName);
        if (hit) supportingVolume += hit.count;
      }
      // Se a IA não devolveu supporting_service_names, deduz pelo total de atendimentos
      // mas com cap conservador (max 60%).
      const volumeCap = supportingVolume > 0
        ? maxConfidenceForVolume(supportingVolume)
        : Math.min(60, maxConfidenceForVolume(Math.floor(totalAppointments / 3)));

      if (volumeCap < 55) continue;
      const confidence = Math.max(0, Math.min(volumeCap, Math.round(Number(item.confidence) || 0)));
      if (confidence < 55) continue;

      validated.push({
        tag: item.tag,
        confidence,
        evidence: String(item.evidence || '').slice(0, 160),
      });
    }

    // Dedup por tag (mantém maior confiança) + ordena
    const dedupMap = new Map();
    for (const s of validated) {
      const prev = dedupMap.get(s.tag);
      if (!prev || s.confidence > prev.confidence) dedupMap.set(s.tag, s);
    }
    const specialties = [...dedupMap.values()]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 6);

    const signature = `m:${milestoneOf(totalAppointments)}::mix:${serviceStats.slice(0, 5).map(s => `${s.service_name}=${s.count}`).join('|')}`;
    const analyzedAt = new Date().toISOString();

    await base44.entities.Professional.update(pro.id, {
      suggested_specialties: specialties,
      specialties_analyzed_at: analyzedAt,
      specialties_analysis_signature: signature,
    });

    return Response.json({
      success: true,
      specialties,
      analyzed_at: analyzedAt,
      signature,
      total_appointments: totalAppointments,
    });
  } catch (error) {
    console.error('[analyzeProfessionalSpecialties] erro:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});