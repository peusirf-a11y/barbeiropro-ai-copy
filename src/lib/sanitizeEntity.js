/**
 * sanitizeEntity — Serializers centrais para entidades sensíveis.
 *
 * REGRA: nenhum campo sensível (tokens, hashes, secrets internos) deve
 * retornar para o frontend ou para respostas de API.
 *
 * Uso: import { sanitizeCustomer, sanitizeAppointment } from '@/lib/sanitizeEntity';
 */

// ── CUSTOMER ──────────────────────────────────────────────────────────────────
// Campos NUNCA retornados:
//   password_hash, auth_token, auth_token_expires_at,
//   reset_token, reset_token_expires_at, token_version
const CUSTOMER_SAFE_FIELDS = [
  'id', 'company_id', 'unit_id', 'name', 'phone', 'email', 'notes', 'tags',
  'status', 'lifecycle_status', 'lifecycle_updated_at',
  'total_appointments', 'last_appointment_at', 'last_completed_at',
  'favorite_service', 'favorite_professional',
  'created_date', 'updated_date', 'created_by',
  'vip_dismissed_at', 'lifecycle_campaigns_log',
];

export function sanitizeCustomer(customer) {
  if (!customer) return null;
  return Object.fromEntries(
    CUSTOMER_SAFE_FIELDS.filter(f => f in customer).map(f => [f, customer[f]])
  );
}

export function sanitizeCustomers(customers) {
  if (!Array.isArray(customers)) return [];
  return customers.map(sanitizeCustomer);
}

// ── APPOINTMENT ───────────────────────────────────────────────────────────────
// Campos NUNCA retornados para o painel interno:
//   confirm_token, review_token, confirm_token_expires_at, review_token_expires_at,
//   payment_intent_id, payment_idempotency_key, payer_tax_id
const APPOINTMENT_SAFE_FIELDS = [
  'id', 'company_id', 'unit_id', 'customer_id', 'professional_id', 'service_id',
  'service_name', 'professional_name', 'customer_name', 'customer_phone', 'customer_email',
  'scheduled_at', 'status', 'notes', 'source', 'completed_at',
  'price', 'custom_duration_minutes', 'is_flexible_assignment',
  'confirmation_email_sent', 'payment_method', 'subscription_id',
  'paid', 'paid_at', 'paid_online', 'payment_status', 'payment_expires_at',
  'commission_created', 'confirmed_at', 'reviewed_at',
  'created_date', 'updated_date', 'created_by',
];

export function sanitizeAppointment(appt) {
  if (!appt) return null;
  return Object.fromEntries(
    APPOINTMENT_SAFE_FIELDS.filter(f => f in appt).map(f => [f, appt[f]])
  );
}

export function sanitizeAppointments(appointments) {
  if (!Array.isArray(appointments)) return [];
  return appointments.map(sanitizeAppointment);
}

// ── FINANCIAL ENTRY ──────────────────────────────────────────────────────────
// Campos NUNCA retornados: metadata interna Stripe, dados de payment intent
const FINANCIAL_ENTRY_SAFE_FIELDS = [
  'id', 'company_id', 'unit_id', 'cash_register_id', 'professional_id', 'customer_id',
  'type', 'entry_kind', 'origin', 'payment_method', 'category', 'description',
  'amount', 'date', 'status', 'reference_appointment_id', 'justification',
  'is_locked', 'edited_at', 'edited_by', 'deleted_at', 'deleted_by', 'deletion_reason',
  'created_date', 'updated_date', 'created_by',
];

export function sanitizeFinancialEntry(entry) {
  if (!entry) return null;
  return Object.fromEntries(
    FINANCIAL_ENTRY_SAFE_FIELDS.filter(f => f in entry).map(f => [f, entry[f]])
  );
}

// ── COMPANY ───────────────────────────────────────────────────────────────────
// Campos NUNCA retornados: stripe_connect_account_id, secrets internos
const COMPANY_PUBLIC_FIELDS = [
  'id', 'name', 'logo_url', 'primary_color', 'secondary_color', 'slug',
  'phone', 'whatsapp', 'address', 'business_hours', 'status', 'plan_name',
  'multi_unit_enabled', 'customers_shared_across_units',
  'onboarding_step', 'onboarding_completed',
  'subscription_status', 'trial_ends_at', 'current_period_end',
  'is_blocked_by_billing', 'whatsapp_settings', 'crm_settings',
  'stripe_connect_status', 'stripe_connect_charges_enabled',
  'stripe_connect_payouts_enabled', 'stripe_connect_pix_enabled',
  'created_date', 'updated_date',
];

// Campos extras para admin/owner
const COMPANY_ADMIN_EXTRA_FIELDS = [
  'owner_email', 'owner_name', 'plan_id', 'feature_overrides',
  'lifecycle_campaigns', 'address_details', 'business_type',
  'trial_email_d3_sent', 'trial_email_d1_sent',
];

export function sanitizeCompany(company, isAdmin = false) {
  if (!company) return null;
  const fields = isAdmin
    ? [...COMPANY_PUBLIC_FIELDS, ...COMPANY_ADMIN_EXTRA_FIELDS]
    : COMPANY_PUBLIC_FIELDS;
  return Object.fromEntries(
    fields.filter(f => f in company).map(f => [f, company[f]])
  );
}

// ── EXPORT LGPD ───────────────────────────────────────────────────────────────
// Remove campos operacionais internos do export LGPD (dados do titular somente)
export function sanitizeCustomerForLgpdExport(customer) {
  return {
    name: customer.name,
    phone: customer.phone,
    email: customer.email || null,
    notes: customer.notes || null,
    tags: customer.tags || [],
    status: customer.status,
    lifecycle_status: customer.lifecycle_status || null,
    registered_at: customer.created_date,
    last_appointment: customer.last_completed_at || null,
    total_appointments: customer.total_appointments || 0,
  };
}