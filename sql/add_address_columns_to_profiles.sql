-- ============================================================
-- Migration: Adicionar colunas de endereço estruturado
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Adicionar colunas de endereço se não existirem
ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS cep VARCHAR(8),
  ADD COLUMN IF NOT EXISTS street VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS complement VARCHAR(255),
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(150),
  ADD COLUMN IF NOT EXISTS city VARCHAR(150),
  ADD COLUMN IF NOT EXISTS state VARCHAR(2),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Brasil';
