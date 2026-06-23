/**
 * Corrige webhook "medsupapp" no Asaas Sandbox:
 * URL → produção, authToken, reativa fila interrompida.
 *
 * Uso: node scripts/fix-asaas-sandbox-webhook.mjs
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEBHOOK_URL = 'https://www.medsupapp.com.br/api/webhooks/asaas';

function loadEnv() {
  for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

async function asaas(base, key, path, options = {}) {
  const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      access_token: key,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Asaas ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

async function main() {
  loadEnv();
  const base = process.env.ASAAS_API_URL || 'https://api-sandbox.asaas.com/v3';
  const key = process.env.ASAAS_API_KEY?.trim();
  const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!key) throw new Error('ASAAS_API_KEY ausente em .env.local');
  if (!token || token.length < 32) {
    throw new Error('ASAAS_WEBHOOK_TOKEN ausente ou curto em .env.local (min 32 chars)');
  }

  const list = await asaas(base, key, '/webhooks?limit=20');
  const wh = (list.data ?? []).find((w) => w.name === 'medsupapp') ?? list.data?.[0];
  if (!wh?.id) throw new Error('Nenhum webhook encontrado no Sandbox');

  console.log('Webhook antes:', {
    id: wh.id,
    name: wh.name,
    url: wh.url,
    interrupted: wh.interrupted,
    enabled: wh.enabled,
    hasAuthToken: Boolean(wh.authToken),
  });

  const updated = await asaas(base, key, `/webhooks/${wh.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: wh.name,
      url: WEBHOOK_URL,
      enabled: true,
      interrupted: false,
      authToken: token,
      sendType: wh.sendType || 'SEQUENTIALLY',
      events: wh.events,
    }),
  });

  console.log('Webhook depois:', {
    id: updated.id,
    url: updated.url,
    interrupted: updated.interrupted,
    enabled: updated.enabled,
    hasAuthToken: Boolean(updated.authToken),
  });

  const pingRes = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'asaas-access-token': token,
    },
    body: JSON.stringify({
      id: `evt_sandbox_ping_${Date.now()}`,
      event: 'PAYMENT_CREATED',
      payment: { id: 'pay_ping', externalReference: 'webhook-ping@test.local' },
    }),
  });
  const pingBody = await pingRes.text();
  console.log('Ping POST produção:', pingRes.status, pingBody.slice(0, 100));

  if (!pingRes.ok) {
    console.log('\n⚠️ Webhook atualizado no Asaas, mas ping em produção falhou. Confira ASAAS_WEBHOOK_TOKEN na Vercel.');
    process.exit(1);
  }

  console.log('\n✅ Webhook Sandbox corrigido e fila reativada.');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
