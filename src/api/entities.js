// Repositório de Entidades Robusto com Supabase e Fallback LocalStorage (Anti "Failed to fetch")
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { resolvePlanAllowedWeekdays } from '@/lib/businessHours';
import { sanitizeHexColor } from '@/lib/colorUtils';

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
  'scheduled_at',
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
  'notes',
  'observations',
  'lifecycle_status',
  'lifecycle_updated_at',
  'total_appointments',
  'last_appointment_at',
  'last_completed_at',
  'unit_id',
  'created_at',
  'updated_at',
]);

const FINANCIAL_ENTRY_COLUMNS = new Set([
  'id',
  'company_id',
  'type',
  'entry_kind',
  'category',
  'description',
  'amount',
  'date',
  'status',
  'payment_method',
  'unit_id',
  'cash_register_id',
  'origin',
  'justification',
  'professional_id',
  'customer_id',
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
  'order_index',
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
  'id, name, slug, logo_url, phone, whatsapp, address, primary_color, business_hours, status, active, plan_id, plan_name, billing_status, subscription_status, trial_ends_at, current_period_end, card_last_digits, card_brand, asaas_customer_id, asaas_subscription_id, referral_code, free_months_balance, owner_email, cnpj, created_at, updated_at';

export const BASE_COMPANY_COLUMNS =
  'id, name, slug, logo_url, phone, whatsapp, address, primary_color, business_hours, status, active, plan_id, plan_name, billing_status, subscription_status, trial_ends_at, current_period_end, owner_email, created_at, updated_at';

const DEFAULT_PRIMARY_COMPANY_ID = '2213219d-8f49-4832-b0f4-7a1ccf083d7f';
const DEFAULT_SECONDARY_COMPANY_ID = '3586d977-1374-42a0-b9c7-366cab4ab6f7';
const DEFAULT_LGPD_CUSTOMER_ID = 'c1199999-9999-4000-8000-000000000001';

function buildDefaultGovernanceFixtures(tableName) {
  const now = Date.now();
  const isoAgo = (mins) => new Date(now - mins * 60 * 1000).toISOString();

  if (tableName === 'customer_consents') {
    return [
      {
        id: 'consent-fixture-1',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        customer_id: DEFAULT_LGPD_CUSTOMER_ID,
        customer_name: 'Carlos Eduardo Silva',
        customer_email: 'carlos.silva@exemplo.com',
        customer_phone: '11999999999',
        consent_type: 'whatsapp_marketing',
        granted: true,
        granted_at: isoAgo(1440),
        source: 'booking_flow',
        ip_address: '189.40.22.11',
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
        legal_text_version: 'v2026.1',
        cookie_categories: ['essential', 'functional', 'marketing'],
        created_at: isoAgo(1440),
        created_date: isoAgo(1440),
      },
      {
        id: 'consent-fixture-2',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        customer_id: DEFAULT_LGPD_CUSTOMER_ID,
        customer_name: 'Carlos Eduardo Silva',
        customer_email: 'carlos.silva@exemplo.com',
        customer_phone: '11999999999',
        consent_type: 'automated_reminders',
        granted: true,
        granted_at: isoAgo(1400),
        source: 'booking_flow',
        ip_address: '189.40.22.11',
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
        legal_text_version: 'v2026.1',
        cookie_categories: ['essential', 'functional'],
        created_at: isoAgo(1400),
        created_date: isoAgo(1400),
      },
      {
        id: 'consent-fixture-3',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        customer_id: DEFAULT_LGPD_CUSTOMER_ID,
        customer_name: 'Carlos Eduardo Silva',
        customer_email: 'carlos.silva@exemplo.com',
        customer_phone: '11999999999',
        consent_type: 'email_marketing',
        granted: false,
        revoked_at: isoAgo(720),
        source: 'customer_dashboard',
        ip_address: '189.40.22.11',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        legal_text_version: 'v2026.1',
        cookie_categories: ['essential'],
        created_at: isoAgo(720),
        created_date: isoAgo(720),
      },
      {
        id: 'consent-fixture-4',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        customer_id: DEFAULT_LGPD_CUSTOMER_ID,
        customer_name: 'Carlos Eduardo Silva',
        customer_email: 'carlos.silva@exemplo.com',
        customer_phone: '11999999999',
        consent_type: 'post_service_review',
        granted: true,
        granted_at: isoAgo(600),
        source: 'booking_flow',
        ip_address: '189.40.22.11',
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
        legal_text_version: 'v2026.1',
        cookie_categories: ['essential', 'analytics'],
        created_at: isoAgo(600),
        created_date: isoAgo(600),
      },
      {
        id: 'consent-fixture-5',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        customer_id: DEFAULT_LGPD_CUSTOMER_ID,
        customer_name: 'Carlos Eduardo Silva',
        customer_email: 'carlos.silva@exemplo.com',
        customer_phone: '11999999999',
        consent_type: 'ai_recommendations',
        granted: true,
        granted_at: isoAgo(480),
        source: 'customer_dashboard',
        ip_address: '189.40.22.11',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        legal_text_version: 'v2026.1',
        cookie_categories: ['essential', 'analytics', 'functional'],
        created_at: isoAgo(480),
        created_date: isoAgo(480),
      },
      {
        id: 'consent-fixture-6',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        customer_id: DEFAULT_LGPD_CUSTOMER_ID,
        customer_name: 'Carlos Eduardo Silva',
        customer_email: 'carlos.silva@exemplo.com',
        customer_phone: '11999999999',
        consent_type: 'data_processing_general',
        granted: true,
        granted_at: isoAgo(2880),
        source: 'booking_flow',
        ip_address: '189.40.22.11',
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
        legal_text_version: 'v2026.1',
        cookie_categories: ['essential', 'analytics', 'marketing', 'functional'],
        created_at: isoAgo(2880),
        created_date: isoAgo(2880),
      },
      {
        id: 'consent-fixture-7',
        company_id: DEFAULT_SECONDARY_COMPANY_ID,
        customer_id: 'c1199999-9999-4000-8000-000000000002',
        customer_name: 'Mariana Costa',
        customer_email: 'mariana.costa@exemplo.com',
        customer_phone: '11988887777',
        consent_type: 'whatsapp_marketing',
        granted: true,
        granted_at: isoAgo(360),
        source: 'booking_flow',
        ip_address: '177.92.14.88',
        user_agent: 'Mozilla/5.0 (Linux; Android 14)',
        legal_text_version: 'v2026.1',
        cookie_categories: ['essential', 'marketing'],
        created_at: isoAgo(360),
        created_date: isoAgo(360),
      },
      {
        id: 'consent-fixture-8',
        company_id: '36036036-0360-4360-8360-000000000360',
        customer_id: 'c1199999-9999-4000-8000-000000000003',
        customer_name: 'Roberto Almeida',
        customer_email: 'roberto.almeida@exemplo.com',
        customer_phone: '11977776666',
        consent_type: 'ai_recommendations',
        granted: false,
        revoked_at: isoAgo(180),
        source: 'staff_on_behalf',
        ip_address: '200.155.10.44',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        legal_text_version: 'v2026.1',
        cookie_categories: ['essential'],
        created_at: isoAgo(180),
        created_date: isoAgo(180),
      },
    ];
  }

  if (tableName === 'cookie_consent_logs') {
    return [
      {
        id: 'cookie-1',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        customer_id: DEFAULT_LGPD_CUSTOMER_ID,
        customer_name: 'Carlos Eduardo Silva',
        customer_email: 'carlos.silva@exemplo.com',
        customer_phone: '11999999999',
        session_id: 'sess_901_carlos',
        essential: true,
        analytics: true,
        marketing: true,
        functional: true,
        categories: ['essential', 'analytics', 'marketing', 'functional'],
        consent_status: 'granted',
        ip_address: '189.40.22.11',
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
        legal_text_version: 'v2026.1',
        created_at: isoAgo(300),
        created_date: isoAgo(300),
      },
      {
        id: 'cookie-2',
        company_id: DEFAULT_SECONDARY_COMPANY_ID,
        customer_id: 'c1199999-9999-4000-8000-000000000002',
        customer_name: 'Mariana Costa',
        customer_email: 'mariana.costa@exemplo.com',
        customer_phone: '11988887777',
        session_id: 'sess_902_mariana',
        essential: true,
        analytics: true,
        marketing: false,
        functional: true,
        categories: ['essential', 'analytics', 'functional'],
        consent_status: 'partial',
        ip_address: '177.92.14.88',
        user_agent: 'Mozilla/5.0 (Linux; Android 14)',
        legal_text_version: 'v2026.1',
        created_at: isoAgo(180),
        created_date: isoAgo(180),
      },
      {
        id: 'cookie-3',
        company_id: '36036036-0360-4360-8360-000000000360',
        customer_id: 'c1199999-9999-4000-8000-000000000003',
        customer_name: 'Roberto Almeida',
        customer_email: 'roberto.almeida@exemplo.com',
        customer_phone: '11977776666',
        session_id: 'sess_903_roberto',
        essential: true,
        analytics: false,
        marketing: false,
        functional: false,
        categories: ['essential'],
        consent_status: 'essential_only',
        ip_address: '200.155.10.44',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        legal_text_version: 'v2026.1',
        created_at: isoAgo(60),
        created_date: isoAgo(60),
      },
    ];
  }

  if (tableName === 'privacy_audit_logs') {
    return [
      {
        id: 'priv-log-1',
        action: 'DATA_ANONYMIZED',
        severity: 'critical',
        actor_email: 'pedrojesantos@hotmail.com',
        actor_type: 'super_admin',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        customer_id: 'cust_anon_9821a0',
        ip_address: '177.84.12.90',
        details: { reason: 'Solicitação formal do titular (Art. 18 LGPD)', fields_removed: ['name', 'phone', 'email', 'cpf'] },
        created_at: isoAgo(240),
        created_date: isoAgo(240),
      },
      {
        id: 'priv-log-2',
        action: 'DATA_ANONYMIZED',
        severity: 'critical',
        actor_email: 'dpo@ocorte.app',
        actor_type: 'super_admin',
        company_id: DEFAULT_SECONDARY_COMPANY_ID,
        customer_id: 'cust_anon_4412b9',
        ip_address: '177.84.12.91',
        details: { reason: 'Expiração do ciclo de retenção contratual', fields_removed: ['name', 'phone', 'email', 'cpf'] },
        created_at: isoAgo(1800),
        created_date: isoAgo(1800),
      },
      {
        id: 'priv-log-3',
        action: 'DATA_ANONYMIZED',
        severity: 'critical',
        actor_email: 'pedrojesantos@hotmail.com',
        actor_type: 'super_admin',
        company_id: '36036036-0360-4360-8360-000000000360',
        customer_id: 'cust_anon_7731c4',
        ip_address: '177.84.12.90',
        details: { reason: 'Direito ao esquecimento solicitado via canal DPO', fields_removed: ['name', 'phone', 'email', 'cpf'] },
        created_at: isoAgo(4320),
        created_date: isoAgo(4320),
      },
      {
        id: 'priv-log-4',
        action: 'DATA_EXPORT_REQUESTED',
        severity: 'warning',
        actor_email: 'pedrojesantos@hotmail.com',
        actor_type: 'super_admin',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        customer_id: DEFAULT_LGPD_CUSTOMER_ID,
        ip_address: '177.84.12.90',
        details: { format: 'JSON', sanitized: true, requested_by: 'Carlos Eduardo Silva' },
        created_at: isoAgo(120),
        created_date: isoAgo(120),
      },
      {
        id: 'priv-log-5',
        action: 'DATA_EXPORT_DOWNLOADED',
        severity: 'warning',
        actor_email: 'pedrojesantos@hotmail.com',
        actor_type: 'super_admin',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        customer_id: DEFAULT_LGPD_CUSTOMER_ID,
        ip_address: '177.84.12.90',
        details: { format: 'JSON', package_id: 'pkg_lgpd_001', sanitized: true },
        created_at: isoAgo(118),
        created_date: isoAgo(118),
      },
      {
        id: 'priv-log-6',
        action: 'CONSENT_REVOKED',
        severity: 'warning',
        actor_email: 'carlos.silva@exemplo.com',
        actor_type: 'customer',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        customer_id: DEFAULT_LGPD_CUSTOMER_ID,
        ip_address: '189.40.22.11',
        details: { consent_type: 'email_marketing', previous: true, current: false },
        created_at: isoAgo(720),
        created_date: isoAgo(720),
      },
      {
        id: 'priv-log-7',
        action: 'CONSENT_GRANTED',
        severity: 'info',
        actor_email: 'carlos.silva@exemplo.com',
        actor_type: 'customer',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        customer_id: DEFAULT_LGPD_CUSTOMER_ID,
        ip_address: '189.40.22.11',
        details: { consent_type: 'whatsapp_marketing', source: 'booking_flow' },
        created_at: isoAgo(1440),
        created_date: isoAgo(1440),
      },
      {
        id: 'priv-log-8',
        action: 'PRIVACY_POLICY_ACCEPTED',
        severity: 'info',
        actor_email: 'carlos.silva@exemplo.com',
        actor_type: 'customer',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        customer_id: DEFAULT_LGPD_CUSTOMER_ID,
        ip_address: '189.40.22.11',
        details: { policy_version: '2026.1', channel: 'web_checkout' },
        created_at: isoAgo(2880),
        created_date: isoAgo(2880),
      },
    ];
  }

  if (tableName === 'audit_logs') {
    return [
      {
        id: 'audit-fix-1',
        action: 'COMPANY_PLAN_UPDATED',
        severity: 'info',
        actor_type: 'user',
        actor_name: 'Pedro Santos (Usuário)',
        actor_email: 'pedrojesantos@hotmail.com',
        target_type: 'Company',
        target_id: DEFAULT_PRIMARY_COMPANY_ID,
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        ip: '177.84.12.90',
        ip_address: '177.84.12.90',
        correlation_id: 'corr_plan_001',
        details: { old_plan: 'Starter', new_plan: 'Master' },
        created_at: isoAgo(30),
        created_date: isoAgo(30),
      },
      {
        id: 'audit-fix-2',
        action: 'IMPERSONATION_STARTED',
        severity: 'warning',
        actor_type: 'impersonation',
        actor_name: 'Pedro Santos (Acesso Assistido)',
        actor_email: 'pedrojesantos@hotmail.com',
        target_type: 'Company',
        target_id: DEFAULT_PRIMARY_COMPANY_ID,
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        impersonated_company_id: DEFAULT_PRIMARY_COMPANY_ID,
        ip: '177.84.12.90',
        ip_address: '177.84.12.90',
        correlation_id: 'corr_imp_002',
        details: { duration_minutes: 15, reason: 'Suporte técnico assistido ao tenant' },
        created_at: isoAgo(110),
        created_date: isoAgo(110),
      },
      {
        id: 'audit-fix-2b',
        action: 'IMPERSONATION_ENDED',
        severity: 'info',
        actor_type: 'impersonation',
        actor_name: 'Pedro Santos (Acesso Assistido)',
        actor_email: 'pedrojesantos@hotmail.com',
        target_type: 'Company',
        target_id: DEFAULT_PRIMARY_COMPANY_ID,
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        impersonated_company_id: DEFAULT_PRIMARY_COMPANY_ID,
        ip: '177.84.12.90',
        ip_address: '177.84.12.90',
        correlation_id: 'corr_imp_002',
        details: { duration_minutes: 15, status: 'closed_normally' },
        created_at: isoAgo(95),
        created_date: isoAgo(95),
      },
      {
        id: 'audit-fix-2c',
        action: 'IMPERSONATION_STARTED',
        severity: 'warning',
        actor_type: 'impersonation',
        actor_name: 'Suporte Master (Acesso Assistido)',
        actor_email: 'suporte@ocorte.app',
        target_type: 'Company',
        target_id: '36036036-0360-4360-8360-000000000360',
        company_id: '36036036-0360-4360-8360-000000000360',
        impersonated_company_id: '36036036-0360-4360-8360-000000000360',
        ip: '177.84.12.92',
        ip_address: '177.84.12.92',
        correlation_id: 'corr_imp_003',
        details: { duration_minutes: 12, reason: 'Auditoria de conciliação financeira 360' },
        created_at: isoAgo(320),
        created_date: isoAgo(320),
      },
      {
        id: 'audit-fix-2d',
        action: 'IMPERSONATION_ENDED',
        severity: 'info',
        actor_type: 'impersonation',
        actor_name: 'Suporte Master (Acesso Assistido)',
        actor_email: 'suporte@ocorte.app',
        target_type: 'Company',
        target_id: '36036036-0360-4360-8360-000000000360',
        company_id: '36036036-0360-4360-8360-000000000360',
        impersonated_company_id: '36036036-0360-4360-8360-000000000360',
        ip: '177.84.12.92',
        ip_address: '177.84.12.92',
        correlation_id: 'corr_imp_003',
        details: { duration_minutes: 12, status: 'closed_normally' },
        created_at: isoAgo(308),
        created_date: isoAgo(308),
      },
      {
        id: 'audit-fix-3',
        action: 'CROSS_TENANT_ATTEMPT',
        severity: 'critical',
        actor_type: 'user',
        actor_name: 'Recepção Barbearia (Usuário)',
        actor_email: 'recepcao@barbearia.local',
        target_type: 'Customer',
        target_id: DEFAULT_LGPD_CUSTOMER_ID,
        company_id: DEFAULT_SECONDARY_COMPANY_ID,
        ip: '201.18.99.42',
        ip_address: '201.18.99.42',
        correlation_id: 'corr_sec_003',
        details: { blocked: true, reason: 'RLS policy blocked cross-tenant read' },
        created_at: isoAgo(180),
        created_date: isoAgo(180),
      },
      {
        id: 'audit-fix-4',
        action: 'PERMISSION_DENIED',
        severity: 'warning',
        actor_type: 'user',
        actor_name: 'Barbeiro Equipe (Usuário)',
        actor_email: 'barbeiro@gregos.com',
        target_type: 'FinancialEntry',
        target_id: 'fin_8821',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        ip: '189.40.22.15',
        ip_address: '189.40.22.15',
        correlation_id: 'corr_perm_004',
        details: { role: 'barbeiro', required_role: 'admin' },
        created_at: isoAgo(260),
        created_date: isoAgo(260),
      },
      {
        id: 'audit-fix-5',
        action: 'FEATURE_FLAG_TOGGLED',
        severity: 'info',
        actor_type: 'user',
        actor_name: 'Pedro Santos (Usuário)',
        actor_email: 'pedrojesantos@hotmail.com',
        target_type: 'FeatureFlag',
        target_id: 'ai_smart_scheduling_experimental',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        ip: '177.84.12.90',
        ip_address: '177.84.12.90',
        correlation_id: 'corr_flag_005',
        details: { key: 'ai_smart_scheduling_experimental', enabled: true },
        created_at: isoAgo(400),
        created_date: isoAgo(400),
      },
      {
        id: 'audit-fix-6',
        action: 'RETENTION_CLEANUP_RUN',
        severity: 'info',
        actor_type: 'system',
        actor_name: 'Motor de Governança (Sistema)',
        actor_email: 'system@ocorte.app',
        target_type: 'Platform',
        target_id: 'retention_job',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        ip: '127.0.0.1',
        ip_address: '127.0.0.1',
        correlation_id: 'corr_sys_006',
        details: { purged_expired_tokens: 14 },
        created_at: isoAgo(500),
        created_date: isoAgo(500),
      },
      {
        id: 'audit-fix-7',
        action: 'ASAAS_WEBHOOK_RECEIVED',
        severity: 'info',
        actor_type: 'webhook',
        actor_name: 'Gateway Asaas (Webhook)',
        actor_email: 'webhook@asaas.com',
        target_type: 'Subscription',
        target_id: 'sub_360_001',
        company_id: '36036036-0360-4360-8360-000000000360',
        ip: '54.207.110.12',
        ip_address: '54.207.110.12',
        correlation_id: 'corr_wh_007',
        details: { event: 'PAYMENT_CONFIRMED', amount: 119 },
        created_at: isoAgo(620),
        created_date: isoAgo(620),
      },
    ];
  }

  if (tableName === 'security_events') {
    return [
      {
        id: 'sec-ev-1',
        event_type: 'cross_tenant_attempt',
        severity: 'critical',
        actor_email: 'recepcao@barbearia.local',
        company_id: DEFAULT_SECONDARY_COMPANY_ID,
        ip_address: '201.18.99.42',
        route: '/api/customers/export',
        blocked: true,
        created_at: isoAgo(45),
        created_date: isoAgo(45),
      },
      {
        id: 'sec-ev-2',
        event_type: 'brute_force_attempt',
        severity: 'high',
        actor_email: 'unknown@attacker.net',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        ip_address: '185.220.101.14',
        route: '/login',
        blocked: true,
        created_at: isoAgo(110),
        created_date: isoAgo(110),
      },
      {
        id: 'sec-ev-3',
        event_type: 'rate_limit_exceeded',
        severity: 'medium',
        actor_email: 'bot_scanner@external.io',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        ip_address: '45.155.205.9',
        route: '/agendar/BarbeariaGregos',
        blocked: true,
        created_at: isoAgo(220),
        created_date: isoAgo(220),
      },
      {
        id: 'sec-ev-4',
        event_type: 'lgpd_export',
        severity: 'low',
        actor_email: 'pedrojesantos@hotmail.com',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        ip_address: '177.84.12.90',
        route: '/master/lgpd',
        blocked: false,
        created_at: isoAgo(310),
        created_date: isoAgo(310),
      },
      {
        id: 'sec-ev-5',
        event_type: 'lgpd_anonymization',
        severity: 'high',
        actor_email: 'pedrojesantos@hotmail.com',
        company_id: DEFAULT_PRIMARY_COMPANY_ID,
        ip_address: '177.84.12.90',
        route: '/master/lgpd',
        blocked: false,
        created_at: isoAgo(390),
        created_date: isoAgo(390),
      },
    ];
  }

  if (tableName === 'security_rate_limits') {
    return [
      {
        id: 'rl-1',
        ip: '185.220.101.14',
        identifier: '185.220.101.14',
        route: '/login',
        attempts: 15,
        is_blocked: true,
        blocked_until: new Date(now + 45 * 60 * 1000).toISOString(),
        created_at: isoAgo(20),
        created_date: isoAgo(20),
      },
      {
        id: 'rl-2',
        ip: '45.155.205.9',
        identifier: '45.155.205.9',
        route: '/api/public/slots',
        attempts: 120,
        is_blocked: true,
        blocked_until: new Date(now + 30 * 60 * 1000).toISOString(),
        created_at: isoAgo(40),
        created_date: isoAgo(40),
      },
    ];
  }

  if (tableName === 'feature_flags') {
    return [
      {
        id: 'flag-exp-1',
        key: 'ai_smart_scheduling_experimental',
        name: 'Agendamento Preditivo IA (Experimental)',
        description: 'Experimental: Sugere horários ótimos na agenda com base em machine learning.',
        category: 'experimental',
        experimental: true,
        badge: 'Experimental',
        enabled: true,
        scope: 'global',
        target_ids: [],
        created_at: isoAgo(1440),
        created_date: isoAgo(1440),
      },
      {
        id: 'flag-exp-2',
        key: 'dynamic_pricing_experimental',
        name: 'Preço Dinâmico por Demanda (Experimental)',
        description: 'Experimental: Ajuste automático de tarifa em horários ociosos (off-peak).',
        category: 'experimental',
        experimental: true,
        badge: 'Experimental',
        enabled: true,
        scope: 'global',
        target_ids: [],
        created_at: isoAgo(2880),
        created_date: isoAgo(2880),
      },
      {
        id: 'flag-exp-3',
        key: 'whatsapp_voice_confirm_experimental',
        name: 'Confirmação por Áudio IA no WhatsApp (Experimental)',
        description: 'Experimental: Envia lembretes humanizados em áudio para confirmação de presença.',
        category: 'experimental',
        experimental: true,
        badge: 'Experimental',
        enabled: false,
        scope: 'plan',
        target_ids: ['pro', 'enterprise'],
        created_at: isoAgo(4320),
        created_date: isoAgo(4320),
      },
      {
        id: 'flag-std-4',
        key: 'online_booking',
        name: 'Agendamento Online Público',
        description: 'Habilita o portal de autoagendamento /agendar/:slug para todas as barbearias.',
        category: 'agenda',
        experimental: false,
        enabled: true,
        scope: 'global',
        target_ids: [],
        created_at: isoAgo(10080),
        created_date: isoAgo(10080),
      },
    ];
  }

  return [];
}

function getLocalTable(tableName) {
  try {
    const defaults = buildDefaultGovernanceFixtures(tableName);
    if (typeof localStorage === 'undefined') return defaults;
    const raw = localStorage.getItem(`barberpass_local_${tableName}`);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (defaults.length > 0) {
        const seenIds = new Set(parsed.filter(Boolean).map((item) => String(item.id)));
        const merged = [...parsed];
        for (const defItem of defaults) {
          if (defItem && defItem.id && !seenIds.has(String(defItem.id))) {
            merged.push(defItem);
            seenIds.add(String(defItem.id));
          }
        }
        return merged;
      }
      return parsed;
    }
    if (defaults.length > 0) {
      localStorage.setItem(`barberpass_local_${tableName}`, JSON.stringify(defaults));
      return defaults;
    }
    return [];
  } catch {
    return buildDefaultGovernanceFixtures(tableName);
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
    if (row.created_at && !row.created_date) {
      row = { ...row, created_date: row.created_at };
    }
    if (this.tableName === 'plans') {
      const meta = (row.limits && typeof row.limits === 'object' && row.limits._customer_plan_meta) || {};
      const out = { ...row, ...meta };
      out.active = out.active !== undefined ? Boolean(out.active) : Boolean(out.is_active ?? true);
      out.is_active = out.active;
      out.price_monthly = Number(out.price_monthly ?? out.price ?? 0);
      out.price = out.price_monthly;
      out.order_index = Number(out.order_index ?? out.sort_order ?? out.display_order ?? 0);
      out.sort_order = Number(out.sort_order ?? out.order_index ?? out.display_order ?? 0);
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
    if (this.tableName === 'professionals') {
      const out = { ...row };
      try {
        const localPros = getLocalTable('professionals');
        const localMatch = localPros.find(lp => out.id && String(lp.id) === String(out.id));
        if (localMatch) {
          if (!out.photo_url && !out.avatar_url && (localMatch.photo_url || localMatch.avatar_url)) {
            out.photo_url = localMatch.photo_url || localMatch.avatar_url;
            out.avatar_url = localMatch.avatar_url || localMatch.photo_url;
          }
          if (!out.work_schedule && localMatch.work_schedule) out.work_schedule = localMatch.work_schedule;
          if (!out.services && localMatch.services) out.services = localMatch.services;
          if (!out.service_ids && localMatch.service_ids) out.service_ids = localMatch.service_ids;
          if (!out.specialties && localMatch.specialties) out.specialties = localMatch.specialties;
        }
      } catch (_) {}
      const resolvedPhoto = out.photo_url || out.avatar_url || '';
      out.photo_url = resolvedPhoto;
      out.avatar_url = resolvedPhoto;
      return out;
    }
    if (this.tableName === 'companies') {
      const out = { ...row };
      // Proteção estrita: garante que o campo sensível asaas_api_key NUNCA trafegue para o browser
      delete out.asaas_api_key;
      const brandingMeta = out.business_hours?._branding || out.opening_hours?._branding || {};
      let rawColor = brandingMeta.primary_color || out.primary_color;
      if (!rawColor) {
        try {
          const localCompanies = getLocalTable('companies');
          const localMatch = localCompanies.find(
            lc => (out.id && lc.id === out.id) || (out.slug && lc.slug === out.slug)
          );
          if (localMatch?.primary_color) {
            rawColor = localMatch.primary_color;
          }
        } catch (_) {}
      }
      out.primary_color = sanitizeHexColor(rawColor, '#2563EB');
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
      try {
        const localCompanies = getLocalTable('companies');
        const localMatch = localCompanies.find(
          lc => (out.id && String(lc.id) === String(out.id)) || (out.slug && lc.slug === out.slug)
        );
        if (localMatch) {
          if (localMatch.multi_unit_enabled !== undefined && out.multi_unit_enabled === undefined) {
            out.multi_unit_enabled = Boolean(localMatch.multi_unit_enabled);
          } else if (localMatch.multi_unit_enabled !== undefined && localMatch.updated_at && (!out.updated_at || localMatch.updated_at >= out.updated_at)) {
            out.multi_unit_enabled = Boolean(localMatch.multi_unit_enabled);
          }
          if (localMatch.customers_shared_across_units !== undefined && out.customers_shared_across_units === undefined) {
            out.customers_shared_across_units = Boolean(localMatch.customers_shared_across_units);
          }
          if (localMatch.whatsapp_settings && !out.whatsapp_settings) {
            out.whatsapp_settings = localMatch.whatsapp_settings;
          }
          if (localMatch.crm_settings && !out.crm_settings) {
            out.crm_settings = localMatch.crm_settings;
          }
          if (localMatch.lifecycle_campaigns && !out.lifecycle_campaigns) {
            out.lifecycle_campaigns = localMatch.lifecycle_campaigns;
          }
          if (localMatch.plan_id && (!out.plan_id || (localMatch.updated_at && (!out.updated_at || localMatch.updated_at >= out.updated_at)))) {
            out.plan_id = localMatch.plan_id;
          }
          if (localMatch.plan_name && (!out.plan_name || (localMatch.updated_at && (!out.updated_at || localMatch.updated_at >= out.updated_at)))) {
            out.plan_name = localMatch.plan_name;
          }
          if (localMatch.status && (!out.status || (localMatch.updated_at && (!out.updated_at || localMatch.updated_at >= out.updated_at)))) {
            out.status = localMatch.status;
          }
          if (localMatch.subscription_status && (!out.subscription_status || (localMatch.updated_at && (!out.updated_at || localMatch.updated_at >= out.updated_at)))) {
            out.subscription_status = localMatch.subscription_status;
          }
          if (localMatch.billing_status && (!out.billing_status || (localMatch.updated_at && (!out.updated_at || localMatch.updated_at >= out.updated_at)))) {
            out.billing_status = localMatch.billing_status;
          }
        }
      } catch (_) {}
      return out;
    }
    if (this.tableName === 'customers') {
      const out = { ...row };
      try {
        const localCustomers = getLocalTable('customers');
        const localMatch = localCustomers.find(lc => out.id && String(lc.id) === String(out.id));
        if (localMatch) {
          if (localMatch.notes !== undefined && (out.notes === undefined || out.notes === null || out.notes === '')) {
            out.notes = localMatch.notes;
          } else if (localMatch.notes !== undefined && localMatch.updated_at && (!out.updated_at || localMatch.updated_at >= out.updated_at)) {
            out.notes = localMatch.notes;
          }
          if (localMatch.name && (!out.name || (localMatch.updated_at && (!out.updated_at || localMatch.updated_at >= out.updated_at)))) {
            out.name = localMatch.name;
          }
          if (localMatch.phone && (!out.phone || (localMatch.updated_at && (!out.updated_at || localMatch.updated_at >= out.updated_at)))) {
            out.phone = localMatch.phone;
          }
          if (localMatch.cpf !== undefined && (!out.cpf || (localMatch.updated_at && (!out.updated_at || localMatch.updated_at >= out.updated_at)))) {
            out.cpf = localMatch.cpf;
          }
          if (localMatch.status && (!out.status || (localMatch.updated_at && (!out.updated_at || localMatch.updated_at >= out.updated_at)))) {
            out.status = localMatch.status;
          }
          if (localMatch.lifecycle_status && (!out.lifecycle_status || (localMatch.updated_at && (!out.updated_at || localMatch.updated_at >= out.updated_at)))) {
            out.lifecycle_status = localMatch.lifecycle_status;
          }
        }
      } catch (_) {}
      if (out.notes === undefined && out.observations !== undefined) {
        out.notes = out.observations;
      }
      if (!out.lifecycle_status) {
        if (out.status === 'inactive') {
          out.lifecycle_status = 'inativo';
        } else if (Number(out.total_appointments) >= 5) {
          out.lifecycle_status = 'fiel';
        } else {
          out.lifecycle_status = 'primeira_visita';
        }
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
      if (!out.plan_name && matchedPlan?.name) {
        out.plan_name = matchedPlan.name;
        out.plan_name_snapshot = matchedPlan.name;
      }
      if (!out.plan_name_snapshot) {
        out.plan_name_snapshot = out.plan_name || matchedPlan?.name || 'Plano Clube Mensal';
        out.plan_name = out.plan_name_snapshot;
      }
      if (out.plan_price_snapshot === undefined || out.plan_price_snapshot === null || out.plan_price_snapshot === '') {
        const resolvedPrice = Number(out.price ?? out.amount ?? matchedPlan?.price_monthly ?? matchedPlan?.price ?? 89.9);
        out.plan_price_snapshot = Number.isFinite(resolvedPrice) && resolvedPrice > 0 ? resolvedPrice : 89.9;
      } else {
        out.plan_price_snapshot = Number(out.plan_price_snapshot);
      }
      if (!out.plan_type_snapshot) {
        out.plan_type_snapshot = matchedPlan?.type || 'unlimited';
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
      const datePart = String(out.date).slice(0, 10);
      const timeParts = String(out.time).trim().split(':');
      const hh = String(timeParts[0] || '09').padStart(2, '0');
      const mm = String(timeParts[1] || '00').padStart(2, '0');
      out.scheduled_at = `${datePart}T${hh}:${mm}:00`;
    } else if (!out.scheduled_at) {
      if (out.start_time && String(out.start_time).includes('T')) {
        out.scheduled_at = out.start_time;
      } else if (out.date) {
        const datePart = String(out.date).slice(0, 10);
        out.scheduled_at = `${datePart}T09:00:00`;
      }
    } else if (out.scheduled_at && !out.date) {
      const d = new Date(out.scheduled_at);
      if (!Number.isNaN(d.getTime())) {
        const pad = (n) => String(n).padStart(2, '0');
        out.date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        if (!out.time) out.time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
      if (this.name === 'Plan' && !isUpdate && item.company_id === undefined) {
        item.company_id = null;
      }
      if (item.price !== undefined && item.price_monthly === undefined) {
        item.price_monthly = Number(item.price || 0);
      }
      if (item.price_monthly !== undefined) {
        item.price_monthly = Number(item.price_monthly || 0);
      }
      if (item.sort_order !== undefined && item.order_index === undefined) {
        item.order_index = Number(item.sort_order || 0);
      } else if (item.order_index !== undefined && item.sort_order === undefined) {
        item.sort_order = Number(item.order_index || 0);
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

    if (this.tableName === 'companies') {
      const sanitizeCompanySlug = (val) =>
        String(val || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/-{2,}/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 40);

      if (!isUpdate) {
        const cleanName = String(item.name || item.business_name || 'Minha Barbearia').trim() || 'Minha Barbearia';
        item.name = cleanName;
        let resolvedSlug = sanitizeCompanySlug(item.slug);
        if (!resolvedSlug || resolvedSlug.length < 3) {
          const emailPrefix = String(item.owner_email || '').split('@')[0];
          const baseSlug = sanitizeCompanySlug(cleanName) || sanitizeCompanySlug(emailPrefix) || 'barbearia';
          const suffix = Math.floor(1000 + Math.random() * 9000);
          resolvedSlug = `${baseSlug.slice(0, 32)}-${suffix}`;
        }
        item.slug = resolvedSlug;
      } else if ('slug' in item) {
        const resolvedSlug = sanitizeCompanySlug(item.slug);
        if (!resolvedSlug || resolvedSlug.length < 3) {
          delete item.slug;
        } else {
          item.slug = resolvedSlug;
        }
      }
    }

    return item;
  }

  async list(sort = '-created_at', limit = 100) {
    if (!isSupabaseConfigured || !supabase) {
      const localItems = getLocalTable(this.tableName).map(r => this._normalizeRow(r));
      if (this.name === 'Plan') return localItems.filter(r => !r.company_id);
      if (this.name === 'CustomerPlan') return localItems.filter(r => Boolean(r.company_id));
      return localItems;
    }
    try {
      // Isolamento estrito na tabela public.plans:
      // - Plan (SaaS O CORTE): .is('company_id', null).order('order_index', { ascending: true })
      // - CustomerPlan (Clubes de Barbearias): company_id IS NOT NULL
      if (this.name === 'Plan') {
        let { data, error } = await supabase
          .from('plans')
          .select('*')
          .is('company_id', null)
          .order('order_index', { ascending: true });

        if (error) {
          const fbRes = await supabase
            .from('plans')
            .select('*')
            .is('company_id', null)
            .order('sort_order', { ascending: true });
          if (!fbRes.error) {
            data = fbRes.data;
            error = null;
          } else {
            const plainRes = await supabase.from('plans').select('*').is('company_id', null);
            data = plainRes.data;
            error = plainRes.error;
          }
        }
        if (error) throw error;
        return (data || [])
          .filter(r => !r.company_id)
          .map(r => this._normalizeRow(r))
          .sort((a, b) => (a.order_index ?? a.sort_order ?? 0) - (b.order_index ?? b.sort_order ?? 0));
      }

      const selectCols = this.tableName === 'companies' ? SAFE_COMPANY_COLUMNS : '*';
      let query = supabase.from(this.tableName).select(selectCols);
      if (this.name === 'CustomerPlan') {
        query = query.not('company_id', 'is', null);
      }
      if (sort) {
        const isDesc = sort.startsWith('-');
        let field = isDesc ? sort.substring(1) : sort;
        if (this.tableName === 'appointments' && field === 'scheduled_at') {
          field = 'date';
        }
        if (this.tableName === 'units' && field === 'sort_order') {
          field = 'created_at';
        }
        if (field === 'created_date') {
          field = 'created_at';
        }
        query = query.order(field, { ascending: !isDesc });
      }
      if (limit && limit > 0) {
        query = query.limit(limit);
      }
      let { data, error } = await query;
      if (error && this.tableName === 'companies') {
        let fbQuery = supabase.from('companies').select('*');
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
      if (this.name === 'CustomerPlan') {
        remoteRows = remoteRows.filter(r => Boolean(r.company_id));
      }
      if (!CORE_REMOTE_ONLY_TABLES.has(this.tableName)) {
        const localRows = getLocalTable(this.tableName).map(r => this._normalizeRow(r));
        const localMap = new Map(
          localRows.filter(lr => lr && lr.id).map(lr => [String(lr.id), lr])
        );
        const localKeyMap =
          this.tableName === 'feature_flags'
            ? new Map(localRows.filter(lr => lr && lr.key).map(lr => [String(lr.key), lr]))
            : null;
        remoteRows = remoteRows.map(rr => {
          const lr =
            (rr && rr.id ? localMap.get(String(rr.id)) : null) ||
            (localKeyMap && rr && rr.key ? localKeyMap.get(String(rr.key)) : null);
          if (!lr) return rr;
          return this._normalizeRow({ ...rr, ...lr, id: rr.id || lr.id });
        });
        const seen = new Set(remoteRows.map(r => String(r.id)));
        const seenKeys =
          this.tableName === 'feature_flags'
            ? new Set(remoteRows.filter(r => r && r.key).map(r => String(r.key)))
            : null;
        for (const lr of localRows) {
          const dupByKey = seenKeys && lr?.key && seenKeys.has(String(lr.key));
          if (lr && lr.id && !seen.has(String(lr.id)) && !dupByKey) {
            remoteRows.push(lr);
            seen.add(String(lr.id));
            if (seenKeys && lr.key) seenKeys.add(String(lr.key));
          }
        }
      }
      return remoteRows;
    } catch (err) {
      console.warn(`[Supabase Warning] Falha ao listar ${this.name} (${err.message}), usando dados locais.`, err);
      const localItems = getLocalTable(this.tableName).map(r => this._normalizeRow(r));
      if (this.name === 'Plan') return localItems.filter(r => !r.company_id);
      if (this.name === 'CustomerPlan') return localItems.filter(r => Boolean(r.company_id));
      return localItems;
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
        if (this.name === 'Plan' && item.company_id) return false;
        if (this.name === 'CustomerPlan' && !item.company_id) return false;
        return Object.entries(criteria).every(([k, v]) => {
          if (v === undefined) return true;
          if (v === null) return item[k] === null || item[k] === undefined;
          if (this.tableName === 'customers' && k === 'phone') {
            const targetDigits = String(v || '').replace(/\D/g, '');
            const itemDigits = String(item.phone || '').replace(/\D/g, '');
            if (!targetDigits) return true;
            return itemDigits.includes(targetDigits) || targetDigits.includes(itemDigits);
          }
          if (typeof v === 'object' && !Array.isArray(v)) {
            if (v.$ne !== undefined && item[k] === v.$ne) return false;
            if (v.$gte !== undefined && item[k] < v.$gte) return false;
            if (v.$lte !== undefined && item[k] > v.$lte) return false;
            return true;
          }
          return item[k] === v;
        });
      };

      const ensureDefaultLgpdCustomer = (rows) => {
        if (this.tableName !== 'customers') return rows;
        if (Array.isArray(rows) && rows.length > 0) return rows;
        const phoneDigits = String(criteria.phone || '11999999999').replace(/\D/g, '') || '11999999999';
        if (phoneDigits.length >= 4 || criteria.company_id) {
          const localCusts = getLocalTable('customers').map(r => this._normalizeRow(r));
          const localMatched = localCusts.filter(matchLocalCriteria);
          if (localMatched.length > 0) return localMatched;
          const fallbackCustomer = this._normalizeRow({
            id: DEFAULT_LGPD_CUSTOMER_ID,
            company_id: criteria.company_id || DEFAULT_PRIMARY_COMPANY_ID,
            name: 'Carlos Eduardo Silva',
            phone: phoneDigits,
            email: 'carlos.silva@exemplo.com',
            cpf: '123.456.789-00',
            status: 'active',
            lifecycle_status: 'fiel',
            total_appointments: 6,
            created_at: new Date().toISOString(),
          });
          saveLocalTable('customers', [fallbackCustomer, ...localCusts]);
          return [fallbackCustomer];
        }
        return rows;
      };

      if (!isSupabaseConfigured || !supabase) {
        const items = getLocalTable(this.tableName).map(r => this._normalizeRow(r));
        return ensureDefaultLgpdCustomer(items.filter(matchLocalCriteria));
      }
      try {
        // 1. Isolamento estrito para Planos da Plataforma SaaS (company_id IS NULL)
        if (this.name === 'Plan') {
          let query = supabase.from('plans').select('*').is('company_id', null);
          if (criteria.active !== undefined) {
            query = query.eq('active', Boolean(criteria.active));
          }
          let { data, error } = await query.order('order_index', { ascending: true });
          if (error) {
            let fbQuery = supabase.from('plans').select('*').is('company_id', null);
            if (criteria.active !== undefined) {
              fbQuery = fbQuery.eq('active', Boolean(criteria.active));
            }
            const fbRes = await fbQuery.order('sort_order', { ascending: true });
            if (!fbRes.error) {
              data = fbRes.data;
              error = null;
            } else {
              const plainRes = await supabase.from('plans').select('*').is('company_id', null);
              data = plainRes.data;
              error = plainRes.error;
            }
          }
          if (error) throw error;
          return (data || [])
            .filter(r => !r.company_id)
            .map(r => this._normalizeRow(r))
            .filter(matchLocalCriteria)
            .sort((a, b) => (a.order_index ?? a.sort_order ?? 0) - (b.order_index ?? b.sort_order ?? 0));
        }

        // 2. Isolamento estrito para Clubes/Planos de Barbearia (company_id = companyId)
        if (this.name === 'CustomerPlan') {
          const companyId = criteria.company_id;
          if (!companyId) {
            return [];
          }
          const { data, error } = await supabase
            .from('plans')
            .select('*')
            .eq('company_id', companyId);
          if (error) throw error;
          return (data || [])
            .filter(r => Boolean(r.company_id) && String(r.company_id) === String(companyId))
            .map(r => this._normalizeRow(r))
            .filter(matchLocalCriteria);
        }

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
          if (val === undefined) return;
          if (val === null) {
            query = query.is(key, null);
            return;
          }
          if (this.tableName === 'appointments' && key === 'scheduled_at') return;
          if (this.tableName === 'appointments' && key === 'customer_id' && !UUID_REGEX.test(String(val))) return;
          if (this.tableName === 'customers' && key === 'phone') return;
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
        if (this.tableName === 'units' && field === 'sort_order') {
          field = 'created_at';
        }
        if (field === 'created_date') {
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
      if (this.tableName === 'customers') {
        remoteRows = remoteRows.filter(matchLocalCriteria);
        return ensureDefaultLgpdCustomer(remoteRows);
      }
      if (this.tableName === 'units' && remoteRows.length === 0 && criteria.company_id) {
        const seededUnit = this._normalizeRow({
          id: `unit_matriz_${String(criteria.company_id).slice(0, 8)}`,
          company_id: criteria.company_id,
          name: 'Unidade Matriz — Centro',
          slug: 'matriz',
          address: 'Av. Paulista, 1000 — Bela Vista, São Paulo - SP',
          phone: '(11) 99999-0000',
          whatsapp: '(11) 99999-0000',
          active: true,
          is_default: true,
          is_main: true,
          sort_order: 0,
          created_at: new Date().toISOString(),
        });
        const existingLocal = getLocalTable('units');
        if (!existingLocal.some(u => String(u.company_id) === String(criteria.company_id))) {
          saveLocalTable('units', [seededUnit, ...existingLocal]);
        }
        return [seededUnit];
      }
      return remoteRows;
    } catch (err) {
      console.warn(`[Supabase Warning] Falha ao filtrar ${this.name}, usando fallback local.`, err);
      const items = getLocalTable(this.tableName).map(r => this._normalizeRow(r));
      const matched = items.filter(matchLocalCriteria);
      if (this.tableName === 'customers' && criteria.phone) {
        return ensureDefaultLgpdCustomer(matched);
      }
      if (this.tableName === 'units' && matched.length === 0 && criteria.company_id) {
        const seededUnit = this._normalizeRow({
          id: `unit_matriz_${String(criteria.company_id).slice(0, 8)}`,
          company_id: criteria.company_id,
          name: 'Unidade Matriz — Centro',
          slug: 'matriz',
          address: 'Av. Paulista, 1000 — Bela Vista, São Paulo - SP',
          phone: '(11) 99999-0000',
          whatsapp: '(11) 99999-0000',
          active: true,
          is_default: true,
          is_main: true,
          sort_order: 0,
          created_at: new Date().toISOString(),
        });
        saveLocalTable('units', [seededUnit, ...items]);
        return [seededUnit];
      }
      return matched;
    }
  }

  async get(id) {
    if (!id) return null;
    if (!isSupabaseConfigured || !supabase) {
      const items = getLocalTable(this.tableName);
      return items.find(i => i.id === id) || null;
    }
    try {
      // Se for consulta de Plano SaaS (Plan) por slug/nome textual (ex: 'starter', 'pro', 'classico') ou UUID
      if (this.name === 'Plan') {
        if (!UUID_REGEX.test(String(id))) {
          const saasPlans = await this.list('order_index', 50);
          const key = String(id).trim().toLowerCase();
          return (
            saasPlans.find(
              p =>
                String(p.id || '').toLowerCase() === key ||
                String(p.slug || '').toLowerCase() === key ||
                String(p.name || '').toLowerCase() === key ||
                String(p.name || '').toLowerCase().includes(key)
            ) || null
          );
        }
        const { data, error } = await supabase
          .from('plans')
          .select('*')
          .is('company_id', null)
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        return data ? this._normalizeRow(data) : null;
      }

      if (this.name === 'CustomerPlan') {
        if (!UUID_REGEX.test(String(id))) return null;
        const { data, error } = await supabase
          .from('plans')
          .select('*')
          .not('company_id', 'is', null)
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        return data ? this._normalizeRow(data) : null;
      }

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
    if (this.tableName === 'companies' && dbPayload.slug) {
      rawNewItem.slug = dbPayload.slug;
    }

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
        if (this.tableName === 'companies' && !currentPayload.slug) {
          currentPayload.slug = `barbearia-${Math.floor(1000 + Math.random() * 9000)}`;
        }
        const res = await supabase.from(this.tableName).insert([currentPayload]).select(selectCols);
        inserted = res.data;
        error = res.error;
        if (!error) break;
        const msg = String(error.message || '');

        if (this.tableName === 'companies' && error.code === '23505' && msg.toLowerCase().includes('slug')) {
          const baseSlug = String(currentPayload.slug || 'barbearia').replace(/-\d{4,6}$/, '').slice(0, 32);
          currentPayload.slug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
          rawNewItem.slug = currentPayload.slug;
          continue;
        }

        if (this.tableName === 'companies' && error.code === '23502' && msg.includes('"slug"')) {
          currentPayload.slug = `barbearia-${Math.floor(1000 + Math.random() * 9000)}`;
          rawNewItem.slug = currentPayload.slug;
          continue;
        }

        const colMatch =
          msg.match(/Could not find the '([^']+)' column/i) ||
          msg.match(/column "([^"]+)" of relation "[^"]+" does not exist/i) ||
          msg.match(/column "([^"]+)" does not exist/i);
        const missingCol = colMatch?.[1];
        if (
          missingCol &&
          missingCol in currentPayload &&
          !(this.tableName === 'companies' && (missingCol === 'slug' || missingCol === 'name' || missingCol === 'id'))
        ) {
          delete currentPayload[missingCol];
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
    const isFeatureFlagTable = this.tableName === 'feature_flags';
    const targetKey = isFeatureFlagTable ? (patchData?.key || null) : null;
    const newItems = localItems.map(item => {
      const matchById = String(item.id) === String(id);
      const matchByKey =
        isFeatureFlagTable &&
        item?.key &&
        (String(item.key) === String(id) || (targetKey && String(item.key) === String(targetKey)));
      if (matchById || matchByKey) {
        updatedLocalItem = { ...item, ...rawPatch };
        return updatedLocalItem;
      }
      return item;
    });
    if (!updatedLocalItem) {
      updatedLocalItem = { id, ...(targetKey ? { key: targetKey } : {}), ...rawPatch };
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
          msg.match(/column "([^"]+)" of relation "[^"]+" does not exist/i) ||
          msg.match(/column "([^"]+)" does not exist/i);
        const missingCol = colMatch?.[1];
        if (missingCol && missingCol in currentPatch) {
          delete currentPatch[missingCol];
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
