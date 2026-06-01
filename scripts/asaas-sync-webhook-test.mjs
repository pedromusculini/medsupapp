/**
 * Simula webhook PAYMENT_RECEIVED localmente (dev sem token) e mostra status no Supabase.
 * Uso: node scripts/asaas-sync-webhook-test.mjs
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnvLocal() {
  const raw = readFileSync(join(root, '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  const email =
    process.env.ADMIN_EMAILS?.split(/[,;]/)[0]?.trim() || 'pedromusculini@gmail.com';
  const base = process.env.AUTH_URL || 'http://localhost:3000';

  const payload = {
    id: `evt_test_${Date.now()}`,
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: 'pay_fhehpn0k4aa7lr67',
      status: 'RECEIVED',
      dueDate: new Date().toISOString().slice(0, 10),
      externalReference: email,
      subscription: 'sub_bou7umm6mvvok38i',
      customer: 'cus_000008067960',
    },
  };

  console.log('POST', `${base}/api/webhooks/asaas`);
  const res = await fetch(`${base}/api/webhooks/asaas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  console.log('Webhook:', res.status, text);

  const conta = await fetch(`${base}/api/conta`, { headers: { cookie: '' } });
  console.log('\n/api/conta sem sessão:', conta.status, '(esperado 401)');

  console.log('\n✅ Se webhook retornou 200, confira assinaturas no Supabase (status=active).');
  console.log('   E-mail:', email);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
