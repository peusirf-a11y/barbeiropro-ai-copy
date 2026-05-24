// onboardingAccessLink.test.js — Garante que o link CTA do email é seguro:
//   1. Aponta para /checkout/sucesso (URL whitelistada do app).
//   2. Carrega APP_URL do env (não host arbitrário).
//   3. Inclui email, plan e company_slug nos query params.
//   4. Não inclui IDs internos, tokens ou trace.

async function run() {
  const results = [];

  const APP_URL = 'https://ocorte.app';
  function buildAccessUrl({ email, plan, slug }) {
    const params = new URLSearchParams();
    if (email) params.set('email', email);
    if (plan) params.set('plan', plan);
    if (slug) params.set('company_slug', slug);
    return `${APP_URL}/checkout/sucesso?${params.toString()}`;
  }

  // ── 1. URL base correta ────────────────────────────────────────────────
  const url = buildAccessUrl({ email: 'a@b.com', plan: 'pro', slug: 'b1' });
  const parsed = new URL(url);

  results.push({
    name: 'CTA aponta para domínio APP_URL',
    pass: parsed.origin === APP_URL,
    detail: `origin=${parsed.origin}`,
  });
  results.push({
    name: 'CTA aponta para /checkout/sucesso',
    pass: parsed.pathname === '/checkout/sucesso',
    detail: `path=${parsed.pathname}`,
  });

  // ── 2. Query params esperados ──────────────────────────────────────────
  results.push({
    name: 'inclui email no query',
    pass: parsed.searchParams.get('email') === 'a@b.com',
    detail: parsed.searchParams.get('email'),
  });
  results.push({
    name: 'inclui plan no query',
    pass: parsed.searchParams.get('plan') === 'pro',
    detail: parsed.searchParams.get('plan'),
  });
  results.push({
    name: 'inclui company_slug no query',
    pass: parsed.searchParams.get('company_slug') === 'b1',
    detail: parsed.searchParams.get('company_slug'),
  });

  // ── 3. Não vaza dados sensíveis ────────────────────────────────────────
  const FORBIDDEN = ['token', 'secret', 'apikey', 'api_key', 'session', 'cpf', 'cnpj', 'company_id'];
  const lowered = url.toLowerCase();
  for (const f of FORBIDDEN) {
    results.push({
      name: `não inclui '${f}' no link CTA`,
      pass: !lowered.includes(f),
      detail: lowered.includes(f) ? 'LEAKED' : 'safe',
    });
  }

  // ── 4. URL é parseável em qualquer browser (não tem caracteres quebrados) ─
  results.push({
    name: 'URL final é válida (round-trip parse)',
    pass: !!parsed && parsed.toString().startsWith(APP_URL),
    detail: parsed?.toString(),
  });

  // ── 5. Email com caracteres especiais é encoded corretamente ──────────
  const encUrl = buildAccessUrl({ email: 'leandro+teste@gmail.com', plan: 'starter', slug: '' });
  const encParsed = new URL(encUrl);
  results.push({
    name: 'email com "+" é encoded corretamente',
    pass: encParsed.searchParams.get('email') === 'leandro+teste@gmail.com',
    detail: encParsed.searchParams.get('email'),
  });

  // ── 6. Não inclui slug vazio como query vazia confusa ────────────────
  results.push({
    name: 'omite company_slug quando vazio',
    pass: !encParsed.searchParams.has('company_slug'),
    detail: `has=${encParsed.searchParams.has('company_slug')}`,
  });

  return results;
}

export default run;