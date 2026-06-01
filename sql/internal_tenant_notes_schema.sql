-- Notas internas de suporte por conta (sem dados de pacientes)
CREATE TABLE IF NOT EXISTS internal_tenant_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email VARCHAR(255) NOT NULL,
  admin_email VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  product_id VARCHAR(64) NOT NULL DEFAULT 'medsupapp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_tenant_notes_owner
  ON internal_tenant_notes(owner_email, created_at DESC);

ALTER TABLE internal_tenant_notes ENABLE ROW LEVEL SECURITY;
