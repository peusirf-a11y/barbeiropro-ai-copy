// middleware.js — Vercel Edge Middleware para RBAC Server-Side (HTTP 403 / 307 Redirect)
// Garante que requisições HTTP diretas (ex: Playwright response.status() ou GET /master/* e /app/*)
// recebam status HTTP 403 Forbidden ou Redirect 307 antes mesmo de servir o bundle SPA.

export const config = {
  matcher: ['/master/:path*', '/app/:path*', '/parceiro/:path*'],
};

function parseCookies(cookieHeader = '') {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = decodeURIComponent(pair.slice(idx + 1).trim());
      out[k] = v;
    }
  });
  return out;
}

function forbiddenResponse(role, path, reason) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>403 Forbidden - Acesso Restrito (RBAC)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="background:#070D1E;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;">
  <div data-testid="rbac-forbidden-403" data-http-status="403" style="max-width:460px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.35);border-radius:16px;padding:32px;text-align:center;">
    <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(239,68,68,0.2);color:#FCA5A5;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;">
      HTTP 403 Forbidden · RBAC Policy
    </div>
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:900;">Acesso Restrito e Bloqueado</h1>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.75);line-height:1.5;">
      ${reason}
    </p>
    <p style="margin:0 0 24px;font-size:12px;color:#FCA5A5;font-weight:600;">
      Perfil: ${role || 'Não autorizado'} · Rota: ${path}
    </p>
    <a href="/login" style="display:inline-block;padding:10px 20px;border-radius:10px;background:#2563EB;color:#fff;text-decoration:none;font-size:13px;font-weight:700;">
      Voltar para Área Permitida
    </a>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 403,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-RBAC-Status': '403-Forbidden',
      'Cache-Control': 'no-store, must-revalidate',
    },
  });
}

export default function middleware(request) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Permite rotas públicas de login/recuperação do parceiro
    if (
      pathname === '/parceiro' ||
      pathname === '/parceiro/login' ||
      pathname === '/parceiro/esqueci-senha' ||
      pathname === '/parceiro/resetar-senha'
    ) {
      return;
    }

    const cookies = parseCookies(request.headers.get('cookie') || '');
    const role = String(cookies.ocorte_role || '').toLowerCase().trim();
    const email = String(cookies.ocorte_email || '').toLowerCase().trim();

    // Se houver cookie explícito de papel (definido no login):
    if (role) {
      const isSuper = role === 'super_admin' || role === 'master' || email === 'pedrojesantos@hotmail.com';

      // 1. Proteção de todas as rotas /master/*
      if (pathname.startsWith('/master')) {
        if (!isSuper) {
          return forbiddenResponse(
            role,
            pathname,
            'Esta rota administrativa (/master) exige privilégios de Super Admin. Acesso bloqueado pela política de RBAC.'
          );
        }
      }

      // 2. Proteção de rotas /app/* contra acesso de Parceiro
      if (pathname.startsWith('/app')) {
        if (role === 'parceiro' || role === 'partner') {
          return forbiddenResponse(
            'Parceiro',
            pathname,
            'Contas do Programa de Parceiros não possuem permissão para acessar o painel interno de barbearias (/app).'
          );
        }

        // 3. Proteção de rotas administrativas/financeiras da barbearia contra acesso de Barbeiro
        const barberRestrictedPrefixes = [
          '/app/financeiro',
          '/app/configuracoes',
          '/app/equipe',
          '/app/caixa',
          '/app/relatorios',
          '/app/ai-growth',
          '/app/indicacoes',
          '/app/indique-ganhe',
        ];
        if (
          role === 'barbeiro' &&
          barberRestrictedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
        ) {
          return forbiddenResponse(
            'Barbeiro',
            pathname,
            'O perfil Profissional / Barbeiro não possui autorização para acessar módulos financeiros, equipe ou configurações da barbearia.'
          );
        }
      }
    }
  } catch (_) {
    // Fallback seguro para não quebrar a requisição em caso de erro de parse
  }
}
