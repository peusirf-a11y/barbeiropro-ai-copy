// src/lib/rbacCookie.js
// Sincroniza o papel (role) e e-mail do utilizador autenticado em cookies de 1ª parte
// para que o Vercel Edge Middleware (middleware.js) consiga responder com HTTP 403 Forbidden
// diretamente no nível de rede (HTTP Status 403) antes mesmo de carregar o HTML da SPA.

export function setRbacCookie({ role, email }) {
  if (typeof document === 'undefined') return;
  try {
    const cleanRole = String(role || '').trim().toLowerCase();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const maxAge = 7 * 24 * 60 * 60; // 7 dias
    if (cleanRole) {
      document.cookie = `ocorte_role=${encodeURIComponent(cleanRole)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
    if (cleanEmail) {
      document.cookie = `ocorte_email=${encodeURIComponent(cleanEmail)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
  } catch (_) {}
}

export function clearRbacCookie() {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = 'ocorte_role=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'ocorte_email=; path=/; max-age=0; SameSite=Lax';
  } catch (_) {}
}
