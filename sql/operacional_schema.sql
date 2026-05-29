-- ============================================================
-- Supabase OPERACIONAL (não armazena dados clínicos sensíveis)
-- Clientes + faturamento ficam no Google Drive do usuário (LGPD).
-- Este schema: links de formulário público + fila WhatsApp.
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS formulario_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) UNIQUE NOT NULL,
  owner_email VARCHAR(255) NOT NULL,
  cliente_drive_id VARCHAR(64),
  titulo VARCHAR(255) DEFAULT 'Cadastro de paciente',
  mensagem_whatsapp TEXT,
  ativo BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formulario_links_token ON formulario_links(token);
CREATE INDEX IF NOT EXISTS idx_formulario_links_owner ON formulario_links(owner_email);

CREATE TABLE IF NOT EXISTS formulario_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID REFERENCES formulario_links(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL,
  dados JSONB NOT NULL DEFAULT '{}',
  origem VARCHAR(20) DEFAULT 'web' CHECK (origem IN ('web', 'whatsapp')),
  sincronizado_drive BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formulario_respostas_token ON formulario_respostas(token);
CREATE INDEX IF NOT EXISTS idx_formulario_respostas_sync ON formulario_respostas(sincronizado_drive);

CREATE TABLE IF NOT EXISTS whatsapp_fila (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email VARCHAR(255) NOT NULL,
  telefone VARCHAR(30) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'erro', 'cancelado')),
  erro TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  enviado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_fila_owner ON whatsapp_fila(owner_email);
CREATE INDEX IF NOT EXISTS idx_whatsapp_fila_status ON whatsapp_fila(status);

ALTER TABLE formulario_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulario_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_fila ENABLE ROW LEVEL SECURITY;

-- Políticas abertas removidas: use sql/security_hardening.sql em projetos existentes.
