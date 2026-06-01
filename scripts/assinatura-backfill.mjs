/**
 * Cria/atualiza linha em assinaturas para e-mails com perfil (trial 30 dias).
 * Uso: node scripts/assinatura-backfill.mjs
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnvLocal() {
  const raw = readFileSync(join(root, '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

async function main() {
  loadEnvLocal();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const email =
    process.argv[2] ||
    process.env.ADMIN_EMAILS?.split(/[,;]/)[0]?.trim();

  if (!email) throw new Error('Informe e-mail: node scripts/assinatura-backfill.mjs email@x.com');

  const { data: profile } = await supabase
    .from('onboarding_profiles')
    .select('plan, trial_started')
    .eq('email', email)
    .single();

  if (!profile) throw new Error('Perfil não encontrado');

  const { data: access } = await supabase
    .from('google_account_access')
    .select('trial_started_at')
    .eq('email', email)
    .maybeSingle();

  const start = access?.trial_started_at ? new Date(access.trial_started_at) : new Date();
  const trialEnds = new Date(start);
  trialEnds.setDate(trialEnds.getDate() + 30);

  const { data, error } = await supabase
    .from('assinaturas')
    .upsert(
      {
        owner_email: email,
        status: profile.trial_started ? 'trial' : 'expired',
        plano: profile.plan || 'medico-pix',
        trial_ends_at: profile.trial_started ? trialEnds.toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_email' },
    )
    .select()
    .single();

  if (error) throw error;
  console.log('✅ assinaturas:', data);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
