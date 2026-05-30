-- ============================================================
-- Agendamento público semi-manual + mensagens WhatsApp (wa.me)
-- Execute no SQL Editor do Supabase (idempotente).
-- ============================================================

CREATE TABLE IF NOT EXISTS pacientes_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email VARCHAR(255) NOT NULL,
  telefone_normalizado VARCHAR(20) NOT NULL,
  cliente_drive_id VARCHAR(64),
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(14),
  convenio VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_email, telefone_normalizado)
);

CREATE INDEX IF NOT EXISTS idx_pacientes_index_owner ON pacientes_index(owner_email);

CREATE TABLE IF NOT EXISTS agenda_disponibilidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email VARCHAR(255) NOT NULL,
  medico_nome VARCHAR(255),
  dia_semana SMALLINT NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  duracao_minutos INTEGER NOT NULL DEFAULT 40,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agenda_disp_owner ON agenda_disponibilidade(owner_email);

CREATE TABLE IF NOT EXISTS agendamento_slugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(80) NOT NULL UNIQUE,
  nome_exibicao VARCHAR(255) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paciente_agendamento_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) NOT NULL UNIQUE,
  owner_email VARCHAR(255) NOT NULL,
  cliente_drive_id VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paciente_agend_token_owner ON paciente_agendamento_tokens(owner_email);

CREATE TABLE IF NOT EXISTS mensagens_whatsapp_config (
  owner_email VARCHAR(255) PRIMARY KEY,
  convite_agendamento TEXT NOT NULL,
  lembrete_7_dias TEXT NOT NULL,
  lembrete_1_dia TEXT NOT NULL,
  confirmacao_apos_agendar TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agendamentos_pendentes_drive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email VARCHAR(255) NOT NULL,
  consulta_id VARCHAR(64) NOT NULL,
  cliente_drive_id VARCHAR(64),
  dados JSONB NOT NULL,
  sincronizado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agend_pendente_owner ON agendamentos_pendentes_drive(owner_email, sincronizado);

CREATE TABLE IF NOT EXISTS consulta_calendario_tokens (
  token VARCHAR(64) PRIMARY KEY,
  consulta_id VARCHAR(64) NOT NULL UNIQUE,
  owner_email VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consulta_cal_token ON consulta_calendario_tokens(consulta_id);

ALTER TABLE consultas_agenda
  ADD COLUMN IF NOT EXISTS cliente_drive_id VARCHAR(64);

ALTER TABLE pacientes_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_disponibilidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamento_slugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE paciente_agendamento_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos_pendentes_drive ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulta_calendario_tokens ENABLE ROW LEVEL SECURITY;
