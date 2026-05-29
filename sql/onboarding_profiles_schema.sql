-- ============================================================
-- Tabela de Perfis de Onboarding - MedSupApp
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Tabela principal de perfis (médico solo ou clínica)
CREATE TABLE IF NOT EXISTS onboarding_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  user_type VARCHAR(10) NOT NULL CHECK (user_type IN ('medico', 'clinica')),
  plan VARCHAR(50) NOT NULL,
  trial_started BOOLEAN DEFAULT false,
  onboarding_completed BOOLEAN DEFAULT true,
  onboarding_completed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Campos de Médico Solo (nulos para clínica)
  full_name VARCHAR(255),
  crm VARCHAR(50),
  specialty VARCHAR(150),

  -- Campos de Clínica (nulos para médico solo)
  clinic_name VARCHAR(255),
  cnpj VARCHAR(14),             -- armazenado sem máscara (apenas números)
  doctors_count INTEGER,

  -- Campos comuns
  whatsapp VARCHAR(30),
  address TEXT,
  health_plan VARCHAR(255),

  -- Endereço estruturado
  cep VARCHAR(8),
  street VARCHAR(255),
  address_number VARCHAR(20),
  complement VARCHAR(255),
  neighborhood VARCHAR(150),
  city VARCHAR(150),
  state VARCHAR(2),
  country VARCHAR(100) DEFAULT 'Brasil',

  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_email ON onboarding_profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_cnpj ON onboarding_profiles(cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON onboarding_profiles(user_type);

-- RLS: Acesso com service_role (API) e políticas para leitura
ALTER TABLE onboarding_profiles ENABLE ROW LEVEL SECURITY;

-- Sem políticas para anon: acesso via API server (service_role). Ver sql/security_hardening.sql.
