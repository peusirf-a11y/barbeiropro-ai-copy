// Sessão TOTP do super admin. Armazenada em sessionStorage (mais seguro que localStorage:
// limpa ao fechar a aba). TTL = 12h (servidor é a fonte da verdade).

const KEY = 'master_totp_session_v1';

export function getTotpSession() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.expires_at || new Date(data.expires_at).getTime() < Date.now()) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function setTotpSession({ token, expires_at }) {
  sessionStorage.setItem(KEY, JSON.stringify({ token, expires_at }));
  window.dispatchEvent(new Event('totp-session-changed'));
}

export function clearTotpSession() {
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event('totp-session-changed'));
}

export function getTotpToken() {
  return getTotpSession()?.token || null;
}