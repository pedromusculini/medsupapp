-- ============================================================
-- MedSupAPP — endurecimento de segurança (RLS + financeiro)
-- Execute no SQL Editor do Supabase após os schemas base.
-- ============================================================

-- 1) Financeiro: isolamento por conta (owner_email)
ALTER TABLE financeiro_transacoes
  ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_financeiro_owner
  ON financeiro_transacoes(owner_email);

-- 2) Consentimento LGPD (versão da política aceita)
ALTER TABLE google_account_access
  ADD COLUMN IF NOT EXISTS privacy_policy_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS privacy_consent_at TIMESTAMPTZ;

-- 3) Remover políticas RLS abertas (anon/authenticated não acessam via REST)
DROP POLICY IF EXISTS "API tem acesso total a perfis" ON onboarding_profiles;
DROP POLICY IF EXISTS "Permitir acesso público a verification_codes" ON verification_codes;
DROP POLICY IF EXISTS "Permitir acesso público a transações" ON financeiro_transacoes;
DROP POLICY IF EXISTS "Permitir acesso público a splits" ON financeiro_splits;
DROP POLICY IF EXISTS "formulario_links_all" ON formulario_links;
DROP POLICY IF EXISTS "formulario_respostas_all" ON formulario_respostas;
DROP POLICY IF EXISTS "whatsapp_fila_all" ON whatsapp_fila;
DROP POLICY IF EXISTS "clientes_all" ON clientes;
DROP POLICY IF EXISTS "atendimentos_all" ON cliente_atendimentos;
DROP POLICY IF EXISTS "observacoes_all" ON cliente_observacoes;
DROP POLICY IF EXISTS "pagamentos_all" ON cliente_pagamentos;
DROP POLICY IF EXISTS "API acesso google_account_access" ON google_account_access;

-- RLS permanece ENABLED: sem políticas para roles anon/authenticated = acesso negado.
-- O backend usa SUPABASE_SERVICE_ROLE_KEY (bypass RLS) com auth Next.js + filtros por owner.
