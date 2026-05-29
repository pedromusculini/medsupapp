/**
 * Verifica conexão Supabase e tabelas operacionais.
 * Uso: node scripts/setup-supabase.mjs
 *
 * Para criar tabelas: execute sql/operacional_schema.sql no SQL Editor do Supabase.
 * Opcional: defina SUPABASE_DB_PASSWORD e DATABASE_URL para aplicar via Postgres.
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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
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

if (!url || !key) {
  console.error('❌ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

const TABLES = ['formulario_links', 'formulario_respostas', 'whatsapp_fila'];

async function checkTable(name) {
  const { error } = await supabase.from(name).select('id').limit(1);
  if (error?.code === 'PGRST205' || error?.message?.includes('does not exist')) {
    return { ok: false, error: 'tabela não existe' };
  }
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function main() {
  console.log('🔗 Supabase:', url.replace(/https:\/\/([^.]+).*/, 'https://$1.***'));

  let allOk = true;
  for (const table of TABLES) {
    const r = await checkTable(table);
    if (r.ok) {
      console.log(`✅ ${table}`);
    } else {
      console.log(`❌ ${table} — ${r.error}`);
      allOk = false;
    }
  }

  if (!allOk) {
    console.log('\n📋 Execute no Supabase → SQL Editor:\n');
    console.log('   sql/operacional_schema.sql\n');
    console.log('Ou cole o conteúdo do arquivo e clique em Run.\n');
    process.exit(1);
  }

  console.log('\n✅ Supabase operacional pronto (formulários + WhatsApp).');
  console.log('ℹ️  Dados de clientes/faturamento ficam no Google Drive do usuário.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
