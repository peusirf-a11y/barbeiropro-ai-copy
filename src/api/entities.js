// Repositório de Entidades Robusto com Supabase e Fallback LocalStorage (Anti "Failed to fetch")
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

const ENTITY_TABLE_MAP = {
  Company: 'companies',
  Plan: 'plans',
  Customer: 'customers',
  Service: 'services',
  Professional: 'professionals',
  TeamMember: 'team_members',
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

const TABLES_WITH_ACTIVE_COLUMN = new Set([
  'companies',
  'plans',
  'services',
  'professionals',
  'team_members',
  'units',
]);

const APPOINTMENT_COLUMNS = new Set([
  'id',
  'company_id',
  'customer_id',
  'customer_name',
  'customer_phone',
  'customer_email',
  'service_id',
  'service_name',
  'professional_id',
  'professional_name',
  'date',
  'time',
  'price',
  'status',
  'payment_status',
  'payment_id',
  'notes',
  'created_at',
  'updated_at',
  'client_name',
  'client_phone',
  'start_time',
  'end_time',
  'asaas_payment_id',
]);

const CUSTOMER_COLUMNS = new Set([
  'id',
  'company_id',
  'name',
  'email',
  'phone',
  'cpf',
  'avatar_url',
  'status',
  'created_at',
  'updated_at',
]);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getLocalTable(tableName) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(`barberpass_local_${tableName}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTable(tableName, items) {
  try {
    if (typeof localStorage === 'undefined') return;
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

  _normalizeRow(row) {
    if (!row || typeof row !== 'object') return row;
    if (this.tableName !== 'appointments') return row;
    const out = { ...row };

    // Usa date + time diretamente para evitar qualquer deslocamento de fuso horário ao renderizar na Agenda
    if (out.date && out.time) {
      out.scheduled_at = `${out.date}T${String(out.time).slice(0, 5)}:00`;
    } else if (!out.scheduled_at) {
      if (out.start_time && String(out.start_time).includes('T')) {
        out.scheduled_at = out.start_time;
      }
    }

    // Padroniza status 'confirmed' (inglês) para 'confirmado' (português usado em toda a Agenda/Dashboard)
    if (out.status === 'confirmed') {
      out.status = 'confirmado';
    }

    // Se houve pagamento online confirmado, habilita flags paid / paid_online e identifica o método (pix vs credit_card)
    const pStatus = String(out.payment_status || '').toLowerCase();
    const isCardPayment =
      pStatus === 'confirmed_card' ||
      pStatus === 'paid_card' ||
      out.payment_method === 'credit_card' ||
      out.payment_method === 'card' ||
      out.payment_method === 'CREDIT_CARD';

    if (
      out.status !== 'pending_payment' &&
      (pStatus === 'confirmed' ||
        pStatus === 'confirmed_card' ||
        pStatus === 'confirmed_pix' ||
        pStatus === 'paid' ||
        pStatus === 'paid_card' ||
        pStatus === 'succeeded' ||
        Boolean(out.asaas_payment_id) ||
        Boolean(out.payment_id))
    ) {
      out.paid = true;
      out.paid_online = true;
      if (out.payment_method !== 'subscription') {
        out.payment_method = isCardPayment ? 'credit_card' : 'pix';
      }
    }

    if (!out.customer_name && out.client_name) out.customer_name = out.client_name;
    if (!out.client_name && out.customer_name) out.client_name = out.customer_name;
    if (!out.customer_phone && out.client_phone) out.customer_phone = out.client_phone;
    if (!out.client_phone && out.customer_phone) out.client_phone = out.customer_phone;
    if (!out.payment_id && out.asaas_payment_id) out.payment_id = out.asaas_payment_id;
    if (!out.asaas_payment_id && out.payment_id) out.asaas_payment_id = out.payment_id;
    return out;
  }

  async _reconcileAndFilterAppointments(rows) {
    if (!Array.isArray(rows) || this.tableName !== 'appointments') {
      return (rows || []).map(r => this._normalizeRow(r));
    }

    const result = [];
    for (const row of rows) {
      if (row.status === 'pending_payment') {
        const pid = row.asaas_payment_id || row.payment_id || '';
        // Se existe um pagamento Pix real pendente no banco, verifica no Asaas se o cliente já pagou no app do banco
        if (typeof window !== 'undefined' && pid && pid.startsWith('pay_') && !pid.startsWith('pay_mock_')) {
          try {
            const qs = new URLSearchParams({
              paymentId: pid,
              appointmentId: row.id || '',
              companyId: row.company_id || '',
              _t: String(Date.now()),
            });
            const res = await fetch(`/api/payments/status?${qs.toString()}`);
            const statusData = await res.json().catch(() => null);
            if (res.ok && statusData?.confirmed === true) {
              const isCard =
                statusData?.payment_method === 'credit_card' ||
                statusData?.billingType === 'CREDIT_CARD' ||
                statusData?.appointment?.payment_status === 'confirmed_card';
              const updatedRow = {
                ...row,
                ...(statusData.appointment || {}),
                status: 'confirmado',
                payment_status: isCard ? 'confirmed_card' : 'confirmed',
                payment_method: isCard ? 'credit_card' : 'pix',
              };
              result.push(this._normalizeRow(updatedRow));
              continue;
            }
          } catch (_) {}
        }
        // Enquanto não pago ('pending_payment'), NÃO exibe como corte agendado no sistema!
        continue;
      }
      result.push(this._normalizeRow(row));
    }
    return result;
  }

  _prepareDbPayload(rawItem, isUpdate = false) {
    const item = { ...rawItem };

    if (!TABLES_WITH_ACTIVE_COLUMN.has(this.tableName)) {
      delete item.active;
    }

    if (this.tableName === 'appointments') {
      if (item.scheduled_at && !item.start_time) {
        item.start_time = item.scheduled_at;
      }
      if (item.scheduled_at && (!item.date || !item.time)) {
        const d = new Date(item.scheduled_at);
        if (!Number.isNaN(d.getTime())) {
          const pad = (n) => String(n).padStart(2, '0');
          if (!item.date) item.date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          if (!item.time) item.time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
      }
      if (item.customer_name && !item.client_name) item.client_name = item.customer_name;
      if (item.customer_phone && !item.client_phone) item.client_phone = item.customer_phone;
      if (item.customer_id && !UUID_REGEX.test(String(item.customer_id))) {
        item.customer_id = null;
      }
      if (item.professional_id && !UUID_REGEX.test(String(item.professional_id))) {
        item.professional_id = null;
      }
      if (item.service_id && !UUID_REGEX.test(String(item.service_id))) {
        item.service_id = null;
      }

      const cleaned = {};
      for (const [k, v] of Object.entries(item)) {
        if (APPOINTMENT_COLUMNS.has(k) && v !== undefined) {
          cleaned[k] = v;
        }
      }
      return cleaned;
    }

    if (this.tableName === 'customers') {
      if (!isUpdate && !item.status) {
        item.status = 'active';
      }
      if (!isUpdate && !item.email) {
        const phoneDigits = String(item.phone || '').replace(/\D/g, '');
        const cpfDigits = String(item.cpf || '').replace(/\D/g, '');
        item.email = phoneDigits
          ? `${phoneDigits}@cliente.local`
          : cpfDigits
          ? `${cpfDigits}@cliente.local`
          : `cliente_${Date.now()}@cliente.local`;
      }
      const cleaned = {};
      for (const [k, v] of Object.entries(item)) {
        if (CUSTOMER_COLUMNS.has(k) && v !== undefined) {
          cleaned[k] = v;
        }
      }
      return cleaned;
    }

    return item;
  }

  async list(sort = '-created_at', limit = 100) {
    if (!isSupabaseConfigured || !supabase) {
      return getLocalTable(this.tableName);
    }
    try {
      let query = supabase.from(this.tableName).select('*');
      if (sort) {
        const isDesc = sort.startsWith('-');
        let field = isDesc ? sort.substring(1) : sort;
        if (this.tableName === 'appointments' && field === 'scheduled_at') {
          field = 'date';
        }
        query = query.order(field, { ascending: !isDesc });
      }
      if (limit && limit > 0) {
        query = query.limit(limit);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (this.tableName === 'appointments') {
        return await this._reconcileAndFilterAppointments(data || []);
      }
      return (data || []).map(r => this._normalizeRow(r));
    } catch (err) {
      console.warn(`[Supabase Warning] Falha ao listar ${this.name} (${err.message}), usando dados locais.`, err);
      return getLocalTable(this.tableName);
    }
  }

  async filter(criteria = {}, sort = '-created_at', limit = 100) {
    if (
      (this.tableName === 'customer_subscriptions' || this.tableName === 'appointments') &&
      criteria.customer_id &&
      !UUID_REGEX.test(String(criteria.customer_id))
    ) {
      if (this.tableName === 'customer_subscriptions') {
        return [];
      }
    }

    if (!isSupabaseConfigured || !supabase) {
      const items = getLocalTable(this.tableName);
      return items.filter(item => {
        return Object.entries(criteria).every(([k, v]) => item[k] === v);
      });
    }
    try {
      let query = supabase.from(this.tableName).select('*');
      Object.entries(criteria).forEach(([key, val]) => {
        if (val === undefined || val === null) return;
        if (this.tableName === 'appointments' && key === 'scheduled_at') return;
        if (this.tableName === 'appointments' && key === 'customer_id' && !UUID_REGEX.test(String(val))) return;
        if (typeof val === 'object' && !Array.isArray(val)) {
          if (val.$ne !== undefined) query = query.neq(key, val.$ne);
          if (val.$gte !== undefined) query = query.gte(key, val.$gte);
          if (val.$lte !== undefined) query = query.lte(key, val.$lte);
        } else {
          query = query.eq(key, val);
        }
      });
      if (sort) {
        const isDesc = sort.startsWith('-');
        let field = isDesc ? sort.substring(1) : sort;
        if (this.tableName === 'appointments' && field === 'scheduled_at') {
          field = 'date';
        }
        if (this.tableName === 'customer_subscriptions' && field === 'created_date') {
          field = 'created_at';
        }
        if (this.tableName === 'reviews' && field === 'created_date') {
          field = 'created_at';
        }
        query = query.order(field, { ascending: !isDesc });
      }
      if (limit && limit > 0) {
        query = query.limit(limit);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (this.tableName === 'appointments') {
        return await this._reconcileAndFilterAppointments(data || []);
      }
      return (data || []).map(r => this._normalizeRow(r));
    } catch (err) {
      console.warn(`[Supabase Warning] Falha ao filtrar ${this.name}, usando fallback local.`, err);
      const items = getLocalTable(this.tableName);
      return items.filter(item => {
        return Object.entries(criteria).every(([k, v]) => {
          if (typeof v === 'object' && v !== null) return true;
          return item[k] === v;
        });
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
      return this._normalizeRow(data);
    } catch (err) {
      console.warn(`[Supabase Warning] Falha ao buscar ${this.name} por id ${id}, buscando local.`, err);
      const items = getLocalTable(this.tableName);
      return items.find(i => i.id === id) || null;
    }
  }

  async create(data) {
    const rawNewItem = {
      id: data.id && UUID_REGEX.test(String(data.id)) ? data.id : crypto.randomUUID(),
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
      ...(TABLES_WITH_ACTIVE_COLUMN.has(this.tableName)
        ? { active: data.active !== undefined ? data.active : true }
        : {}),
      ...data,
    };

    const dbPayload = this._prepareDbPayload(rawNewItem, false);

    if (!isSupabaseConfigured || !supabase) {
      const localItems = getLocalTable(this.tableName);
      localItems.unshift(rawNewItem);
      saveLocalTable(this.tableName, localItems);
      return this._normalizeRow(rawNewItem);
    }

    try {
      const { data: inserted, error } = await supabase.from(this.tableName).insert([dbPayload]).select();
      if (error) {
        console.error(`[Supabase Error] Falha ao inserir ${this.name}:`, error);
        throw error;
      }

      const localItems = getLocalTable(this.tableName);
      const savedItem = inserted && inserted[0] ? inserted[0] : dbPayload;
      localItems.unshift(savedItem);
      saveLocalTable(this.tableName, localItems);

      return this._normalizeRow(savedItem);
    } catch (err) {
      console.error(`[Supabase Exception] Erro crítico ao inserir ${this.name} no Supabase:`, err.message || err);
      throw err;
    }
  }

  async update(id, patchData) {
    const rawPatch = {
      ...patchData,
      updated_at: new Date().toISOString(),
    };
    const dbPatch = this._prepareDbPayload(rawPatch, true);

    const localItems = getLocalTable(this.tableName);
    let updatedLocalItem = null;
    const newItems = localItems.map(item => {
      if (item.id === id) {
        updatedLocalItem = { ...item, ...rawPatch };
        return updatedLocalItem;
      }
      return item;
    });
    saveLocalTable(this.tableName, newItems);

    if (!isSupabaseConfigured || !supabase) {
      return this._normalizeRow(updatedLocalItem || { id, ...rawPatch });
    }

    try {
      const { data: updated, error } = await supabase.from(this.tableName).update(dbPatch).eq('id', id).select();
      if (error) throw error;
      if (updated && updated[0]) {
        return this._normalizeRow(updated[0]);
      }
      return this._normalizeRow(updatedLocalItem || { id, ...rawPatch });
    } catch (err) {
      console.warn(`[Supabase Warning] Falha ao atualizar ${this.name} no Supabase (atualizado localmente):`, err.message);
      return this._normalizeRow(updatedLocalItem || { id, ...rawPatch });
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
