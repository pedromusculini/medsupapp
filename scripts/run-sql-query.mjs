/**
 * Executa SQL de leitura via Supabase Management API.
 * Uso: node scripts/run-sql-query.mjs "SELECT email FROM onboarding_profiles LIMIT 5"
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

async function main() {
  loadEnv();
  const query = process.argv[2];
  if (!query) {
    console.error('Uso: node scripts/run-sql-query.mjs "SELECT ..."');
    process.exit(1);
  }
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error('Erro:', res.status, body);
    process.exit(1);
  }
  console.log(JSON.stringify(body, null, 2));
}

main();
