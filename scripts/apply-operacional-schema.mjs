/**
 * Aplica sql/operacional_schema.sql via Supabase Management API.
 * Requer: SUPABASE_ACCESS_TOKEN e NEXT_PUBLIC_SUPABASE_URL no ambiente.
 */
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

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!accessToken) {
  console.error('❌ Defina SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}
if (!supabaseUrl) {
  console.error('❌ Defina NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const sql = readFileSync(join(root, 'sql', 'operacional_schema.sql'), 'utf8');

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const body = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error('❌ Erro ao executar SQL:', res.status, body);
  process.exit(1);
}

console.log('✅ Schema operacional aplicado no projeto', projectRef);
console.log(JSON.stringify(body, null, 2));
