/**
 * Lista cobranças/assinaturas de teste no Asaas Sandbox (sem expor tokens).
 * Uso: node scripts/inspect-asaas-sandbox-billing.mjs
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

async function asaas(base, key, path) {
  const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    headers: { access_token: key },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Asaas ${res.status}`);
  return data;
}

async function main() {
  loadEnv();
  const base = process.env.ASAAS_API_URL || 'https://api-sandbox.asaas.com/v3';
  const key = process.env.ASAAS_API_KEY?.trim();
  if (!key) throw new Error('ASAAS_API_KEY ausente');

  const customers = await asaas(base, key, '/customers?limit=20');
  const testCustomers = (customers.data ?? []).filter((c) =>
    (c.name ?? '').toLowerCase().includes('medsup'),
  );

  if (testCustomers.length === 0) {
    console.log('Nenhum cliente de teste MedSup no Sandbox.');
    return;
  }

  for (const c of testCustomers) {
    console.log('\nCliente:', c.name, '|', c.id, '| ref:', c.externalReference);
    const subs = await asaas(base, key, `/subscriptions?customer=${c.id}&limit=5`);
    for (const s of subs.data ?? []) {
      console.log('  Assinatura:', s.id, '| nextDueDate:', s.nextDueDate, '| cycle:', s.cycle, '| value:', s.value);
      const pays = await asaas(base, key, `/subscriptions/${s.id}/payments?limit=6`);
      for (const p of pays.data ?? []) {
        console.log('    Cobrança:', p.dueDate, '|', p.status, '|', (p.description ?? '').slice(0, 55));
      }
    }
  }
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
