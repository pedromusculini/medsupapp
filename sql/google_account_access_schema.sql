-- Controle de acesso Google: verificação de e-mail e trial único por conta
-- Execute no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS google_account_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ,
  trial_consumed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_account_access_email
  ON google_account_access(email);

ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_profiles_google_sub
  ON onboarding_profiles(google_sub)
  WHERE google_sub IS NOT NULL;

ALTER TABLE google_account_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "API acesso google_account_access"
  ON google_account_access FOR ALL
  USING (true)
  WITH CHECK (true);
