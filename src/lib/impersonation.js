// Estado de impersonação no cliente. TTL 15 min, salvo em localStorage.
// Banner global lê deste módulo.

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

export function startImpersonation({ company_id, company_name }) {
  const expires_at = new Date(Date.now() + TTL_MS).toISOString();
  const data = { active: true, company_id, company_name, expires_at };
  localStorage.setItem(KEY, JSON.stringify(data));
  window.dispatchEvent(new Event('impersonation-changed'));
  return data;
}

export function stopImpersonation() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event('impersonation-changed'));
}