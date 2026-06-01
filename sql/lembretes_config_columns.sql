-- Configuração de lembretes WhatsApp (ativar/desativar e dias de antecedência)
ALTER TABLE mensagens_whatsapp_config
  ADD COLUMN IF NOT EXISTS lembrete_antecedencia_ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lembrete_antecedencia_dias SMALLINT NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS lembrete_1_dia_ativo BOOLEAN NOT NULL DEFAULT true;
