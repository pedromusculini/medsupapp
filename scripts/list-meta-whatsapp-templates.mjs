/**
 * Lista templates aprovados na conta WhatsApp Business (Meta Graph API).
 * Uso: node scripts/list-meta-whatsapp-templates.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnvLocal() {
  const env = {};
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
  return env;
}

const env = loadEnvLocal();
const token = env.WHATSAPP_TOKEN;
const waba = env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const version = env.WHATSAPP_API_VERSION || 'v21.0';

if (!token || !waba) {
  console.error('❌ WHATSAPP_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID necessários no .env.local');
  process.exit(1);
}

const url = `https://graph.facebook.com/${version}/${waba}/message_templates?limit=50`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const data = await res.json();

if (!res.ok) {
  console.error('❌ Erro Meta:', data.error?.message || res.status);
  process.exit(1);
}

const list = data.data ?? [];
if (list.length === 0) {
  console.log('Nenhum template encontrado. Crie em WhatsApp Manager → Message templates.');
  process.exit(0);
}

console.log('Templates na conta:\n');
for (const t of list) {
  console.log(`  - ${t.name}  [${t.status}]  ${t.language || ''}`);
}

const approved = list.filter((t) => t.status === 'APPROVED');
const lembrete = approved.find((t) => /lembrete/i.test(t.name));
if (lembrete) {
  console.log(`\n✅ Sugestão WHATSAPP_TEMPLATE_LEMBRETE_CONSULTA=${lembrete.name}`);
} else {
  console.log('\n⚠️  Nenhum template APPROVED com "lembrete" no nome. Crie lembrete_consulta na Meta.');
}
