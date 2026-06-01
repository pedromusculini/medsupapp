/**
 * Processa webhook Asaas direto (sem HTTP), igual à rota /api/webhooks/asaas.
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

function addMonthsFromDateString(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString();
}

async function main() {
  loadEnv();
  const email = process.env.ADMIN_EMAILS?.split(/[,;]/)[0]?.trim();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const body = {
    id: `evt_direct_${Date.now()}`,
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: 'pay_fhehpn0k4aa7lr67',
      dueDate: '2026-07-01',
      externalReference: email,
      subscription: 'sub_bou7umm6mvvok38i',
      customer: 'cus_000008067960',
    },
  };

  const { error: evErr } = await sb.from('assinaturas_webhook_events').insert({
    asaas_event_id: body.id,
    event_type: body.event,
    owner_email: email,
    asaas_payment_id: body.payment.id,
    payload: body,
  });
  if (evErr?.code === '23505') {
    console.log('Evento já processado (idempotência OK)');
    return;
  }
  if (evErr) throw evErr;

  const periodEnd = addMonthsFromDateString(body.payment.dueDate.slice(0, 10), 1);
  const { data, error } = await sb
    .from('assinaturas')
    .upsert(
      {
        owner_email: email,
        status: 'active',
        plano: 'clinica-5-pix',
        last_payment_at: new Date().toISOString(),
        current_period_end: periodEnd,
        last_asaas_payment_id: body.payment.id,
        asaas_subscription_id: body.payment.subscription,
        asaas_customer_id: body.payment.customer,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_email' },
    )
    .select()
    .single();

  if (error) throw error;
  console.log('✅ Webhook PAYMENT_RECEIVED processado');
  console.log(data);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
