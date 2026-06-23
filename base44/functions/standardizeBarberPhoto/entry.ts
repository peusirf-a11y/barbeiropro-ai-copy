// standardizeBarberPhoto — Padroniza foto de barbeiro via IA.
// Recebe a URL da foto original e retorna uma nova URL com camisa preta lisa,
// preservando identidade (rosto, cabelo, barba, tatuagens, pele, idade).
//
// Body: { original_url: string }
// Retorna: { success: true, original_url, standardized_url }
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function buildPrompt(shirtColor) {
  const isWhite = shirtColor === 'white';
  const colorName = isWhite ? 'WHITE' : 'BLACK';
  const colorAdj = isWhite ? 'matte white' : 'matte black';
  const bgHint = isWhite
    ? 'soft light gray or subtle warm gradient'
    : 'soft dark gray or subtle gradient';
  const resultColor = isWhite ? 'clean plain white' : 'clean plain black';

  return `Edit this photo of a barber for a professional barbershop profile picture.

STRICT RULES — ABSOLUTELY DO NOT CHANGE:
- Do NOT alter the face, facial features, expression, or facial proportions
- Do NOT alter hair (style, length, color, texture)
- Do NOT alter beard or mustache
- Do NOT alter skin tone or color
- Do NOT alter visible tattoos on neck, face, hands or arms
- Do NOT add accessories (glasses, earrings, hats, chains) that aren't already present
- Do NOT change the apparent age of the person
- Do NOT change body type or physical characteristics
- Preserve the exact identity of the person

WHAT TO CHANGE:
- Replace whatever clothing the person is wearing with a plain, solid ${colorName} basic t-shirt
- The t-shirt must have NO logos, NO prints, NO graphics, NO text, NO patterns — completely ${colorAdj}
- The t-shirt should look natural on the body, with realistic folds and fit
- If the background is messy, distracting, or unprofessional, replace it with a clean neutral studio background (${bgHint})
- Preserve original natural lighting and shadows on the face and body
- Slightly improve image sharpness and clarity, but keep it photorealistic — no over-smoothing of skin
- If the framing is too wide or off-center, lightly recompose to a clean portrait centered on the upper body

RESULT: a professional, consistent barbershop profile photo where the person looks identical to the original but is wearing a ${resultColor} t-shirt against a clean background. Photorealistic only.`;
}

Deno.serve(async (req) => {
  console.log('FUNCTION START: standardizeBarberPhoto');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { original_url, shirt_color } = body;

    if (!original_url || typeof original_url !== 'string') {
      return Response.json({ error: 'original_url é obrigatório' }, { status: 400 });
    }

    const color = shirt_color === 'white' ? 'white' : 'black';
    console.log('[standardizeBarberPhoto] gerando padronização', { original_url, color });

    const result = await base44.integrations.Core.GenerateImage({
      prompt: buildPrompt(color),
      existing_image_urls: [original_url],
    });

    if (!result?.url) {
      console.error('[standardizeBarberPhoto] IA não retornou URL:', result);
      return Response.json({ error: 'Falha ao gerar imagem padronizada' }, { status: 500 });
    }

    console.log('[standardizeBarberPhoto] sucesso:', result.url);

    return Response.json({
      success: true,
      original_url,
      standardized_url: result.url,
    });
  } catch (error) {
    console.error('[standardizeBarberPhoto] erro:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});