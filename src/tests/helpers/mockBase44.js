// tests/helpers/mockBase44.js — F1 do Foundation Sprint.
//
// Mock in-memory do SDK Base44 para uso em testes (smoke + unit).
// Implementa o subset que nosso código realmente usa:
//   - entities.<Name>.{ create, get, filter, update, delete, list }
//   - auth.me()
//   - asServiceRole (alias do mesmo store, com flag isServiceRole)
//
// NÃO simula RLS — esse é trabalho dos guards server-side, que os testes
// devem exercitar explicitamente. O mock só guarda dados.
//
// Uso típico:
//   import { createMockBase44 } from '@/tests/helpers/mockBase44';
//   const mock = createMockBase44();
//   await mock.entities.Customer.create({ name: 'João' });
//   const list = await mock.entities.Customer.filter({});
//
// Para semear dados:
//   const mock = createMockBase44({
//     seed: { Customer: [{ id: 'c1', name: 'X' }], Company: [...] }
//   });

let _idCounter = 0;
function _newId() {
  _idCounter += 1;
  return `mock_${Date.now()}_${_idCounter}`;
}

function _matches(record, filter) {
  if (!filter || typeof filter !== 'object') return true;
  for (const [key, expected] of Object.entries(filter)) {
    const actual = record[key];
    // Operadores Mongo-like (subset)
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$gte' in expected && !(actual >= expected.$gte)) return false;
      if ('$gt'  in expected && !(actual >  expected.$gt))  return false;
      if ('$lte' in expected && !(actual <= expected.$lte)) return false;
      if ('$lt'  in expected && !(actual <  expected.$lt))  return false;
      if ('$in'  in expected && !expected.$in.includes(actual)) return false;
      if ('$ne'  in expected && actual === expected.$ne) return false;
      continue;
    }
    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}

function _sort(records, sortKey) {
  if (!sortKey) return records;
  const desc = sortKey.startsWith('-');
  const key = desc ? sortKey.slice(1) : sortKey;
  return [...records].sort((a, b) => {
    const av = a[key], bv = b[key];
    if (av === bv) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av < bv ? -1 : 1) * (desc ? -1 : 1);
  });
}

function _makeEntityApi(name, store) {
  if (!store[name]) store[name] = new Map();
  const table = store[name];

  return {
    async create(data) {
      const id = data.id || _newId();
      const now = new Date().toISOString();
      const record = {
        id,
        created_date: now,
        updated_date: now,
        ...data,
      };
      table.set(id, record);
      return record;
    },
    async get(id) {
      const r = table.get(id);
      if (!r) throw new Error(`${name} not found: ${id}`);
      return { ...r };
    },
    async filter(filter, sortKey, limit) {
      let results = [...table.values()].filter(r => _matches(r, filter));
      results = _sort(results, sortKey);
      if (limit) results = results.slice(0, limit);
      return results.map(r => ({ ...r }));
    },
    async list(sortKey, limit) {
      return this.filter({}, sortKey, limit);
    },
    async update(id, patch) {
      const r = table.get(id);
      if (!r) throw new Error(`${name} not found: ${id}`);
      const updated = { ...r, ...patch, updated_date: new Date().toISOString() };
      table.set(id, updated);
      return { ...updated };
    },
    async delete(id) {
      const existed = table.delete(id);
      if (!existed) throw new Error(`${name} not found: ${id}`);
      return { success: true };
    },
    // Helpers só do mock (úteis em assertions de teste)
    __count: () => table.size,
    __clear: () => table.clear(),
    __raw: () => [...table.values()],
  };
}

export function createMockBase44({ seed = {}, currentUser = null } = {}) {
  const store = {}; // { Customer: Map<id, record>, ... }

  // Semear
  for (const [name, records] of Object.entries(seed)) {
    if (!store[name]) store[name] = new Map();
    for (const r of records) {
      const id = r.id || _newId();
      store[name].set(id, { id, created_date: r.created_date || new Date().toISOString(), ...r });
    }
  }

  // Proxy: cria entity API sob demanda
  const entitiesHandler = {
    get(_target, name) {
      if (typeof name !== 'string') return undefined;
      return _makeEntityApi(name, store);
    },
  };
  const entities = new Proxy({}, entitiesHandler);

  const auth = {
    me: async () => {
      if (!currentUser) throw new Error('Not authenticated');
      return { ...currentUser };
    },
    isAuthenticated: async () => !!currentUser,
  };

  // asServiceRole compartilha o mesmo store — é o mesmo banco.
  const asServiceRole = { entities, auth, __isServiceRole: true };

  return {
    entities,
    auth,
    asServiceRole,
    // Helpers do mock
    __store: store,
    __setUser: (u) => { currentUser = u; },
  };
}