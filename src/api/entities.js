// Repositório de Entidades Robusto com Supabase e Fallback LocalStorage (Anti "Failed to fetch")
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { resolvePlanAllowedWeekdays } from '@/lib/businessHours';

const ENTITY_TABLE_MAP = {
  Company: 'companies',
  Plan: 'plans',
  Customer: 'customers',
  Service: 'services',
  Professional: 'professionals',
  TeamMember: 'team_members',
  Appointment: 'appointments',
  CustomerSubscription: 'customer_subscriptions',
  CustomerPlan: 'plans',
  ServicePackage: 'service_packages',
  BlockedTime: 'blocked_times',
  SlotReservation: 'slot_reservations',
  CashRegister: 'cash_registers',
  FinancialEntry: 'financial_entries',
  Commission: 'commissions',
  Review: 'reviews',
  Unit: 'units',
  BarberCredential: 'barber_credentials',
  User: 'users',
  SystemAlert: 'system_alerts',
  AuditLog: 'audit_logs',
  AdminAuditLog: 'admin_audit_logs',
  PrivacyAuditLog: 'privacy_audit_logs',
  CookieConsentLog: 'cookie_consent_logs',
  CustomerConsent: 'customer_consents',
  FeatureFlag: 'feature_flags',
  IdempotencyKey: 'idempotency_keys',
  ImpersonationSession: 'impersonation_sessions',
  SecurityEvent: 'security_events',
  SecurityRateLimit: 'security_rate_limits',
  UserEvent: 'user_events',
  WhatsAppMessage: 'whatsapp_messages',
};

const CORE_REMOTE_ONLY_TABLES = new Set([
  'companies',
  'plans',
  'services',
  'professionals',
  'appointments',
  'customers',
]);

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

const FINANCIAL_ENTRY_COLUMNS = new Set([
  'id',
  'company_id',
  'type',
  'entry_kind',
  'description',
  'amount',
  'date',
  'status',
  'payment_method',
  'unit_id',
  'created_at',
]);

const PLAN_COLUMNS = new Set([
  'id',
  'company_id',
  'name',
  'description',
  'price_monthly',
  'type',
  'usage_limit',
  'recommended',
  'off_peak',
  'active',
  'sort_order',
  'created_at',
  'updated_at',
  'allowed_company_ids',
  'display_order',
  'limits',
  'features',
  'is_active',
  'visibility',
  'trial_days',
  'billing_cycle',
  'slug',
]);

const CUSTOMER_PLAN_META_KEYS = [
  'service_ids',
  'rollover',
  'valid_in_units',
  'off_peak_enabled',
  'off_peak_start',
  'off_peak_end',
  'off_peak_weekdays',
  'allowed_weekdays',
  'days_of_week',
  'valid_days',
  'allowed_customer_ids',
  'invite_token',
  'invite_token_uses',
  'invite_token_max_uses',
  'invite_token_expires_at',
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Colunas seguras da tabela companies (EXCLUI estritamente asaas_api_key para nunca trafegar ao browser)
export const PUBLIC_COMPANY_COLUMNS =
  'id, name, slug, logo_url, phone, whatsapp, address, primary_color, business_hours';

export const SAFE_COMPANY_COLUMNS =
  'id, name, slug, logo_url, phone, whatsapp, address, primary_color, business_hours, status, active, plan_id, plan_name, billing_status, subscription_status, trial_ends_at, current_period_end, card_last_digits, card_brand, asaas_customer_id, asaas_subscription_id, referral_code, free_months_balance, owner_name, owner_email, cnpj, owner_cpf_cnpj, onboarding_completed, created_at, updated_at';

export const BASE_COMPANY_COLUMNS =
  'id, name, slug, logo_url, phone, whatsapp, address, primary_color, business_hours, active, owner_email, created_at';


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
    const snakePlural =
      String(name || '')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toLowerCase() + 's';
    this.tableName = ENTITY_TABLE_MAP[name] || snakePlural;
  }

  _normalizeRow(row) {
    if (!row || typeof row !== 'object') return row;
    if (this.tableName === 'plans') {
      const meta = (row.limits && typeof row.limits === 'object' && row.limits._customer_plan_meta) || {};
      const out = { ...row, ...meta };
      out.active = out.active !== undefined ? Boolean(out.active) : Boolean(out.is_active ?? true);
      out.is_active = out.active;
      out.price_monthly = Number(out.price_monthly ?? out.price ?? 0);
      out.price = out.price_monthly;
      out.usage_limit = out.type === 'unlimited' ? 0 : Number(out.usage_limit ?? 0);
      out.off_peak = Boolean(out.off_peak ?? out.off_peak_enabled ?? false);
      out.off_peak_enabled = Boolean(out.off_peak_enabled ?? out.off_peak ?? false);
      const resolvedDays = resolvePlanAllowedWeekdays(out, null);
      if (resolvedDays) {
        out.allowed_weekdays = resolvedDays;
        out.off_peak_weekdays = resolvedDays;
      }
      out.service_ids = Array.isArray(out.service_ids) ? out.service_ids : [];
      out.valid_in_units = Array.isArray(out.valid_in_units) ? out.valid_in_units : [];
      out.allowed_customer_ids = Array.isArray(out.allowed_customer_ids) ? out.allowed_customer_ids : [];
      return out;
    }
    if (this.tableName === 'financial_entries') {
      const out = { ...row };
      out.type = out.type || out.entry_kind || 'entrada';
      out.entry_kind = out.entry_kind || out.type || 'entrada';
      out.amount = Number(out.amount || 0);
      out.category = out.category || (out.type === 'saida' ? 'Despesa' : 'Atendimento');
      return out;
    }
    if (this.tableName === 'companies') {
      const out = { ...row };
      // Proteção estrita: garante que o campo sensível asaas_api_key NUNCA trafegue para o browser
      delete out.asaas_api_key;
      const brandingMeta = out.business_hours?._branding || out.opening_hours?._branding || {};
      if (brandingMeta.primary_color) {
        out.primary_color = brandingMeta.primary_color;
      } else if (!out.primary_color) {
        try {
          const localCompanies = getLocalTable('companies');
          const localMatch = localCompanies.find(
            lc => (out.id && lc.id === out.id) || (out.slug && lc.slug === out.slug)
          );
          if (localMatch?.primary_color) {
            out.primary_color = localMatch.primary_color;
          }
        } catch (_) {}
      }
      if (!out.whatsapp && brandingMeta.whatsapp) out.whatsapp = brandingMeta.whatsapp;
      if (!out.address && brandingMeta.address) out.address = brandingMeta.address;
      if (!out.logo_url && brandingMeta.logo_url) out.logo_url = brandingMeta.logo_url;

      const billingMeta = out.business_hours?._billing || out.opening_hours?._billing || {};
      if (!out.card_last_digits && billingMeta.card_last_digits) {
        out.card_last_digits = billingMeta.card_last_digits;
      }
      if (!out.card_brand && billingMeta.card_brand) {
        out.card_brand = billingMeta.card_brand;
      }
      if (!out.plan_name && billingMeta.plan_name) {
        out.plan_name = billingMeta.plan_name;
      }
      if (!out.asaas_subscription_id && billingMeta.asaas_subscription_id) {
        out.asaas_subscription_id = billingMeta.asaas_subscription_id;
      }
      if (!out.asaas_customer_id && billingMeta.asaas_customer_id) {
        out.asaas_customer_id = billingMeta.asaas_customer_id;
      }
      if ((!out.subscription_status || out.subscription_status === 'trialing') && billingMeta.subscription_status) {
        out.subscription_status = billingMeta.subscription_status;
      }
      if (!out.billing_status && billingMeta.billing_status) {
        out.billing_status = billingMeta.billing_status;
      }
      if (!out.current_period_end && billingMeta.current_period_end) {
        out.current_period_end = billingMeta.current_period_end;
      }
      if (!out.asaas_payment_link_url && billingMeta.asaas_payment_link_url) {
        out.asaas_payment_link_url = billingMeta.asaas_payment_link_url;
      }
      return out;
    }
    if (this.tableName === 'customer_subscriptions') {
      const out = { ...row };
      let matchedPlan = null;
      if (out.plan_id) {
        try {
          const localPlans = getLocalTable('plans');
          matchedPlan = localPlans.find(p => String(p.id) === String(out.plan_id)) || null;
        } catch (_) {}
      }
      if (!out.plan_name && out.plan_name_snapshot) out.plan_name = out.plan_name_snapshot;
      if (!out.plan_name_snapshot && out.plan_name) out.plan_name_snapshot = out.plan_name;
      if (!out.plan_name && matchedPlan) {
        out.plan_name = matchedPlan.name;
        out.plan_name_snapshot = matchedPlan.name;
      }
      if (matchedPlan) {
        if (out.plan_price_snapshot === undefined) {
          out.plan_price_snapshot = Number(matchedPlan.price_monthly ?? matchedPlan.price ?? 0);
        }
        if (!out.plan_type_snapshot) {
          out.plan_type_snapshot = matchedPlan.type || 'unlimited';
        }
      }
      const resolvedDays = resolvePlanAllowedWeekdays(matchedPlan, out);
      if (resolvedDays) {
        out.allowed_weekdays = resolvedDays;
        out.off_peak_weekdays = resolvedDays;
      }
      if (!out.current_period_end && out.current_cycle_end) out.current_period_end = out.current_cycle_end;
      if (!out.current_cycle_end && out.current_period_end) out.current_cycle_end = out.current_period_end;
      if (!out.current_period_start && out.current_cycle_start) out.current_period_start = out.current_cycle_start;
      if (!out.current_cycle_start && out.current_period_start) out.current_cycle_start = out.current_period_start;
      return out;
    }
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

    if (this.tableName === 'financial_entries') {
      const kind = item.type || item.entry_kind || 'entrada';
      item.type = kind;
      item.entry_kind = kind;
      if (!isUpdate && !item.status) {
        item.status = 'confirmado';
      }
      if (!isUpdate && !item.date) {
        item.date = new Date().toISOString().split('T')[0];
      }
      if (item.unit_id && !UUID_REGEX.test(String(item.unit_id))) {
        item.unit_id = null;
      }
      const cleaned = {};
      for (const [k, v] of Object.entries(item)) {
        if (FINANCIAL_ENTRY_COLUMNS.has(k) && v !== undefined) {
          cleaned[k] = v;
        }
      }
      return cleaned;
    }

    if (this.tableName === 'plans') {
      if (item.price !== undefined && item.price_monthly === undefined) {
        item.price_monthly = Number(item.price || 0);
      }
      if (item.price_monthly !== undefined) {
        item.price_monthly = Number(item.price_monthly || 0);
      }
      if (item.active !== undefined && item.is_active === undefined) {
        item.is_active = Boolean(item.active);
      } else if (item.is_active !== undefined && item.active === undefined) {
        item.active = Boolean(item.is_active);
      }
      if (item.off_peak_enabled !== undefined && item.off_peak === undefined) {
        item.off_peak = Boolean(item.off_peak_enabled);
      }
      if (item.usage_limit === null || item.usage_limit === '') {
        item.usage_limit = 0;
      }
      const meta = {};
      let hasMeta = false;
      for (const k of CUSTOMER_PLAN_META_KEYS) {
        if (item[k] !== undefined) {
          meta[k] = item[k];
          hasMeta = true;
        }
      }
      if (hasMeta) {
        const baseLimits = item.limits && typeof item.limits === 'object' ? item.limits : {};
        item.limits = {
          ...baseLimits,
          _customer_plan_meta: {
            ...(baseLimits._customer_plan_meta || {}),
            ...meta,
          },
        };
      }
      const cleaned = {};
      for (const [k, v] of Object.entries(item)) {
        if (PLAN_COLUMNS.has(k) && v !== undefined) {
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
      const selectCols = this.tableName === 'companies' ? SAFE_COMPANY_COLUMNS : '*';
      let query = supabase.from(this.tableName).select(selectCols);
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
      let { data, error } = await query;
      if (error && this.tableName === 'companies') {
        let fbQuery = supabase.from('companies').select(BASE_COMPANY_COLUMNS);
        if (limit && limit > 0) fbQuery = fbQuery.limit(limit);
        const fbRes = await fbQuery;
        data = fbRes.data;
        error = fbRes.error;
      }
      if (error) throw error;
      if (this.tableName === 'appointments') {
        return await this._reconcileAndFilterAppointments(data || []);
      }
      let remoteRows = (data || []).map(r => this._normalizeRow(r));
      if (this.name === 'Plan') {
        remoteRows = remoteRows.filter(r => !r.company_id);
      } else if (this.name === 'CustomerPlan') {
        remoteRows = remoteRows.filter(r => Boolean(r.company_id));
      }
      if (!CORE_REMOTE_ONLY_TABLES.has(this.tableName)) {
        const localRows = getLocalTable(this.tableName).map(r => this._normalizeRow(r));
        const localMap = new Map(
          localRows.filter(lr => lr && lr.id).map(lr => [String(lr.id), lr])
        );
        remoteRows = remoteRows.map(rr => {
          const lr = rr && rr.id ? localMap.get(String(rr.id)) : null;
          if (!lr) return rr;
          return this._normalizeRow({ ...rr, ...lr });
        });
        const seen = new Set(remoteRows.map(r => String(r.id)));
        for (const lr of localRows) {
          if (lr && lr.id && !seen.has(String(lr.id))) {
            remoteRows.push(lr);
            seen.add(String(lr.id));
          }
        }
      }
      return remoteRows;
    } catch (err) {
      console.warn(`[Supabase Warning] Falha ao listar ${this.name} (${err.message}), usando dados locais.`, err);
      return getLocalTable(this.tableName).map(r => this._normalizeRow(r));
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

    const matchLocalCriteria = (item) => {
      return Object.entries(criteria).every(([k, v]) => {
        if (v === undefined || v === null) return true;
        if (typeof v === 'object' && !Array.isArray(v)) {
          if (v.$ne !== undefined && item[k] === v.$ne) return false;
          if (v.$gte !== undefined && item[k] < v.$gte) return false;
          if (v.$lte !== undefined && item[k] > v.$lte) return false;
          return true;
        }
        return item[k] === v;
      });
    };

    if (!isSupabaseConfigured || !supabase) {
      const items = getLocalTable(this.tableName).map(r => this._normalizeRow(r));
      return items.filter(matchLocalCriteria);
    }
    try {
      const isPublicSlugFilter =
        this.tableName === 'companies' &&
        Object.keys(criteria).length === 1 &&
        Boolean(criteria.slug);
      const selectCols =
        this.tableName === 'companies'
          ? isPublicSlugFilter
            ? PUBLIC_COMPANY_COLUMNS
            : SAFE_COMPANY_COLUMNS
          : '*';
      let query = supabase.from(this.tableName).select(selectCols);
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
      let { data, error } = await query;
      if (error && this.tableName === 'companies') {
        let fbQuery = supabase
          .from('companies')
          .select(isPublicSlugFilter ? PUBLIC_COMPANY_COLUMNS : BASE_COMPANY_COLUMNS);
        Object.entries(criteria).forEach(([key, val]) => {
          if (val !== undefined && val !== null && typeof val !== 'object') {
            fbQuery = fbQuery.eq(key, val);
          }
        });
        if (limit && limit > 0) fbQuery = fbQuery.limit(limit);
        const fbRes = await fbQuery;
        data = fbRes.data;
        error = fbRes.error;
      }
      if (error) throw error;
      if (this.tableName === 'appointments') {
        return await this._reconcileAndFilterAppointments(data || []);
      }
      let remoteRows = (data || []).map(r => this._normalizeRow(r));
      if (this.name === 'Plan' && criteria.company_id === undefined) {
        remoteRows = remoteRows.filter(r => !r.company_id);
      } else if (this.name === 'CustomerPlan') {
        remoteRows = remoteRows.filter(r => Boolean(r.company_id));
      }
      if (!CORE_REMOTE_ONLY_TABLES.has(this.tableName)) {
        const allLocalRows = getLocalTable(this.tableName).map(r => this._normalizeRow(r));
        const localMap = new Map(
          allLocalRows.filter(lr => lr && lr.id).map(lr => [String(lr.id), lr])
        );
        remoteRows = remoteRows
          .map(rr => {
            const lr = rr && rr.id ? localMap.get(String(rr.id)) : null;
            if (!lr) return rr;
            return this._normalizeRow({ ...rr, ...lr });
          })
          .filter(matchLocalCriteria);
        const localRows = allLocalRows.filter(matchLocalCriteria);
        const seen = new Set(remoteRows.map(r => String(r.id)));
        for (const lr of localRows) {
          if (lr && lr.id && !seen.has(String(lr.id))) {
            remoteRows.push(lr);
            seen.add(String(lr.id));
          }
        }
      }
      return remoteRows;
    } catch (err) {
      console.warn(`[Supabase Warning] Falha ao filtrar ${this.name}, usando fallback local.`, err);
      const items = getLocalTable(this.tableName).map(r => this._normalizeRow(r));
      return items.filter(matchLocalCriteria);
    }
  }

  async get(id) {
    if (!isSupabaseConfigured || !supabase) {
      const items = getLocalTable(this.tableName);
      return items.find(i => i.id === id) || null;
    }
    try {
      const selectCols = this.tableName === 'companies' ? SAFE_COMPANY_COLUMNS : '*';
      let { data, error } = await supabase.from(this.tableName).select(selectCols).eq('id', id).single();
      if (error && this.tableName === 'companies') {
        const fb = await supabase.from('companies').select(BASE_COMPANY_COLUMNS).eq('id', id).single();
        data = fb.data;
        error = fb.error;
      }
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
      const localItems = getLocalTable(this.tableName).filter(i => String(i.id) !== String(rawNewItem.id));
      localItems.unshift(rawNewItem);
      saveLocalTable(this.tableName, localItems);
      return this._normalizeRow(rawNewItem);
    }

    try {
      const selectCols = this.tableName === 'companies' ? BASE_COMPANY_COLUMNS : '*';
      let currentPayload = { ...dbPayload };
      let inserted = null;
      let error = null;

      for (let attempt = 0; attempt < 15; attempt++) {
        const res = await supabase.from(this.tableName).insert([currentPayload]).select(selectCols);
        inserted = res.data;
        error = res.error;
        if (!error) break;
        const msg = String(error.message || '');
        const colMatch =
          msg.match(/Could not find the '([^']+)' column/i) ||
          msg.match(/column "([^"]+)" of relation/i);
        if (colMatch && colMatch[1] && colMatch[1] in currentPayload) {
          delete currentPayload[colMatch[1]];
          continue;
        }
        break;
      }

      if (error) {
        if (
          error.code === '42501' ||
          error.code === 'PGRST204' ||
          error.code === 'PGRST205' ||
          !CORE_REMOTE_ONLY_TABLES.has(this.tableName)
        ) {
          const localItems = getLocalTable(this.tableName).filter(i => String(i.id) !== String(rawNewItem.id));
          localItems.unshift(rawNewItem);
          saveLocalTable(this.tableName, localItems);
          return this._normalizeRow(rawNewItem);
        }
        console.error(`[Supabase Error] Falha ao inserir ${this.name}:`, error);
        throw error;
      }

      const localItems = getLocalTable(this.tableName).filter(i => String(i.id) !== String(rawNewItem.id));
      const savedItem = inserted && inserted[0] ? { ...rawNewItem, ...inserted[0] } : rawNewItem;
      localItems.unshift(savedItem);
      saveLocalTable(this.tableName, localItems);

      return this._normalizeRow(savedItem);
    } catch (err) {
      if (
        err?.code === '42501' ||
        err?.code === 'PGRST204' ||
        err?.code === 'PGRST205' ||
        !CORE_REMOTE_ONLY_TABLES.has(this.tableName)
      ) {
        const localItems = getLocalTable(this.tableName).filter(i => String(i.id) !== String(rawNewItem.id));
        localItems.unshift(rawNewItem);
        saveLocalTable(this.tableName, localItems);
        return this._normalizeRow(rawNewItem);
      }
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
      if (String(item.id) === String(id)) {
        updatedLocalItem = { ...item, ...rawPatch };
        return updatedLocalItem;
      }
      return item;
    });
    if (!updatedLocalItem && !CORE_REMOTE_ONLY_TABLES.has(this.tableName)) {
      updatedLocalItem = { id, ...rawPatch };
      newItems.unshift(updatedLocalItem);
    }
    saveLocalTable(this.tableName, newItems);

    if (!isSupabaseConfigured || !supabase) {
      return this._normalizeRow(updatedLocalItem || { id, ...rawPatch });
    }

    try {
      const selectCols = this.tableName === 'companies' ? BASE_COMPANY_COLUMNS : '*';
      let currentPatch = { ...dbPatch };
      let updated = null;
      let error = null;

      for (let attempt = 0; attempt < 15; attempt++) {
        const res = await supabase.from(this.tableName).update(currentPatch).eq('id', id).select(selectCols);
        updated = res.data;
        error = res.error;
        if (!error) break;
        const msg = String(error.message || '');
        const colMatch =
          msg.match(/Could not find the '([^']+)' column/i) ||
          msg.match(/column "([^"]+)" of relation/i);
        if (colMatch && colMatch[1] && colMatch[1] in currentPatch) {
          delete currentPatch[colMatch[1]];
          continue;
        }
        break;
      }

      if (error) throw error;
      if (updated && updated[0]) {
        const mergedItems = getLocalTable(this.tableName).map(item =>
          String(item.id) === String(id) ? { ...item, ...updated[0], ...rawPatch } : item
        );
        saveLocalTable(this.tableName, mergedItems);
        return this._normalizeRow({ ...updated[0], ...rawPatch });
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
export const BlockedTime = new EntityRepository('BlockedTime');
export const CustomerPlan = new EntityRepository('CustomerPlan');
export const CustomerSubscription = new EntityRepository('CustomerSubscription');

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
  BlockedTime,
  CustomerPlan,
  CustomerSubscription,
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
