/**
 * demoMode.js — Centro de controle do modo demonstração.
 *
 * O modo demo é ativado quando:
 *  1. A rota começa com /demo/
 *  2. Query param ?demo=1 está presente
 */

export function isDemoMode() {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/demo') ||
    new URLSearchParams(window.location.search).get('demo') === '1';
}

export const DEMO_COMPANY_ID = 'demo-company';