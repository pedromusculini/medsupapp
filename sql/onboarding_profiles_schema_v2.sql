-- ============================================================
-- Tabela de Perfis de Onboarding - MedSupApp (v2)
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Adiciona campos de endereço estruturado à tabela existente
ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS cep VARCHAR(9),
  ADD COLUMN IF NOT EXISTS street VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS complement VARCHAR(255),
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(150),
  ADD COLUMN IF NOT EXISTS city VARCHAR(150),
  ADD COLUMN IF NOT EXISTS state VARCHAR(2),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Brasil';

-- Índice para busca por CEP
CREATE INDEX IF NOT EXISTS idx_profiles_cep ON onboarding_profiles(cep) WHERE cep IS NOT NULL;

-- Nota: A coluna 'address' antiga continua existindo para compatibilidade.
-- Novos cadastros preencherão os campos estruturados.
