/**
 * Verifica deploy, /api/whatsapp/status e webhook GET (sem expor secrets).
 * Uso: node scripts/check-whatsapp-production.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const BASE = process.env.CHECK_BASE_URL || 'https://www.medsupapp.com.br';

function loadEnvLocal() {
  const env = {};
  try {
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
      env[key] = val;
    }
  } catch {
    return {};
  }
  return env;
}

const env = loadEnvLocal();

async function main() {
  console.log('🔍 Base:', BASE);

  const statusRes = await fetch(`${BASE}/api/whatsapp/status`);
  const status = await statusRes.json().catch(() => ({}));
  console.log('\n/api/whatsapp/status', statusRes.status);
  console.log('  configured:', status.configured);
  console.log('  lembrete template:', status.templates?.lembrete_consulta);
  console.log('  features:', status.features);

  const token = env.WHATSAPP_VERIFY_TOKEN;
  if (token) {
    const q = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': token,
      'hub.challenge': 'medsup_challenge_ok',
    });
    const whRes = await fetch(`${BASE}/api/whatsapp/webhook?${q}`);
    const whText = await whRes.text();
    console.log('\n/webhook GET verify:', whRes.status, whRes.ok ? 'OK' : whText.slice(0, 80));
  } else {
    console.log('\n/webhook GET — WHATSAPP_VERIFY_TOKEN não está no .env.local');
  }

  const cron = env.CRON_SECRET;
  if (cron) {
    const cronRes = await fetch(`${BASE}/api/whatsapp/lembrete-agendado`, {
      headers: { Authorization: `Bearer ${cron}` },
    });
    const cronBody = await cronRes.json().catch(() => ({}));
    console.log('\n/lembrete-agendado cron:', cronRes.status, JSON.stringify(cronBody).slice(0, 200));
  } else {
    console.log('\n/lembrete-agendado — CRON_SECRET ausente no .env.local');
  }

  if (!status.configured) {
    console.log('\n⚠️  Configure WHATSAPP_* na Vercel Production e redeploy.');
  }
  if (!status.templates?.lembrete_consulta) {
    console.log('⚠️  WHATSAPP_TEMPLATE_LEMBRETE_CONSULTA: crie template na Meta e defina o nome na Vercel.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
