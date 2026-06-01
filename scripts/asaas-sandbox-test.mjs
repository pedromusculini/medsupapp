/**
 * Testa conexão Asaas Sandbox (sem usar a documentação web do Asaas).
 * Uso: node scripts/asaas-sandbox-test.mjs
 * Opcional:
 *   node scripts/asaas-sandbox-test.mjs --create-customer
 *   node scripts/asaas-sandbox-test.mjs --confirm-subscription sub_xxx
 *   node scripts/asaas-sandbox-test.mjs --confirm-payment pay_xxx
 *   node scripts/asaas-sandbox-test.mjs --overdue-payment pay_xxx
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

async function asaas(path, options = {}) {
  const base = process.env.ASAAS_API_URL?.replace(/\/$/, '') || 'https://api-sandbox.asaas.com/v3';
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error('ASAAS_API_KEY ausente em .env.local');

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      access_token: key,
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = data.errors?.[0]?.description || data.message || res.statusText;
    throw new Error(`Asaas ${res.status}: ${msg}`);
  }
  return data;
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

async function main() {
  loadEnvLocal();

  const createCustomer = process.argv.includes('--create-customer');
  const subId = argValue('--confirm-subscription');
  const payId = argValue('--confirm-payment');
  const overduePayId = argValue('--overdue-payment');
  const ownerEmail = process.env.ADMIN_EMAILS?.split(/[,;]/)[0]?.trim() || 'teste@medsupapp.local';

  console.log('🔌 Testando Asaas Sandbox...');
  console.log(`   URL: ${process.env.ASAAS_API_URL}`);
  console.log(`   Chave: ${process.env.ASAAS_API_KEY?.slice(0, 20)}...`);

  const finance = await asaas('/finance/balance');
  console.log('✅ Autenticação OK — saldo sandbox:', finance.balance ?? finance);

  if (overduePayId) {
    console.log(`\n⏰ Forçando vencimento: ${overduePayId}`);
    await asaas(`/sandbox/payment/${overduePayId}/overdue`, { method: 'POST' });
    console.log('✅ Cobrança vencida (sandbox). Verifique webhook PAYMENT_OVERDUE.');
    return;
  }

  if (payId) {
    console.log(`\n💳 Confirmando pagamento: ${payId}`);
    await asaas(`/sandbox/payment/${payId}/confirm`, { method: 'POST' });
    console.log('✅ Pagamento confirmado (sandbox). Verifique webhook PAYMENT_RECEIVED.');
    return;
  }

  if (subId) {
    const payments = await asaas(`/subscriptions/${subId}/payments`);
    const list = payments.data ?? payments;
    const first = Array.isArray(list) ? list[0] : null;
    if (!first?.id) throw new Error('Nenhuma cobrança na assinatura');
    console.log(`\n💳 Confirmando 1ª cobrança da assinatura: ${first.id}`);
    await asaas(`/sandbox/payment/${first.id}/confirm`, { method: 'POST' });
    console.log('✅ Pagamento confirmado. Verifique webhook no painel/ngrok.');
    return;
  }

  if (!createCustomer) {
    console.log('\n💡 Comandos úteis:');
    console.log('   node scripts/asaas-sandbox-test.mjs --create-customer');
    console.log('   node scripts/asaas-sandbox-test.mjs --confirm-subscription sub_xxx');
    console.log('   node scripts/asaas-sandbox-test.mjs --confirm-payment pay_xxx');
    console.log('   node scripts/asaas-sandbox-test.mjs --overdue-payment pay_xxx');
    return;
  }

  console.log(`\n📧 Criando cliente (externalReference = ${ownerEmail})...`);
  const customer = await asaas('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: 'MedSup Teste Sandbox',
      email: ownerEmail,
      cpfCnpj: '24971563792',
      mobilePhone: '11987654321',
      externalReference: ownerEmail,
    }),
  });
  console.log('✅ Cliente:', customer.id);

  const nextDueDate = addDays(30);
  console.log(`\n📅 Criando assinatura (1ª cobrança em ${nextDueDate})...`);
  const subscription = await asaas('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: customer.id,
      billingType: 'UNDEFINED',
      value: 119,
      cycle: 'MONTHLY',
      nextDueDate,
      description: 'MedSupAPP - Médico Solo (teste sandbox)',
      externalReference: ownerEmail,
    }),
  });
  console.log('✅ Assinatura:', subscription.id);

  const payments = await asaas(`/subscriptions/${subscription.id}/payments`);
  const list = payments.data ?? payments;
  console.log('\n📋 Cobranças da assinatura:', Array.isArray(list) ? list.length : list);

  console.log('\n✅ Pronto. Anote:');
  console.log(`   customer: ${customer.id}`);
  console.log(`   subscription: ${subscription.id}`);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
