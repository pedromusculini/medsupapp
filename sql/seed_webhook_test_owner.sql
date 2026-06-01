INSERT INTO onboarding_profiles (
  email,
  user_type,
  plan,
  trial_started,
  onboarding_completed,
  onboarding_completed_at
)
VALUES (
  'pedromusculini@gmail.com',
  'medico',
  'medico-pix',
  true,
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET updated_at = NOW();
