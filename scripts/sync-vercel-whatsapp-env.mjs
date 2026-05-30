/**
 * Sincroniza variáveis WhatsApp do .env.local para Vercel Production (via CLI).
 * Uso: node scripts/sync-vercel-whatsapp-env.mjs
 * Requer: vercel login + .env.local preenchido
 */
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const KEYS = [
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_BUSINESS_ACCOUNT_ID',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_API_VERSION',
  'CRON_SECRET',
  'WHATSAPP_TEMPLATE_FORMULARIO_LINK',
  'WHATSAPP_TEMPLATE_LEMBRETE_CONSULTA',
  'WHATSAPP_TEMPLATE_FORMULARIO_RECEBIDO',
  'WHATSAPP_TEMPLATE_CONFIRMACAO_PAGAMENTO',
];

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
    console.error('❌ .env.local não encontrado');
    process.exit(1);
  }
  return env;
}

function vercelEnvAdd(key, value) {
  const r = spawnSync(
    'npx',
    ['vercel', 'env', 'add', key, 'production', '--force'],
    {
      cwd: root,
      input: value,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  return r.status === 0;
}

const env = loadEnvLocal();
let ok = 0;
let skip = 0;
let fail = 0;

for (const key of KEYS) {
  const val = env[key]?.trim();
  if (!val) {
    console.log(`⏭️  ${key} — vazio no .env.local, pulando`);
    skip++;
    continue;
  }
  if (vercelEnvAdd(key, val)) {
    console.log(`✅ ${key} → Production`);
    ok++;
  } else {
    console.log(`❌ ${key} — falha (vercel login?)`);
    fail++;
  }
}

console.log(`\nResumo: ${ok} ok, ${skip} pulados, ${fail} falhas`);
if (fail > 0) process.exit(1);
console.log('ℹ️  Rode: npx vercel --prod --yes  para redeploy');
