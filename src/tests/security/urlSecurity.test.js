/**
 * tests/security/urlSecurity.test.js
 *
 * Cobre os utilitários de URL security:
 *  - safeRedirect (anti open redirect, anti javascript:/data:, path traversal)
 *  - sanitizeSlug / sanitizePath / sanitizeUrlParam
 *
 * Roda com qualquer runner que entenda `describe`/`it`/`expect` (Vitest/Jest).
 */

import { describe, it, expect } from 'vitest';
import { safeRedirect, safeRedirectFromParams } from '../../src/lib/security/safeRedirect.js';
import { sanitizeSlug, sanitizePath, sanitizeUrlParam } from '../../src/lib/security/urlSanitizer.js';

describe('safeRedirect — open redirect & protocol bypass', () => {
  it('permite rota interna simples', () => {
    expect(safeRedirect('/app/dashboard')).toBe('/app/dashboard');
  });

  it('preserva query string interna', () => {
    expect(safeRedirect('/app/clientes?filter=vip')).toBe('/app/clientes?filter=vip');
  });

  it('bloqueia http absoluto', () => {
    expect(safeRedirect('http://evil.com')).toBe('/app/dashboard');
  });

  it('bloqueia https absoluto', () => {
    expect(safeRedirect('https://evil.com/app')).toBe('/app/dashboard');
  });

  it('bloqueia protocol-relative //evil.com', () => {
    expect(safeRedirect('//evil.com')).toBe('/app/dashboard');
  });

  it('bloqueia javascript:', () => {
    expect(safeRedirect('javascript:alert(1)')).toBe('/app/dashboard');
  });

  it('bloqueia JAVASCRIPT: (case-insensitive)', () => {
    expect(safeRedirect('JaVaScRiPt:alert(1)')).toBe('/app/dashboard');
  });

  it('bloqueia data:', () => {
    expect(safeRedirect('data:text/html,<script>alert(1)</script>')).toBe('/app/dashboard');
  });

  it('bloqueia blob:', () => {
    expect(safeRedirect('blob:https://evil.com/foo')).toBe('/app/dashboard');
  });

  it('bloqueia file:', () => {
    expect(safeRedirect('file:///etc/passwd')).toBe('/app/dashboard');
  });

  it('bloqueia vbscript:', () => {
    expect(safeRedirect('vbscript:msgbox(1)')).toBe('/app/dashboard');
  });

  it('bloqueia path traversal ../', () => {
    expect(safeRedirect('/app/../admin')).toBe('/app/dashboard');
  });

  it('bloqueia path traversal codificado %2e%2e', () => {
    expect(safeRedirect('/app/%2e%2e/admin')).toBe('/app/dashboard');
  });

  it('bloqueia path traversal double-encoded %252e%252e', () => {
    expect(safeRedirect('/%252e%252e/admin')).toBe('/app/dashboard');
  });

  it('bloqueia string vazia', () => {
    expect(safeRedirect('')).toBe('/app/dashboard');
  });

  it('bloqueia null', () => {
    expect(safeRedirect(null)).toBe('/app/dashboard');
  });

  it('bloqueia undefined', () => {
    expect(safeRedirect(undefined)).toBe('/app/dashboard');
  });

  it('bloqueia objeto (não-string)', () => {
    expect(safeRedirect({ href: '/app' })).toBe('/app/dashboard');
  });

  it('bloqueia string que não começa com /', () => {
    expect(safeRedirect('app/dashboard')).toBe('/app/dashboard');
  });

  it('bloqueia backslash (Windows-style)', () => {
    expect(safeRedirect('/app\\..\\admin')).toBe('/app/dashboard');
  });

  it('bloqueia caracteres de controle (newline)', () => {
    expect(safeRedirect('/app\nlocation:evil.com')).toBe('/app/dashboard');
  });

  it('bloqueia caracteres de controle (NUL)', () => {
    expect(safeRedirect('/app\u0000/admin')).toBe('/app/dashboard');
  });

  it('aceita fallback customizado', () => {
    expect(safeRedirect('https://evil.com', '/login')).toBe('/login');
  });

  it('rejeita fallback inseguro e cai no default', () => {
    expect(safeRedirect('https://evil.com', 'https://attacker.com')).toBe('/app/dashboard');
  });
});

describe('safeRedirectFromParams', () => {
  it('lê next primeiro', () => {
    const params = new URLSearchParams('?next=/app/ok&returnTo=/x');
    expect(safeRedirectFromParams(params)).toBe('/app/ok');
  });

  it('cai para returnTo se next ausente', () => {
    const params = new URLSearchParams('?returnTo=/app/x');
    expect(safeRedirectFromParams(params)).toBe('/app/x');
  });

  it('aplica safeRedirect no valor encontrado', () => {
    const params = new URLSearchParams('?next=https://evil.com');
    expect(safeRedirectFromParams(params)).toBe('/app/dashboard');
  });

  it('retorna fallback quando nenhum param presente', () => {
    const params = new URLSearchParams('');
    expect(safeRedirectFromParams(params, ['next'], '/login')).toBe('/login');
  });
});

describe('sanitizeSlug', () => {
  it('aceita slug válido lowercase', () => {
    expect(sanitizeSlug('barbearia-do-zeca')).toBe('barbearia-do-zeca');
  });

  it('converte para lowercase', () => {
    expect(sanitizeSlug('BarbeariaXYZ')).toBe('barbeariaxyz');
  });

  it('rejeita caracteres especiais', () => {
    expect(sanitizeSlug('barb<script>')).toBe('');
  });

  it('rejeita path traversal', () => {
    expect(sanitizeSlug('../admin')).toBe('');
  });

  it('rejeita javascript:', () => {
    expect(sanitizeSlug('javascript:alert(1)')).toBe('');
  });

  it('rejeita slug muito longo', () => {
    expect(sanitizeSlug('a'.repeat(500))).toBe('');
  });

  it('rejeita non-string', () => {
    expect(sanitizeSlug(123)).toBe('');
    expect(sanitizeSlug(null)).toBe('');
  });

  it('aceita números', () => {
    expect(sanitizeSlug('barber123')).toBe('barber123');
  });

  it('aceita underscore', () => {
    expect(sanitizeSlug('barber_shop')).toBe('barber_shop');
  });
});

describe('sanitizePath', () => {
  it('aceita path interno válido', () => {
    expect(sanitizePath('/app/clientes')).toBe('/app/clientes');
  });

  it('rejeita //', () => {
    expect(sanitizePath('//evil.com')).toBe('');
  });

  it('rejeita ..', () => {
    expect(sanitizePath('/app/../admin')).toBe('');
  });

  it('rejeita protocolo', () => {
    expect(sanitizePath('javascript:foo')).toBe('');
  });
});

describe('sanitizeUrlParam', () => {
  it('aceita texto comum', () => {
    expect(sanitizeUrlParam('hello world')).toBe('hello world');
  });

  it('remove < e >', () => {
    expect(sanitizeUrlParam('<script>')).toBe('script');
  });

  it('remove aspas', () => {
    expect(sanitizeUrlParam('a"b\'c')).toBe('abc');
  });

  it('rejeita protocolo perigoso', () => {
    expect(sanitizeUrlParam('javascript:alert(1)')).toBe('');
  });

  it('rejeita controle chars', () => {
    expect(sanitizeUrlParam('hello\u0000world')).toBe('');
  });

  it('trunca em 256 chars', () => {
    const long = 'a'.repeat(500);
    expect(sanitizeUrlParam(long).length).toBe(256);
  });
});