// getLandingMode — endpoint público (sem auth) que devolve qual landing
// pública deve ser exibida em /landing.
//
// Lê a FeatureFlag global key='landing_mode' usando service role
// porque a página pública é acessada por usuários deslogados, que não
// têm permissão para ler FeatureFlag diretamente pelo SDK.
//
// Resposta: { mode: 'default' | 'launch' }
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const flags = await base44.asServiceRole.entities.FeatureFlag.filter({ key: 'landing_mode' });
    const mode = flags[0]?.enabled ? 'launch' : 'default';
    return Response.json({ mode }, {
      headers: {
        // Cache curto na borda — admin troca o modo e em até 30s vê o reflexo.
        'Cache-Control': 'public, max-age=30',
      },
    });
  } catch (error) {
    console.error('[getLandingMode] erro:', error.message);
    // Fallback seguro: default landing.
    return Response.json({ mode: 'default' });
  }
});