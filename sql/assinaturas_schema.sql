-- ============================================================
-- Assinaturas Asaas — MedSupApp
-- Fonte da verdade de acesso (trial / active / expired)
-- Aplicar quando iniciar implementação: npm run db:assinaturas
-- NÃO aplicar automaticamente na fase de testes do app.
-- ============================================================

CREATE TABLE IF NOT EXISTS assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email VARCHAR(255) NOT NULL UNIQUE REFERENCES onboarding_profiles(email) ON DELETE CASCADE,

  -- trial | active | expired
  status VARCHAR(20) NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial', 'active', 'expired')),

  -- Plano comercial (espelha onboarding_profiles.plan no momento da cobrança)
  plano VARCHAR(50) NOT NULL,

  -- Trial: fim do período gratuito (dia 30). Preencher ao consumir trial no onboarding.
  trial_ends_at TIMESTAMPTZ,

  -- Assinatura paga: fim do período corrente (atualizado via webhook)
  current_period_end TIMESTAMPTZ,

  last_payment_at TIMESTAMPTZ,

  -- Integração Asaas
  asaas_customer_id VARCHAR(64),
  asaas_subscription_id VARCHAR(64),

  -- Idempotência de webhooks (último pagamento processado)
  last_asaas_payment_id VARCHAR(64),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON assinaturas(status);
CREATE INDEX IF NOT EXISTS idx_assinaturas_trial_ends ON assinaturas(trial_ends_at) WHERE status = 'trial';
CREATE INDEX IF NOT EXISTS idx_assinaturas_period_end ON assinaturas(current_period_end) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_assinaturas_asaas_customer ON assinaturas(asaas_customer_id) WHERE asaas_customer_id IS NOT NULL;

-- Eventos de webhook (idempotência e auditoria)
CREATE TABLE IF NOT EXISTS assinaturas_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_event_id VARCHAR(128) NOT NULL UNIQUE,
  event_type VARCHAR(64) NOT NULL,
  owner_email VARCHAR(255),
  asaas_payment_id VARCHAR(64),
  payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_owner ON assinaturas_webhook_events(owner_email);

ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinaturas_webhook_events ENABLE ROW LEVEL SECURITY;

-- Acesso via API server (service_role), como demais tabelas operacionais.
-- Ver sql/security_hardening.sql para políticas anon.

COMMENT ON TABLE assinaturas IS 'Status de cobrança Asaas por conta (owner_email). Não altera Google Drive.';
COMMENT ON COLUMN assinaturas.status IS 'trial: dias 0-29; active: pago; expired: bloqueio operacional';
