/**
 * Reset de acesso Google (suporte).
 * Uso:
 *   node scripts/reset-tenant-access.mjs luyddypires@gmail.com reverify
 *   node scripts/reset-tenant-access.mjs luyddypires@gmail.com remove
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const GOOGLE_ACCESS_CODE_PURPOSE = 'google_access';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

async function resolveGoogleSub(supabase, email) {
  const { data: access } = await supabase
    .from('google_account_access')
    .select('google_sub')
    .eq('email', email)
    .maybeSingle();
  if (access?.google_sub) return access.google_sub;

  const { data: profile } = await supabase
    .from('onboarding_profiles')
    .select('google_sub')
    .eq('email', email)
    .maybeSingle();
  return profile?.google_sub ?? null;
}

async function invalidateCodes(supabase, email) {
  await supabase
    .from('verification_codes')
    .update({ used: true })
    .eq('email', email)
    .eq('role', GOOGLE_ACCESS_CODE_PURPOSE)
    .eq('used', false);
}

async function main() {
  loadEnvLocal();
  const email = (process.argv[2] || '').toLowerCase().trim();
  const mode = (process.argv[3] || 'reverify').toLowerCase();

  if (!email) {
    console.error('Uso: node scripts/reset-tenant-access.mjs <email> [reverify|remove]');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const googleSub = await resolveGoogleSub(supabase, email);
  if (!googleSub) {
    console.error('❌ Nenhum vínculo Google para', email);
    process.exit(1);
  }

  const now = new Date().toISOString();

  if (mode === 'remove') {
    const { error } = await supabase
      .from('google_account_access')
      .delete()
      .eq('google_sub', googleSub);
    if (error) throw error;
    await invalidateCodes(supabase, email);
    console.log('✅ Registro google_account_access removido para', email);
    console.log('   Próximo login: fluxo novo (verificação de e-mail).');
  } else if (mode === 'reverify') {
    const { error } = await supabase
      .from('google_account_access')
      .update({
        email_verified_at: null,
        last_login_at: null,
        updated_at: now,
      })
      .eq('google_sub', googleSub);
    if (error) throw error;
    await invalidateCodes(supabase, email);
    console.log('✅ Verificação resetada para', email);
    console.log('   Usuário deve ir em /auth/verificar-email após login.');
  } else {
    console.error('Modo inválido. Use reverify ou remove.');
    process.exit(1);
  }

  console.log('\nPeça ao usuário:');
  console.log('  1) Abrir https://www.medsupapp.com.br/api/auth/signout');
  console.log('  2) Entrar de novo com Google em /login');
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
