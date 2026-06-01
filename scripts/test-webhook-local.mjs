/**
 * Testa POST /api/webhooks/asaas no dev server local.
 * Uso: node scripts/test-webhook-local.mjs [porta]
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

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
  const port = process.argv[2] || '3000';
  const base = `http://localhost:${port}`;
  const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  const email = process.env.ADMIN_EMAILS?.split(/[,;]/)[0]?.trim();

  const payload = {
    id: `evt_test_${Date.now()}`,
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: 'pay_fhehpn0k4aa7lr67',
      dueDate: '2026-07-01',
      externalReference: email,
      subscription: 'sub_bou7umm6mvvok38i',
      customer: 'cus_000008067960',
    },
  };

  const res = await fetch(`${base}/api/webhooks/asaas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'asaas-access-token': token || '',
    },
    body: JSON.stringify(payload),
  });
  console.log('POST', res.status, await res.text());

  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data } = await sb
    .from('assinaturas')
    .select('owner_email, status, current_period_end, last_asaas_payment_id')
    .eq('owner_email', email)
    .maybeSingle();
  console.log('assinaturas:', data);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
