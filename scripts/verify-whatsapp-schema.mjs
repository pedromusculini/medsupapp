/**
 * Verifica tabelas WhatsApp + consultas no Supabase.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnvLocal() {
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
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

const TABLES = [
  'whatsapp_fila',
  'consultas_agenda',
  'whatsapp_lembrete_enviado',
  'whatsapp_conversa',
];

async function checkTable(name) {
  const { error } = await supabase.from(name).select('*').limit(0);
  if (error?.code === 'PGRST205' || error?.message?.includes('does not exist')) {
    return { ok: false, error: 'tabela não existe' };
  }
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

let allOk = true;
for (const table of TABLES) {
  const r = await checkTable(table);
  console.log(r.ok ? `✅ ${table}` : `❌ ${table} — ${r.error}`);
  if (!r.ok) allOk = false;
}

process.exit(allOk ? 0 : 1);
