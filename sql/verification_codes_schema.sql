-- ============================================================
-- Tabela de Códigos de Verificação - MedSupApp
-- Funciona com ANON key (não requer service_role)
-- ============================================================

CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  role VARCHAR(20),
  plan VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vc_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_vc_expires ON verification_codes(expires_at);

-- RLS: Permitir insert público (frontend chama API que usa ANON key)
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Sem políticas para anon: ver sql/security_hardening.sql.