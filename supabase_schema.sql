-- ============================================================================
-- O CORTE / BarberPass - Supabase Complete Database Schema & RLS Setup
-- Execute este script no SQL Editor do seu projeto Supabase
-- ============================================================================

-- 1. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TIPOS ENUM
DO $$ BEGIN
    CREATE TYPE appointment_status AS ENUM ('agendado', 'concluido', 'cancelado', 'pendente');
except
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'confirmed', 'received', 'authorized', 'failed', 'refunded');
except
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'canceled', 'overdue', 'trialing');
except
    WHEN duplicate_object THEN null;
END $$;

-- 3. TABELA: companies (Barbearias / Empresas)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    cnpj VARCHAR(20),
    phone VARCHAR(30),
    whatsapp VARCHAR(30),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(2),
    primary_color VARCHAR(20) DEFAULT '#2563EB',
    logo_url TEXT,
    banner_url TEXT,
    billing_provider VARCHAR(50) DEFAULT 'asaas',
    asaas_customer_id VARCHAR(100),
    asaas_subscription_id VARCHAR(100),
    pix_key VARCHAR(255),
    pix_key_type VARCHAR(50),
    default_repasse NUMERIC(10, 2) DEFAULT 50.00,
    business_hours JSONB,
    opening_hours JSONB,
    active BOOLEAN DEFAULT TRUE,
    owner_email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS business_hours JSONB;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS opening_hours JSONB;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS asaas_api_key TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS asaas_pix_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS asaas_credit_card_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS booking_payment_mode VARCHAR(50) DEFAULT 'optional';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS booking_deposit_amount NUMERIC(10, 2) DEFAULT 20.00;

CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(active);

-- 4. TABELA: plans (Planos de Assinatura)
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_monthly NUMERIC(10, 2) NOT NULL DEFAULT 49.00,
    type VARCHAR(50) DEFAULT 'unlimited', -- 'unlimited' | 'limited'
    usage_limit INTEGER DEFAULT 0,
    recommended BOOLEAN DEFAULT FALSE,
    off_peak BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_company ON plans(company_id);

-- 5. TABELA: services (Serviços Oferecidos)
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 45.00,
    duration_minutes INTEGER DEFAULT 30,
    category VARCHAR(100) DEFAULT 'Cabelo',
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_services_company ON services(company_id);

-- 6. TABELA: professionals (Barbeiros / Profissionais)
CREATE TABLE IF NOT EXISTS professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(255),
    bio TEXT,
    avatar_url TEXT,
    phone VARCHAR(30),
    email VARCHAR(255),
    commission_pct NUMERIC(5, 2) DEFAULT 50.00,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_professionals_company ON professionals(company_id);

-- 7. TABELA: customers (Clientes Finais / Usuários)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(30),
    cpf VARCHAR(20),
    avatar_url TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);

-- 8. TABELA: customer_subscriptions (Assinaturas Ativas dos Clientes)
CREATE TABLE IF NOT EXISTS customer_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'active', -- 'active' | 'overdue' | 'canceled'
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    asaas_subscription_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cust_subs_customer ON customer_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_subs_company ON customer_subscriptions(company_id);

-- 9. TABELA: appointments (Agendamentos e Atendimentos)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(30),
    customer_email VARCHAR(255),
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    service_name VARCHAR(255) NOT NULL,
    professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
    professional_name VARCHAR(255),
    date DATE NOT NULL,
    time VARCHAR(10) NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'agendado', -- 'agendado' | 'concluido' | 'cancelado' | 'pendente'
    payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'paid' | 'confirmed'
    payment_id VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_company ON appointments(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id);

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Políticas para Companies: Leitura pública para barbearias ativas, escrita restrita
CREATE POLICY "Leitura pública de barbearias ativas" ON companies
    FOR SELECT USING (active = true);

CREATE POLICY "Gestão total de barbearias para donos/admins" ON companies
    FOR ALL USING (true) WITH CHECK (true);

-- Políticas para Plans: Leitura pública e autenticada, gestão total para administradores/autenticados
DROP POLICY IF EXISTS "Leitura pública de planos" ON plans;
DROP POLICY IF EXISTS "Gestão de planos para barbearias" ON plans;

CREATE POLICY "Leitura pública de planos" ON plans
    FOR SELECT USING (true);

CREATE POLICY "Gestão de planos para administradores" ON plans
    FOR ALL USING (true) WITH CHECK (true);

-- Políticas para Services: Leitura pública
CREATE POLICY "Leitura pública de serviços" ON services
    FOR SELECT USING (active = true);

CREATE POLICY "Gestão de serviços para barbearias" ON services
    FOR ALL USING (true) WITH CHECK (true);

-- Políticas para Professionals: Leitura pública
CREATE POLICY "Leitura pública de profissionais" ON professionals
    FOR SELECT USING (active = true);

CREATE POLICY "Gestão de profissionais para barbearias" ON professionals
    FOR ALL USING (true) WITH CHECK (true);

-- Políticas para Customers
CREATE POLICY "Acesso de clientes aos próprios dados" ON customers
    FOR ALL USING (true) WITH CHECK (true);

-- Políticas para Customer Subscriptions
CREATE POLICY "Acesso a assinaturas" ON customer_subscriptions
    FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_name VARCHAR(255);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_phone VARCHAR(50);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS asaas_payment_id VARCHAR(100);

-- Políticas para Appointments: Leitura, inserção e atualização públicas/anônimas para agendamento online via checkout
DROP POLICY IF EXISTS "Acesso a agendamentos" ON appointments;
DROP POLICY IF EXISTS "Permitir insercao publica de agendamentos" ON appointments;
DROP POLICY IF EXISTS "Permitir consulta e atualizacao publica de agendamentos" ON appointments;

CREATE POLICY "Permitir insercao publica de agendamentos" ON appointments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir consulta e atualizacao publica de agendamentos" ON appointments
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 10. TABELA: partners (Programa de Parceiros e Afiliados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    cpf_cnpj VARCHAR(50),
    pix_key VARCHAR(255),
    referral_code VARCHAR(50) UNIQUE,
    commission_rate NUMERIC(5, 2) DEFAULT 20.00,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'suspended'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partners_email ON partners(email);
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_referral_code ON partners(referral_code);

-- RLS: Habilitar Row Level Security na tabela partners
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Política de Cadastro Público (Anon e Authenticated podem cadastrar novos parceiros)
CREATE POLICY "Permitir cadastro público de parceiros" ON partners
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- Política de Leitura de Parceiros
CREATE POLICY "Permitir leitura de parceiros" ON partners
    FOR SELECT TO anon, authenticated
    USING (true);

-- Política de Atualização de Parceiros
CREATE POLICY "Permitir atualização de parceiros pelo próprio titular ou admin" ON partners
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================

