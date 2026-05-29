-- ============================================================
-- Tabela de Médicos vinculados a Clínicas - MedSupApp
-- Execute este script no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS clinica_medicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_email VARCHAR(255) NOT NULL REFERENCES onboarding_profiles(email) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  crm VARCHAR(50),
  specialty VARCHAR(150),
  whatsapp VARCHAR(30),
  email VARCHAR(255),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_clinica_medicos_email ON clinica_medicos(clinica_email);
CREATE INDEX IF NOT EXISTS idx_clinica_medicos_ativo ON clinica_medicos(ativo);

-- RLS
ALTER TABLE clinica_medicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "API tem acesso total a clinica_medicos"
  ON clinica_medicos FOR ALL
  USING (true)
  WITH CHECK (true);
