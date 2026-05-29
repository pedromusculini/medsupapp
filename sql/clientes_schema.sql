-- ============================================================
-- Módulo Clientes - MedSupApp
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email VARCHAR(255) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telefone VARCHAR(30),
  cpf VARCHAR(14),
  data_nascimento DATE,
  convenio VARCHAR(150),
  observacoes_gerais TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_owner ON clientes(owner_email);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);

CREATE TABLE IF NOT EXISTS cliente_atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora TIME,
  tipo VARCHAR(50) NOT NULL DEFAULT 'consulta',
  medico VARCHAR(150),
  valor NUMERIC(12, 2),
  status VARCHAR(30) NOT NULL DEFAULT 'realizado'
    CHECK (status IN ('agendado', 'confirmado', 'realizado', 'cancelado', 'faltou')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atendimentos_cliente ON cliente_atendimentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_data ON cliente_atendimentos(data DESC);

CREATE TABLE IF NOT EXISTS cliente_observacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  autor VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_observacoes_cliente ON cliente_observacoes(cliente_id);

CREATE TABLE IF NOT EXISTS cliente_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  atendimento_id UUID REFERENCES cliente_atendimentos(id) ON DELETE SET NULL,
  valor NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  data DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pago'
    CHECK (status IN ('pago', 'pendente', 'parcial', 'cancelado')),
  forma_pagamento VARCHAR(50),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_cliente ON cliente_pagamentos(cliente_id);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_observacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_all" ON clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "atendimentos_all" ON cliente_atendimentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "observacoes_all" ON cliente_observacoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pagamentos_all" ON cliente_pagamentos FOR ALL USING (true) WITH CHECK (true);
