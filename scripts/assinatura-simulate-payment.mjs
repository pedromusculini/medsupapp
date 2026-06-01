/**
 * Simula PAYMENT_RECEIVED no Supabase (sem precisar do Next rodando).
 * Uso: node scripts/assinatura-simulate-payment.mjs email@exemplo.com
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

async function main() {
  loadEnv();
  const email = (process.argv[2] || process.env.ADMIN_EMAILS?.split(/[,;]/)[0])?.trim();
  if (!email) throw new Error('Informe o e-mail');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { data: profile } = await supabase
    .from('onboarding_profiles')
    .select('plan')
    .eq('email', email)
    .maybeSingle();

  const { data, error } = await supabase
    .from('assinaturas')
    .upsert(
      {
        owner_email: email,
        status: 'active',
        plano: profile?.plan || 'medico-pix',
        last_payment_at: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
        last_asaas_payment_id: 'pay_fhehpn0k4aa7lr67',
        asaas_subscription_id: 'sub_bou7umm6mvvok38i',
        asaas_customer_id: 'cus_000008067960',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_email' },
    )
    .select()
    .single();

  if (error) throw error;
  console.log('✅ Simulação PAYMENT_RECEIVED → status active');
  console.log(data);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
