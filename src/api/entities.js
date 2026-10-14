// Repositório de Entidades Autônomo O CORTE / BarberPass
// Substitui a dependência do Base44 por uma camada relacional limpa,
// com suporte a persistência local (localStorage) e rotas REST padrão.

import {
  INITIAL_PLANS,
  INITIAL_COMPANIES,
  INITIAL_CUSTOMERS,
  INITIAL_BARBER_CREDENTIALS,
  INITIAL_PROFESSIONALS,
  INITIAL_SERVICES,
  INITIAL_APPOINTMENTS,
  INITIAL_FINANCIAL,
  INITIAL_COMMISSIONS,
  INITIAL_REVIEWS,
} from './mockData';

function getStorageKey(entityName) {
  return `barberpass_entity_${entityName.toLowerCase()}`;
}

function loadEntities(entityName, defaultData = []) {
  if (typeof window === 'undefined') return defaultData;
  try {
    const raw = localStorage.getItem(getStorageKey(entityName));
    if (!raw) {
      localStorage.setItem(getStorageKey(entityName), JSON.stringify(defaultData));
      return defaultData;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return defaultData;
  } catch (err) {
    console.warn(`[Entities] Erro ao carregar ${entityName}:`, err);
    return defaultData;
  }
}

function saveEntities(entityName, items) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(entityName), JSON.stringify(items));
  } catch (err) {
    console.warn(`[Entities] Erro ao salvar ${entityName}:`, err);
  }
}

export class EntityRepository {
  constructor(name, initialItems = []) {
    this.name = name;
    this.initialItems = initialItems;
  }

  async list(sort = '-created_at', limit = 100) {
    let items = loadEntities(this.name, this.initialItems);
    
    if (sort) {
      const isDesc = sort.startsWith('-');
      const field = isDesc ? sort.substring(1) : sort;
      items = [...items].sort((a, b) => {
        const valA = a[field] ?? '';
        const valB = b[field] ?? '';
        if (valA < valB) return isDesc ? 1 : -1;
        if (valA > valB) return isDesc ? -1 : 1;
        return 0;
      });
    }

    if (limit && limit > 0) {
      items = items.slice(0, limit);
    }
    return items;
  }

  async filter(criteria = {}, sort = '-created_at', limit = 100) {
    const all = await this.list(sort, 1000);
    const filtered = all.filter((item) => {
      return Object.entries(criteria).every(([key, val]) => {
        if (val === undefined || val === null) return true;
        if (typeof val === 'string') {
          return String(item[key] || '').toLowerCase() === val.toLowerCase();
        }
        return item[key] === val;
      });
    });

    if (limit && limit > 0) {
      return filtered.slice(0, limit);
    }
    return filtered;
  }

  async get(id) {
    const items = loadEntities(this.name, this.initialItems);
    return items.find((i) => i.id === id || String(i.id) === String(id)) || null;
  }

  async create(data) {
    const items = loadEntities(this.name, this.initialItems);
    const newItem = {
      id: `${this.name.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    };
    items.unshift(newItem);
    saveEntities(this.name, items);
    return newItem;
  }

  async update(id, patchData) {
    const items = loadEntities(this.name, this.initialItems);
    const index = items.findIndex((i) => i.id === id || String(i.id) === String(id));
    if (index === -1) {
      throw new Error(`Item ${id} não encontrado em ${this.name}`);
    }
    items[index] = {
      ...items[index],
      ...patchData,
      updated_at: new Date().toISOString(),
    };
    saveEntities(this.name, items);
    return items[index];
  }

  async delete(id) {
    let items = loadEntities(this.name, this.initialItems);
    items = items.filter((i) => i.id !== id && String(i.id) !== String(id));
    saveEntities(this.name, items);
    return true;
  }
}

// Repositórios padronizados de cada entidade do ecossistema
export const Plan = new EntityRepository('Plan', INITIAL_PLANS);
export const Company = new EntityRepository('Company', INITIAL_COMPANIES);
export const Customer = new EntityRepository('Customer', INITIAL_CUSTOMERS);
export const BarberCredential = new EntityRepository('BarberCredential', INITIAL_BARBER_CREDENTIALS);
export const User = new EntityRepository('User', INITIAL_BARBER_CREDENTIALS);
export const Appointment = new EntityRepository('Appointment', INITIAL_APPOINTMENTS);
export const FinancialEntry = new EntityRepository('FinancialEntry', INITIAL_FINANCIAL);
export const Commission = new EntityRepository('Commission', INITIAL_COMMISSIONS);
export const TeamMember = new EntityRepository('TeamMember', INITIAL_PROFESSIONALS);
export const Professional = new EntityRepository('Professional', INITIAL_PROFESSIONALS);
export const Unit = new EntityRepository('Unit', []);
export const Service = new EntityRepository('Service', INITIAL_SERVICES);
export const Review = new EntityRepository('Review', INITIAL_REVIEWS);
export const SystemAlert = new EntityRepository('SystemAlert', []);
export const AuditLog = new EntityRepository('AuditLog', []);

const registeredEntities = {
  Plan,
  Company,
  Customer,
  BarberCredential,
  User,
  Appointment,
  FinancialEntry,
  Commission,
  TeamMember,
  Professional,
  Service,
  Unit,
  Review,
  SystemAlert,
  AuditLog,
  CustomerSubscription: new EntityRepository('CustomerSubscription', []),
  IdempotencyKey: new EntityRepository('IdempotencyKey', []),
};

// Proxy para dinamismo e segurança absoluta (nunca retorna undefined para nenhuma entidade)
export const entities = new Proxy(registeredEntities, {
  get(target, prop) {
    if (typeof prop !== 'string') return target[prop];
    if (!(prop in target)) {
      target[prop] = new EntityRepository(prop, []);
    }
    return target[prop];
  },
});

export default entities;
