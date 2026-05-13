// Placeholder — este arquivo não é importado por nenhum BFF.
// A lógica de resolveCallerContext foi embutida diretamente em cada BFF
// (Deno Deploy não suporta local imports entre functions/).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
Deno.serve(async (req) => {
  return Response.json({ error: 'NOT_IMPLEMENTED' }, { status: 501 });
});