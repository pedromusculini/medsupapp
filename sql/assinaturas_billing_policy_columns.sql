-- Colunas para política de cobrança (boleto / primeiro pagamento / tolerância)
ALTER TABLE assinaturas
  ADD COLUMN IF NOT EXISTS first_payment_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_billing_type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS boleto_grace_until TIMESTAMPTZ;

COMMENT ON COLUMN assinaturas.first_payment_at IS 'Primeiro pagamento confirmado (webhook RECEIVED/CONFIRMED conforme política)';
COMMENT ON COLUMN assinaturas.last_billing_type IS 'Último billingType Asaas (BOLETO, PIX, CREDIT_CARD, ...)';
COMMENT ON COLUMN assinaturas.boleto_grace_until IS 'Renovação boleto: fim da tolerância de 3 dias após vencimento';
