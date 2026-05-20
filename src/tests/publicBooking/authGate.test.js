// tests/publicBooking/authGate.test.js — Fase 11b.
//
// Espelho legível dos testes do customerAuth (login, signup, reset, activate,
// magic_link). O runner real está em functions/runFoundationTests.js — esse
// arquivo é só fonte para review/IDE.
//
// PADRÃO: cada caso recebe `createMockBase44()` fresco e exercita uma cópia
// inline do handler (não importamos functions/customerAuth direto pq é Deno
// e funções de plataforma não são deploys isolados — ver tests/README.md).
//
// Cobertura: 22 casos cobrindo os fluxos críticos da Fase 11.

import { createMockBase44 } from '@/tests/helpers/mockBase44';

// ───────────────────────────────────────────────────────────────────
// HELPERS REUSADOS (replicam logic de functions/customerAuth)
// Não usamos crypto.subtle aqui pra manter o teste rápido e síncrono —
// trocamos PBKDF2 por um "hash de teste" sha-equivalente simples só
// pra exercitar a lógica de fluxo (presença de hash, expiração, etc).
// ───────────────────────────────────────────────────────────────────

function fakeHash(password) { return `pbkdf2:${password}:${password.length}`; }
function fakeVerify(password, hash) { return hash === `pbkdf2:${password}:${password.length}`; }
function fakeToken() { return `tok_${Math.random().toString(36).slice(2)}_${Date.now()}`; }

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
const MAGIC_TTL = 15 * 60 * 1000;
const RESET_TTL = 60 * 60 * 1000;

// Handlers de teste — espelho simplificado dos handlers reais.
async function tCheck(sdk, { company_id, email }) {
  const cs = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  const c = cs[0];
  if (!c) return { exists: false, has_password: false };
  return { exists: true, has_password: !!c.password_hash, name: c.name || null };
}

async function tSignup(sdk, { company_id, name, email, phone, password }) {
  if (!email || !password || !name || !phone) throw new Error('campos obrigatórios');
  if (password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres');
  const existing = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  if (existing.length > 0) {
    const c = existing[0];
    if (!c.password_hash) throw new Error('Este e-mail já está cadastrado mas sem senha. Use a opção "Tenho agendamentos antigos".');
    throw new Error('Este e-mail já está cadastrado. Faça login ou recupere sua senha.');
  }
  const token = fakeToken();
  const newC = await sdk.entities.Customer.create({
    company_id, name: name.trim(), email: email.toLowerCase(), phone: String(phone).replace(/\D/g, ''),
    password_hash: fakeHash(password), auth_token: token,
    auth_token_expires_at: new Date(Date.now() + SESSION_TTL).toISOString(), status: 'active',
  });
  return { success: true, customer_id: newC.id, token };
}

async function tLogin(sdk, { company_id, email, password }) {
  const cs = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  const c = cs[0];
  if (!c || !c.password_hash) throw new Error('E-mail ou senha incorretos');
  if (c.password_hash.startsWith('$2b$') || c.password_hash.startsWith('$2a$')) {
    throw new Error('Sua senha precisa ser redefinida. Use "Esqueceu a senha?" para criar uma nova.');
  }
  if (!fakeVerify(password, c.password_hash)) throw new Error('E-mail ou senha incorretos');
  const token = fakeToken();
  await sdk.entities.Customer.update(c.id, { auth_token: token, auth_token_expires_at: new Date(Date.now() + SESSION_TTL).toISOString() });
  return { success: true, customer_id: c.id, token };
}

async function tMe(sdk, { company_id, token }) {
  if (!token) throw new Error('token obrigatório');
  const cs = await sdk.entities.Customer.filter({ company_id, auth_token: token });
  const c = cs[0];
  if (!c) return { customer: null };
  if (c.auth_token_expires_at && new Date(c.auth_token_expires_at) < new Date()) return { customer: null };
  return { customer: { id: c.id, name: c.name, email: c.email } };
}

async function tRequestReset(sdk, { company_id, email }) {
  const cs = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  const c = cs[0];
  if (!c) return { success: true }; // anti-enumeração
  const resetToken = fakeToken();
  await sdk.entities.Customer.update(c.id, { reset_token: resetToken, reset_token_expires_at: new Date(Date.now() + RESET_TTL).toISOString() });
  return { success: true, __test_token: resetToken };
}

async function tResetPassword(sdk, { company_id, email, reset_token, password }) {
  if (password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres');
  const cs = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  const c = cs[0];
  if (!c) throw new Error('Usuário não encontrado');
  if (!c.reset_token) throw new Error('Nenhuma solicitação de reset ativa');
  if (new Date(c.reset_token_expires_at) < new Date()) throw new Error('Link expirou. Solicite um novo.');
  if (c.reset_token !== reset_token) throw new Error('Token inválido ou já utilizado');
  const newToken = fakeToken();
  await sdk.entities.Customer.update(c.id, {
    password_hash: fakeHash(password), reset_token: null, reset_token_expires_at: null,
    auth_token: newToken, auth_token_expires_at: new Date(Date.now() + SESSION_TTL).toISOString(),
    token_version: (c.token_version || 0) + 1,
  });
  return { success: true, customer_id: c.id, token: newToken };
}

async function tActivate(sdk, { company_id, email, phone, password }) {
  if (password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres');
  const phoneNorm = String(phone).replace(/\D/g, '');
  const cs = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  const c = cs.find(x => String(x.phone).replace(/\D/g, '') === phoneNorm);
  if (!c) throw new Error('Nenhum cadastro encontrado com este e-mail e telefone');
  if (c.password_hash) throw new Error('Esta conta já foi ativada. Faça login normalmente.');
  const token = fakeToken();
  await sdk.entities.Customer.update(c.id, {
    password_hash: fakeHash(password), auth_token: token,
    auth_token_expires_at: new Date(Date.now() + SESSION_TTL).toISOString(),
  });
  return { success: true, customer_id: c.id, token };
}

async function tRequestMagic(sdk, { company_id, email }) {
  const cs = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  const c = cs[0];
  if (!c) return { success: true }; // anti-enumeração
  const magic = fakeToken();
  await sdk.entities.Customer.update(c.id, { magic_token: magic, magic_token_expires_at: new Date(Date.now() + MAGIC_TTL).toISOString() });
  return { success: true, __test_token: magic };
}

async function tConsumeMagic(sdk, { company_id, email, magic_token }) {
  const cs = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  const c = cs[0];
  if (!c) throw new Error('Link inválido ou expirado');
  if (!c.magic_token) throw new Error('Link inválido ou já utilizado');
  if (!c.magic_token_expires_at || new Date(c.magic_token_expires_at) < new Date()) {
    await sdk.entities.Customer.update(c.id, { magic_token: null, magic_token_expires_at: null });
    throw new Error('Link expirou. Solicite um novo.');
  }
  if (c.magic_token !== magic_token) throw new Error('Link inválido ou já utilizado');
  const session = fakeToken();
  await sdk.entities.Customer.update(c.id, {
    magic_token: null, magic_token_expires_at: null,
    auth_token: session, auth_token_expires_at: new Date(Date.now() + SESSION_TTL).toISOString(),
  });
  return { success: true, customer_id: c.id, token: session };
}

// ───────────────────────────────────────────────────────────────────
// SUITE
// ───────────────────────────────────────────────────────────────────

export const authGateTests = {
  // ── CHECK ─────────────────────────────────────────────────────────
  'check: email inexistente → exists:false': async () => {
    const m = createMockBase44();
    const r = await tCheck(m.asServiceRole, { company_id: 'co_1', email: 'novo@x.com' });
    if (r.exists !== false || r.has_password !== false) throw new Error('flag errada');
  },
  'check: cliente com senha → has_password:true': async () => {
    const m = createMockBase44({ seed: { Customer: [{ company_id: 'co_1', email: 'a@x.com', name: 'A', password_hash: 'pbkdf2:senha:5' }] } });
    const r = await tCheck(m.asServiceRole, { company_id: 'co_1', email: 'a@x.com' });
    if (!r.exists || !r.has_password) throw new Error('flag errada');
    if (r.name !== 'A') throw new Error('name não veio');
  },
  'check: cliente legado sem senha → has_password:false (oferece activate)': async () => {
    const m = createMockBase44({ seed: { Customer: [{ company_id: 'co_1', email: 'old@x.com', name: 'Old' }] } });
    const r = await tCheck(m.asServiceRole, { company_id: 'co_1', email: 'old@x.com' });
    if (!r.exists || r.has_password) throw new Error('legado deveria ter exists:true + has_password:false');
  },
  'check: case-insensitive': async () => {
    const m = createMockBase44({ seed: { Customer: [{ company_id: 'co_1', email: 'a@x.com', name: 'A', password_hash: 'pbkdf2:senha:5' }] } });
    const r = await tCheck(m.asServiceRole, { company_id: 'co_1', email: 'A@X.COM' });
    if (!r.exists) throw new Error('email case deveria ser normalizado');
  },

  // ── SIGNUP ────────────────────────────────────────────────────────
  'signup: cria customer + retorna token': async () => {
    const m = createMockBase44();
    const r = await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'João', email: 'j@x.com', phone: '11999999999', password: 'senha123' });
    if (!r.success || !r.token || !r.customer_id) throw new Error('signup não retornou tudo');
    const created = await m.asServiceRole.entities.Customer.get(r.customer_id);
    if (!created.password_hash) throw new Error('password_hash não foi salvo');
    if (created.email !== 'j@x.com') throw new Error('email não foi normalizado');
  },
  'signup: rejeita senha < 6 chars': async () => {
    const m = createMockBase44();
    let threw = false;
    try { await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'J', email: 'j@x.com', phone: '11999999999', password: '123' }); }
    catch (e) { threw = true; if (!/mínimo 6/i.test(e.message)) throw new Error(`mensagem errada: ${e.message}`); }
    if (!threw) throw new Error('deveria ter rejeitado');
  },
  'signup: rejeita email duplicado com senha': async () => {
    const m = createMockBase44({ seed: { Customer: [{ company_id: 'co_1', email: 'j@x.com', name: 'J', password_hash: 'pbkdf2:x:1' }] } });
    let threw = false;
    try { await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'J2', email: 'j@x.com', phone: '11999999999', password: 'senha123' }); }
    catch (e) { threw = true; if (!/já está cadastrado/i.test(e.message)) throw new Error(`msg: ${e.message}`); }
    if (!threw) throw new Error('deveria ter rejeitado duplicado');
  },
  'signup: aponta para activate quando email legado sem senha': async () => {
    const m = createMockBase44({ seed: { Customer: [{ company_id: 'co_1', email: 'old@x.com', name: 'Old' }] } });
    let threw = false;
    try { await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'Old', email: 'old@x.com', phone: '11999999999', password: 'senha123' }); }
    catch (e) { threw = true; if (!/agendamentos antigos/i.test(e.message)) throw new Error(`msg: ${e.message}`); }
    if (!threw) throw new Error('deveria ter rejeitado');
  },

  // ── LOGIN ─────────────────────────────────────────────────────────
  'login: credenciais válidas → token novo': async () => {
    const m = createMockBase44();
    await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'J', email: 'j@x.com', phone: '11999999999', password: 'senha123' });
    const r = await tLogin(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com', password: 'senha123' });
    if (!r.success || !r.token) throw new Error('login falhou');
  },
  'login: senha errada → 401': async () => {
    const m = createMockBase44();
    await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'J', email: 'j@x.com', phone: '11999999999', password: 'senha123' });
    let threw = false;
    try { await tLogin(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com', password: 'errada' }); }
    catch (e) { threw = true; if (!/E-mail ou senha/.test(e.message)) throw new Error(`msg: ${e.message}`); }
    if (!threw) throw new Error('deveria ter rejeitado');
  },
  'login: email inexistente → mesma mensagem (anti-enumeração)': async () => {
    const m = createMockBase44();
    let msgInexistente = '';
    try { await tLogin(m.asServiceRole, { company_id: 'co_1', email: 'nao@x.com', password: 'qq' }); }
    catch (e) { msgInexistente = e.message; }
    await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'J', email: 'j@x.com', phone: '11999999999', password: 'senha123' });
    let msgSenhaErrada = '';
    try { await tLogin(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com', password: 'errada' }); }
    catch (e) { msgSenhaErrada = e.message; }
    if (msgInexistente !== msgSenhaErrada) throw new Error(`mensagens diferentes: "${msgInexistente}" vs "${msgSenhaErrada}"`);
  },
  'login: hash bcrypt legado força reset': async () => {
    const m = createMockBase44({ seed: { Customer: [{ company_id: 'co_1', email: 'old@x.com', name: 'O', password_hash: '$2b$10$abcd' }] } });
    let threw = false;
    try { await tLogin(m.asServiceRole, { company_id: 'co_1', email: 'old@x.com', password: 'x' }); }
    catch (e) { threw = true; if (!/redefinida/i.test(e.message)) throw new Error(`msg: ${e.message}`); }
    if (!threw) throw new Error('deveria ter forçado reset');
  },

  // ── ME / SESSION ──────────────────────────────────────────────────
  'me: token válido devolve customer': async () => {
    const m = createMockBase44();
    const s = await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'J', email: 'j@x.com', phone: '11999999999', password: 'senha123' });
    const r = await tMe(m.asServiceRole, { company_id: 'co_1', token: s.token });
    if (!r.customer || r.customer.id !== s.customer_id) throw new Error('me falhou');
  },
  'me: token expirado devolve null': async () => {
    const m = createMockBase44({ seed: { Customer: [{ company_id: 'co_1', email: 'j@x.com', auth_token: 'tok_x', auth_token_expires_at: '2020-01-01T00:00:00Z' }] } });
    const r = await tMe(m.asServiceRole, { company_id: 'co_1', token: 'tok_x' });
    if (r.customer !== null) throw new Error('expirado deveria devolver null');
  },
  'me: token inválido devolve null': async () => {
    const m = createMockBase44();
    const r = await tMe(m.asServiceRole, { company_id: 'co_1', token: 'fake' });
    if (r.customer !== null) throw new Error('inválido deveria devolver null');
  },

  // ── RESET PASSWORD ────────────────────────────────────────────────
  'reset: anti-enumeração quando email não existe': async () => {
    const m = createMockBase44();
    const r = await tRequestReset(m.asServiceRole, { company_id: 'co_1', email: 'nao@x.com' });
    if (!r.success) throw new Error('deveria retornar sucesso silencioso');
  },
  'reset: fluxo completo email → token → nova senha → login': async () => {
    const m = createMockBase44();
    await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'J', email: 'j@x.com', phone: '11999999999', password: 'antiga123' });
    const req = await tRequestReset(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com' });
    const r = await tResetPassword(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com', reset_token: req.__test_token, password: 'nova456' });
    if (!r.success || !r.token) throw new Error('reset falhou');
    const login = await tLogin(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com', password: 'nova456' });
    if (!login.success) throw new Error('login com nova senha falhou');
  },
  'reset: token inválido falha': async () => {
    const m = createMockBase44();
    await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'J', email: 'j@x.com', phone: '11999999999', password: 'antiga123' });
    await tRequestReset(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com' });
    let threw = false;
    try { await tResetPassword(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com', reset_token: 'fake', password: 'nova456' }); }
    catch (e) { threw = true; if (!/Token inválido/i.test(e.message)) throw new Error(`msg: ${e.message}`); }
    if (!threw) throw new Error('deveria ter rejeitado');
  },
  'reset: token consumido não pode ser reutilizado': async () => {
    const m = createMockBase44();
    await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'J', email: 'j@x.com', phone: '11999999999', password: 'antiga' });
    const req = await tRequestReset(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com' });
    await tResetPassword(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com', reset_token: req.__test_token, password: 'nova456' });
    let threw = false;
    try { await tResetPassword(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com', reset_token: req.__test_token, password: 'outra789' }); }
    catch (e) { threw = true; if (!/reset ativa/i.test(e.message)) throw new Error(`msg: ${e.message}`); }
    if (!threw) throw new Error('token deveria ter sido invalidado');
  },

  // ── ACTIVATE LEGACY ───────────────────────────────────────────────
  'activate: cliente legado define senha e ganha sessão': async () => {
    const m = createMockBase44({ seed: { Customer: [{ company_id: 'co_1', name: 'Old', email: 'old@x.com', phone: '11999999999' }] } });
    const r = await tActivate(m.asServiceRole, { company_id: 'co_1', email: 'old@x.com', phone: '11999999999', password: 'senha123' });
    if (!r.success || !r.token) throw new Error('activate falhou');
    const after = await m.asServiceRole.entities.Customer.get(r.customer_id);
    if (!after.password_hash) throw new Error('hash não foi salvo');
  },
  'activate: telefone errado falha': async () => {
    const m = createMockBase44({ seed: { Customer: [{ company_id: 'co_1', name: 'Old', email: 'old@x.com', phone: '11999999999' }] } });
    let threw = false;
    try { await tActivate(m.asServiceRole, { company_id: 'co_1', email: 'old@x.com', phone: '11888888888', password: 'senha123' }); }
    catch (e) { threw = true; if (!/Nenhum cadastro/i.test(e.message)) throw new Error(`msg: ${e.message}`); }
    if (!threw) throw new Error('deveria ter rejeitado');
  },
  'activate: já ativada não pode reativar (proteção)': async () => {
    const m = createMockBase44({ seed: { Customer: [{ company_id: 'co_1', name: 'X', email: 'x@x.com', phone: '11999999999', password_hash: 'pbkdf2:x:1' }] } });
    let threw = false;
    try { await tActivate(m.asServiceRole, { company_id: 'co_1', email: 'x@x.com', phone: '11999999999', password: 'senha123' }); }
    catch (e) { threw = true; if (!/já foi ativada/i.test(e.message)) throw new Error(`msg: ${e.message}`); }
    if (!threw) throw new Error('deveria ter bloqueado');
  },

  // ── MAGIC LINK (Fase 12a) ─────────────────────────────────────────
  'magic: anti-enumeração quando email não existe': async () => {
    const m = createMockBase44();
    const r = await tRequestMagic(m.asServiceRole, { company_id: 'co_1', email: 'nao@x.com' });
    if (!r.success) throw new Error('deveria retornar sucesso silencioso');
  },
  'magic: fluxo request → consume → sessão ativa': async () => {
    const m = createMockBase44();
    await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'J', email: 'j@x.com', phone: '11999999999', password: 'qualquer' });
    const req = await tRequestMagic(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com' });
    const r = await tConsumeMagic(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com', magic_token: req.__test_token });
    if (!r.success || !r.token) throw new Error('consume falhou');
    const me = await tMe(m.asServiceRole, { company_id: 'co_1', token: r.token });
    if (!me.customer) throw new Error('sessão não validou');
  },
  'magic: token inválido falha': async () => {
    const m = createMockBase44();
    await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'J', email: 'j@x.com', phone: '11999999999', password: 'qualquer' });
    await tRequestMagic(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com' });
    let threw = false;
    try { await tConsumeMagic(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com', magic_token: 'fake' }); }
    catch (e) { threw = true; if (!/inválido|utilizado/i.test(e.message)) throw new Error(`msg: ${e.message}`); }
    if (!threw) throw new Error('deveria ter rejeitado');
  },
  'magic: token usado não pode ser reutilizado': async () => {
    const m = createMockBase44();
    await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'J', email: 'j@x.com', phone: '11999999999', password: 'qualquer' });
    const req = await tRequestMagic(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com' });
    await tConsumeMagic(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com', magic_token: req.__test_token });
    let threw = false;
    try { await tConsumeMagic(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com', magic_token: req.__test_token }); }
    catch (e) { threw = true; if (!/já utilizado|inválido/i.test(e.message)) throw new Error(`msg: ${e.message}`); }
    if (!threw) throw new Error('token deveria ter sido invalidado');
  },
  'magic: token expirado falha e é limpo': async () => {
    const m = createMockBase44({ seed: { Customer: [{ company_id: 'co_1', email: 'j@x.com', name: 'J', magic_token: 'expirado', magic_token_expires_at: '2020-01-01T00:00:00Z' }] } });
    let threw = false;
    try { await tConsumeMagic(m.asServiceRole, { company_id: 'co_1', email: 'j@x.com', magic_token: 'expirado' }); }
    catch (e) { threw = true; if (!/expirou/i.test(e.message)) throw new Error(`msg: ${e.message}`); }
    if (!threw) throw new Error('deveria ter rejeitado');
    // Token deve ter sido limpo
    const cs = await m.asServiceRole.entities.Customer.filter({ company_id: 'co_1', email: 'j@x.com' });
    if (cs[0].magic_token != null) throw new Error('token expirado deveria ter sido limpo');
  },

  // ── CROSS-TENANT ISOLATION ────────────────────────────────────────
  'cross-tenant: email duplicado em empresas distintas é OK': async () => {
    const m = createMockBase44();
    await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'J', email: 'j@x.com', phone: '11999999999', password: 'senha123' });
    const r = await tSignup(m.asServiceRole, { company_id: 'co_2', name: 'J', email: 'j@x.com', phone: '11888888888', password: 'outra456' });
    if (!r.success) throw new Error('email mesmo em outra empresa deveria ser válido');
  },
  'cross-tenant: login não enxerga customer de outra empresa': async () => {
    const m = createMockBase44();
    await tSignup(m.asServiceRole, { company_id: 'co_1', name: 'J', email: 'j@x.com', phone: '11999999999', password: 'senha_co1' });
    let threw = false;
    try { await tLogin(m.asServiceRole, { company_id: 'co_2', email: 'j@x.com', password: 'senha_co1' }); }
    catch (e) { threw = true; }
    if (!threw) throw new Error('login deveria ter falhado em tenant diferente');
  },
};