-- ============================================================
-- MedSupAPP — endurecimento de segurança (RLS + financeiro)
-- Execute no SQL Editor do Supabase (idempotente).
-- Só altera tabelas que já existem no projeto.
-- ============================================================

-- 1) Financeiro: isolamento por conta (owner_email)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'financeiro_transacoes'
  ) THEN
    ALTER TABLE financeiro_transacoes
      ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_financeiro_owner ON financeiro_transacoes(owner_email)';
  END IF;
END $$;

-- 2) Consentimento LGPD (versão da política aceita)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'google_account_access'
  ) THEN
    ALTER TABLE google_account_access
      ADD COLUMN IF NOT EXISTS privacy_policy_version VARCHAR(20),
      ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20),
      ADD COLUMN IF NOT EXISTS privacy_consent_at TIMESTAMPTZ;
  END IF;
END $$;

-- 3) Remover políticas RLS abertas (somente em tabelas existentes)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('onboarding_profiles', 'API tem acesso total a perfis'),
      ('verification_codes', 'Permitir acesso público a verification_codes'),
      ('financeiro_transacoes', 'Permitir acesso público a transações'),
      ('financeiro_splits', 'Permitir acesso público a splits'),
      ('formulario_links', 'formulario_links_all'),
      ('formulario_respostas', 'formulario_respostas_all'),
      ('whatsapp_fila', 'whatsapp_fila_all'),
      ('consultas_agenda', 'consultas_agenda_all'),
      ('whatsapp_lembrete_enviado', 'whatsapp_lembrete_enviado_all'),
      ('whatsapp_conversa', 'whatsapp_conversa_all'),
      ('clientes', 'clientes_all'),
      ('cliente_atendimentos', 'atendimentos_all'),
      ('cliente_observacoes', 'observacoes_all'),
      ('cliente_pagamentos', 'pagamentos_all'),
      ('google_account_access', 'API acesso google_account_access')
    ) AS t(tablename, policyname)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = r.tablename
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END IF;
  END LOOP;
END $$;

-- RLS permanece ENABLED: sem políticas para anon/authenticated = acesso negado.
-- O backend usa SUPABASE_SERVICE_ROLE_KEY (bypass RLS) com auth Next.js + filtros por owner.
--
-- Tabelas opcionais (ex.: clientes) vêm de sql/clientes_schema.sql — não é obrigatório
-- para o app atual (clientes ficam no Google Drive).
