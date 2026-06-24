// generateProfessionalBio — Gera biografias profissionais de barbeiros via IA.
//
// Regras (do produto):
// 1. NUNCA inventar cursos, certificações ou anos de experiência.
// 2. Usar apenas dados existentes no sistema.
// 3. Gerar 3 versões: curta (≤150), média (≤300), completa (≤600 chars).
// 4. Texto humanizado, transmitindo confiança e profissionalismo.
// 5. Caso existam poucos dados, criar versão simples e profissional.
//
// Body: { professional_id: string }
// Retorna: { success, bio_short, bio_medium, bio_full, bio_source_signature }
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Marco "redondo" mais recente de atendimentos (50, 100, 250, 500, 1k, 2k, 5k, 10k).
// Usado no signature pra disparar regeneração só em saltos significativos, não a cada atendimento.
function lastMilestone(count) {
  const milestones = [10000, 5000, 2000, 1000, 500, 250, 100, 50, 25, 10, 0];
  return milestones.find(m => count >= m) ?? 0;
}

function buildSignature({ name, specialty, serviceNames, milestone, ratingBand }) {
  return [
    `n:${name || ''}`,
    `s:${specialty || ''}`,
    `sv:${[...serviceNames].sort().join('|')}`,
    `m:${milestone}`,
    `r:${ratingBand}`,
  ].join('::');
}

function ratingBandOf(avg) {
  if (avg >= 4.8) return 'excelente';
  if (avg >= 4.5) return 'muito_bem_avaliado';
  if (avg >= 4.0) return 'bem_avaliado';
  if (avg > 0) return 'avaliado';
  return 'sem_avaliacoes';
}

Deno.serve(async (req) => {
  console.log('FUNCTION START: generateProfessionalBio');
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

    // === Coleta de dados REAIS ===
    // Serviços
    let serviceNames = [];
    if (pro.service_ids?.length) {
      const services = await base44.entities.Service.filter({ company_id: pro.company_id });
      const map = new Map(services.map(s => [s.id, s.name]));
      serviceNames = pro.service_ids.map(id => map.get(id)).filter(Boolean);
    }

    // Atendimentos concluídos
    const completed = await base44.entities.Appointment.filter({
      company_id: pro.company_id,
      professional_id: pro.id,
      status: 'concluido',
    });
    const appointmentsCount = completed.length;
    const milestone = lastMilestone(appointmentsCount);

    // Avaliações
    let avgRating = 0;
    let reviewCount = 0;
    try {
      const reviews = await base44.entities.Review.filter({
        company_id: pro.company_id,
        professional_id: pro.id,
      });
      reviewCount = reviews.length;
      if (reviewCount > 0) {
        const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
        avgRating = sum / reviewCount;
      }
    } catch (e) {
      console.log('[generateProfessionalBio] Review não disponível ou erro:', e.message);
    }
    const ratingBand = ratingBandOf(avgRating);

    const signature = buildSignature({
      name: pro.name,
      specialty: pro.specialty,
      serviceNames,
      milestone,
      ratingBand,
    });

    // === Prompt para a IA ===
    const dataLines = [
      `Nome: ${pro.name}`,
      pro.specialty ? `Especialidade declarada: ${pro.specialty}` : null,
      serviceNames.length ? `Serviços que realiza: ${serviceNames.join(', ')}` : null,
      milestone >= 50 ? `Marco de atendimentos realizados: mais de ${milestone}` : null,
      reviewCount >= 5 && avgRating >= 4.0
        ? `Avaliação média dos clientes: ${avgRating.toFixed(1)} estrelas (${reviewCount} avaliações)`
        : null,
    ].filter(Boolean).join('\n');

    const prompt = `Você é um redator profissional especializado em criar mini-biografias para barbeiros de uma plataforma chamada "O CORTE".

DADOS REAIS DO BARBEIRO (use APENAS estes — não invente nada):
${dataLines}

REGRAS OBRIGATÓRIAS:
1. NUNCA invente cursos, certificações, anos de experiência, prêmios ou histórias pessoais.
2. NUNCA mencione tempo de carreira a menos que esteja explicitamente nos dados acima.
3. Use APENAS as informações fornecidas. Se houver poucos dados, escreva algo simples, sóbrio e profissional sem inflar.
4. Tom humanizado, em português brasileiro, transmitindo confiança e profissionalismo. Nada de adjetivos exagerados ("o melhor", "incrível", "mago").
5. Sempre na 3ª pessoa, usando o primeiro nome do barbeiro.
6. Não use emojis. Não use hashtags. Não use aspas.
7. Não cite números literais de atendimentos ou avaliações — apenas reflita confiança quando os marcos forem relevantes.

ESTILO DE REFERÊNCIA:
- "Especialista em cortes masculinos modernos e degradês, João se destaca pela atenção aos detalhes e pelo atendimento personalizado."
- "Com experiência em cortes clássicos, barba e acabamento, Carlos trabalha para entregar estilo, qualidade e conforto aos clientes."

GERE TRÊS VERSÕES da biografia:
- bio_short: até 150 caracteres. Uma frase impactante.
- bio_medium: até 300 caracteres. Duas frases coesas.
- bio_full: até 600 caracteres. Parágrafo completo com 3-4 frases.

Respeite os limites de caracteres rigorosamente.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          bio_short: { type: 'string' },
          bio_medium: { type: 'string' },
          bio_full: { type: 'string' },
        },
        required: ['bio_short', 'bio_medium', 'bio_full'],
      },
    });

    if (!result?.bio_short || !result?.bio_medium || !result?.bio_full) {
      console.error('[generateProfessionalBio] resposta IA inválida:', result);
      return Response.json({ error: 'A IA não retornou as biografias.' }, { status: 500 });
    }

    // Trunca defensivamente respeitando limites
    const bio_short = String(result.bio_short).slice(0, 150).trim();
    const bio_medium = String(result.bio_medium).slice(0, 300).trim();
    const bio_full = String(result.bio_full).slice(0, 600).trim();

    await base44.entities.Professional.update(pro.id, {
      bio_short,
      bio_medium,
      bio_full,
      bio_generated_at: new Date().toISOString(),
      bio_source_signature: signature,
    });

    return Response.json({
      success: true,
      bio_short,
      bio_medium,
      bio_full,
      bio_source_signature: signature,
    });
  } catch (error) {
    console.error('[generateProfessionalBio] erro:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});