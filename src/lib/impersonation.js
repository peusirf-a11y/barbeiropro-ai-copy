// Estado de impersonação no cliente. TTL 15 min, salvo em localStorage.
// Agora inclui o token retornado pelo backend, usado em mutações via impersonatedMutation.

const KEY = 'master_impersonation_v1';
const TTL_MS = 15 * 60 * 1000;

export function getImpersonation() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.expires_at || new Date(data.expires_at).getTime() < Date.now()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function startImpersonation({ company_id, company_name, token, expires_at }) {
  const data = {
    active: true,
    company_id,
    company_name,
    token,
    expires_at: expires_at || new Date(Date.now() + TTL_MS).toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(data));
  window.dispatchEvent(new Event('impersonation-changed'));
  return data;
}

export function stopImpersonation() {
  const current = getImpersonation();
  // Avisa o backend (best-effort)
  if (current?.token) {
    try {
      import('@/api/base44Client').then(({ base44 }) => {
        base44.functions.invoke('endImpersonation', { token: current.token }).catch(() => {});
      });
    } catch { /* noop */ }
  }
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event('impersonation-changed'));
}

export function isImpersonating() {
  const imp = getImpersonation();
  return !!imp?.active;
}

export function getImpersonationToken() {
  return getImpersonation()?.token || null;
}