// Repositório de Entidades Robusto com Supabase e Fallback LocalStorage (Anti "Failed to fetch")
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

const ENTITY_TABLE_MAP = {
  Company: 'companies',
  Plan: 'plans',
  Customer: 'customers',
  Service: 'services',
  Professional: 'professionals',
  TeamMember: 'professionals',
  Appointment: 'appointments',
  CustomerSubscription: 'customer_subscriptions',
  FinancialEntry: 'financial_entries',
  Commission: 'commissions',
  Review: 'reviews',
  Unit: 'units',
  BarberCredential: 'barber_credentials',
  User: 'users',
  SystemAlert: 'system_alerts',
  AuditLog: 'audit_logs',
};

function getLocalTable(tableName) {
  try {
    const raw = localStorage.getItem(`barberpass_local_${tableName}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTable(tableName, items) {
  try {
    localStorage.setItem(`barberpass_local_${tableName}`, JSON.stringify(items));
  } catch (err) {
    console.error(`[LocalFallback] Erro ao salvar ${tableName}:`, err);
  }
}

export class EntityRepository {
  constructor(name) {
    this.name = name;
    this.tableName = ENTITY_TABLE_MAP[name] || name.toLowerCase() + 's';
  }

  async list(sort = '-created_at', limit = 100) {
    if (!isSupabaseConfigured || !supabase) {
      console.warn(`[Supabase] Não configurado, usando fallback local para ${this.name}`);
      return getLocalTable(this.tableName);
    }
    try {
      let query = supabase.from(this.tableName).select('*');
      if (sort) {
        const isDesc = sort.startsWith('-');
        const field = isDesc ? sort.substring(1) : sort;
        query = query.order(field, { ascending: !isDesc });
      }
      if (limit && limit > 0) {
        query = query.limit(limit);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn(`[Supabase Warning] Falha ao listar ${this.name} (${err.message}), usando dados locais.`, err);
      return getLocalTable(this.tableName);
    }
  }

  async filter(criteria = {}, sort = '-created_at', limit = 100) {
    if (!isSupabaseConfigured || !supabase) {
      const items = getLocalTable(this.tableName);
      return items.filter(item => {
        return Object.entries(criteria).every(([k, v]) => item[k] === v);
      });
    }
    try {
      let query = supabase.from(this.tableName).select('*');
      Object.entries(criteria).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          query = query.eq(key, val);
        }
      });
      if (sort) {
        const isDesc = sort.startsWith('-');
        const field = isDesc ? sort.substring(1) : sort;
        query = query.order(field, { ascending: !isDesc });
      }
      if (limit && limit > 0) {
        query = query.limit(limit);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn(`[Supabase Warning] Falha ao filtrar ${this.name}, usando fallback local.`, err);
      const items = getLocalTable(this.tableName);
      return items.filter(item => {
        return Object.entries(criteria).every(([k, v]) => item[k] === v);
      });
    }
  }

  async get(id) {
    if (!isSupabaseConfigured || !supabase) {
      const items = getLocalTable(this.tableName);
      return items.find(i => i.id === id) || null;
    }
    try {
      const { data, error } = await supabase.from(this.tableName).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn(`[Supabase Warning] Falha ao buscar ${this.name} por id ${id}, buscando local.`, err);
      const items = getLocalTable(this.tableName);
      return items.find(i => i.id === id) || null;
    }
  }

  async create(data) {
    const newItem = {
      id: data.id || crypto.randomUUID(),
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
      ...data,
    };

    // Salvar sempre no fallback local para garantir persistência imediata
    const localItems = getLocalTable(this.tableName);
    localItems.unshift(newItem);
    saveLocalTable(this.tableName, localItems);

    if (!isSupabaseConfigured || !supabase) {
      console.log(`[LocalFallback] ${this.name} criado localmente:`, newItem);
      return newItem;
    }

    try {
      console.log(`[Supabase] Inserindo ${this.name} em [${this.tableName}]:`, newItem);
      const { data: inserted, error } = await supabase.from(this.tableName).insert([newItem]).select();
      if (error) throw error;
      if (inserted && inserted[0]) {
        return inserted[0];
      }
      return newItem;
    } catch (err) {
      console.warn(`[Supabase Warning] Falha ao inserir ${this.name} no Supabase (usando versão local):`, err.message);
      return newItem;
    }
  }

  async update(id, patchData) {
    const updatedPatch = {
      ...patchData,
      updated_at: new Date().toISOString(),
    };

    // Atualizar localmente
    const localItems = getLocalTable(this.tableName);
    let updatedLocalItem = null;
    const newItems = localItems.map(item => {
      if (item.id === id) {
        updatedLocalItem = { ...item, ...updatedPatch };
        return updatedLocalItem;
      }
      return item;
    });
    saveLocalTable(this.tableName, newItems);

    if (!isSupabaseConfigured || !supabase) {
      return updatedLocalItem || { id, ...updatedPatch };
    }

    try {
      const { data: updated, error } = await supabase.from(this.tableName).update(updatedPatch).eq('id', id).select();
      if (error) throw error;
      if (updated && updated[0]) {
        return updated[0];
      }
      return updatedLocalItem || { id, ...updatedPatch };
    } catch (err) {
      console.warn(`[Supabase Warning] Falha ao atualizar ${this.name} no Supabase (atualizado localmente):`, err.message);
      return updatedLocalItem || { id, ...updatedPatch };
    }
  }

  async delete(id) {
    const localItems = getLocalTable(this.tableName);
    const filtered = localItems.filter(i => i.id !== id);
    saveLocalTable(this.tableName, filtered);

    if (!isSupabaseConfigured || !supabase) {
      return true;
    }

    try {
      const { error } = await supabase.from(this.tableName).delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn(`[Supabase Warning] Falha ao deletar ${this.name} no Supabase (removido localmente):`, err.message);
      return true;
    }
  }
}

export const Plan = new EntityRepository('Plan');
export const Company = new EntityRepository('Company');
export const Customer = new EntityRepository('Customer');
export const BarberCredential = new EntityRepository('BarberCredential');
export const User = new EntityRepository('User');
export const Appointment = new EntityRepository('Appointment');
export const FinancialEntry = new EntityRepository('FinancialEntry');
export const Commission = new EntityRepository('Commission');
export const TeamMember = new EntityRepository('TeamMember');
export const Professional = new EntityRepository('Professional');
export const Unit = new EntityRepository('Unit');
export const Service = new EntityRepository('Service');
export const Review = new EntityRepository('Review');
export const SystemAlert = new EntityRepository('SystemAlert');
export const AuditLog = new EntityRepository('AuditLog');

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
  CustomerSubscription: new EntityRepository('CustomerSubscription'),
  IdempotencyKey: new EntityRepository('IdempotencyKey'),
};

export const entities = new Proxy(registeredEntities, {
  get(target, prop) {
    if (typeof prop !== 'string') return target[prop];
    if (!(prop in target)) {
      target[prop] = new EntityRepository(prop);
    }
    return target[prop];
  },
});

export default entities;
