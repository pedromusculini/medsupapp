-- ============================================================
-- Consultas na agenda (servidor) + lembretes WhatsApp + confirmação
-- Execute no SQL Editor do Supabase (idempotente).
-- ============================================================

CREATE TABLE IF NOT EXISTS consultas_agenda (
  id VARCHAR(64) PRIMARY KEY,
  owner_email VARCHAR(255) NOT NULL,
  paciente VARCHAR(255) NOT NULL,
  servico VARCHAR(255) DEFAULT 'Consulta',
  telefone VARCHAR(30),
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ,
  local TEXT,
  google_event_id VARCHAR(128),
  medico VARCHAR(255),
  convenio VARCHAR(255),
  status VARCHAR(20) DEFAULT 'agendado' CHECK (
    status IN ('agendado', 'confirmado', 'realizado', 'cancelado', 'faltou')
  ),
  lembretes_whatsapp BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultas_agenda_owner ON consultas_agenda(owner_email);
CREATE INDEX IF NOT EXISTS idx_consultas_agenda_inicio ON consultas_agenda(inicio);

CREATE TABLE IF NOT EXISTS whatsapp_lembrete_enviado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id VARCHAR(64) NOT NULL,
  owner_email VARCHAR(255) NOT NULL,
  lembrete_tipo VARCHAR(10) NOT NULL CHECK (lembrete_tipo IN ('d7', 'd1', 'criacao')),
  fila_id UUID,
  enviado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (consulta_id, lembrete_tipo)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_lembrete_consulta ON whatsapp_lembrete_enviado(consulta_id);

CREATE TABLE IF NOT EXISTS whatsapp_conversa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email VARCHAR(255) NOT NULL,
  telefone VARCHAR(30) NOT NULL,
  consulta_id VARCHAR(64),
  estado VARCHAR(40) DEFAULT 'aguardando_confirmacao',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_email, telefone)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversa_telefone ON whatsapp_conversa(telefone);

ALTER TABLE consultas_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_lembrete_enviado ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversa ENABLE ROW LEVEL SECURITY;
