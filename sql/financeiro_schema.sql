-- ============================================================
-- Módulo Financeiro - MedSupApp
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Tabela de transações financeiras
CREATE TABLE IF NOT EXISTS financeiro_transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  descricao VARCHAR(255) NOT NULL,
  data DATE NOT NULL,
  valor NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  categoria VARCHAR(50),
  medico VARCHAR(150),
  observacao TEXT,
  owner_email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financeiro_owner ON financeiro_transacoes(owner_email);

-- Índices para filtros
CREATE INDEX IF NOT EXISTS idx_financeiro_data ON financeiro_transacoes(data DESC);
CREATE INDEX IF NOT EXISTS idx_financeiro_tipo ON financeiro_transacoes(tipo);

-- 2. Tabela de splits por médico (para clínicas)
CREATE TABLE IF NOT EXISTS financeiro_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transacao_id UUID NOT NULL REFERENCES financeiro_transacoes(id) ON DELETE CASCADE,
  medico VARCHAR(150) NOT NULL,
  porcentagem NUMERIC(5, 2) NOT NULL,
  valor_split NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_splits_transacao ON financeiro_splits(transacao_id);

-- 3. RLS: sem políticas para anon — acesso apenas via API server (service_role)
ALTER TABLE financeiro_transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_splits ENABLE ROW LEVEL SECURITY;