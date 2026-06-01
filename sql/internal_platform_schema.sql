-- Painel interno (suporte / métricas) — sem dados de pacientes
CREATE TABLE IF NOT EXISTS internal_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email VARCHAR(255) NOT NULL,
  action VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL DEFAULT 'medsupapp',
  target_owner_email VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_audit_created
  ON internal_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_audit_product
  ON internal_audit_log(product_id, created_at DESC);

ALTER TABLE internal_audit_log ENABLE ROW LEVEL SECURITY;
