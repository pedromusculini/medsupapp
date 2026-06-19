/**
 * Baixa WHO2006.csv (0-5a) e WHO2007.csv (5-19a) do repositório rcpch/growth-references
 * e gera JSON compacto em lib/growthCharts/data/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'lib', 'growthCharts', 'data');

const WHO2006_URL =
  'https://raw.githubusercontent.com/rcpch/growth-references/main/who2006/WHO2006.csv';
const WHO2007_URL =
  'https://raw.githubusercontent.com/rcpch/growth-references/main/who2006/WHO2007.csv';

function parseNum(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function parseWho2006(csv) {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const tables = {
    lhfa: { male: [], female: [] },
    wfa: { male: [], female: [] },
    bfa: { male: [], female: [] },
    hcfa: { male: [], female: [] },
  };

  for (let i = 4; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const years = parseNum(cols[1]);
    if (years == null) continue;
    const ageMonths = Math.round(years * 12 * 10) / 10;

    const push = (key, sex, l, m, s) => {
      if (l == null || m == null || s == null) return;
      tables[key][sex].push({ ageMonths, L: l, M: m, S: s });
    };

    push('lhfa', 'male', parseNum(cols[2]), parseNum(cols[3]), parseNum(cols[4]));
    push('lhfa', 'female', parseNum(cols[5]), parseNum(cols[6]), parseNum(cols[7]));
    push('wfa', 'male', parseNum(cols[8]), parseNum(cols[9]), parseNum(cols[10]));
    push('wfa', 'female', parseNum(cols[11]), parseNum(cols[12]), parseNum(cols[13]));
    push('bfa', 'male', parseNum(cols[14]), parseNum(cols[15]), parseNum(cols[16]));
    push('bfa', 'female', parseNum(cols[17]), parseNum(cols[18]), parseNum(cols[19]));
    push('hcfa', 'male', parseNum(cols[20]), parseNum(cols[21]), parseNum(cols[22]));
    push('hcfa', 'female', parseNum(cols[23]), parseNum(cols[24]), parseNum(cols[25]));
  }

  return tables;
}

function parseWho2007(csv) {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const tables = {
    lhfa: { male: [], female: [] },
    wfa: { male: [], female: [] },
    bfa: { male: [], female: [] },
  };

  for (let i = 3; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const month = parseNum(cols[0]);
    if (month == null || month < 61) continue;
    const ageMonths = month;

    const push = (key, sex, l, m, s) => {
      if (l == null || m == null || s == null) return;
      tables[key][sex].push({ ageMonths, L: l, M: m, S: s });
    };

    push('lhfa', 'male', parseNum(cols[2]), parseNum(cols[3]), parseNum(cols[4]));
    push('lhfa', 'female', parseNum(cols[5]), parseNum(cols[6]), parseNum(cols[7]));
    push('wfa', 'male', parseNum(cols[8]), parseNum(cols[9]), parseNum(cols[10]));
    push('wfa', 'female', parseNum(cols[11]), parseNum(cols[12]), parseNum(cols[13]));
    push('bfa', 'male', parseNum(cols[14]), parseNum(cols[15]), parseNum(cols[16]));
    push('bfa', 'female', parseNum(cols[17]), parseNum(cols[18]), parseNum(cols[19]));
  }

  return tables;
}

function mergeTables(a, b) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[key] = { male: [], female: [] };
    for (const sex of ['male', 'female']) {
      const combined = [...(a[key]?.[sex] ?? []), ...(b[key]?.[sex] ?? [])];
      combined.sort((x, y) => x.ageMonths - y.ageMonths);
      const seen = new Set();
      out[key][sex] = combined.filter((p) => {
        const k = p.ageMonths;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
  }
  return out;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const [csv06, csv07] = await Promise.all([
    fetch(WHO2006_URL).then((r) => r.text()),
    fetch(WHO2007_URL).then((r) => r.text()),
  ]);

  const t06 = parseWho2006(csv06);
  const t07 = parseWho2007(csv07);
  const merged = mergeTables(t06, t07);

  const meta = {
    source: 'WHO Child Growth Standards / WHO Reference 5-19 (via rcpch/growth-references)',
    license: 'See https://github.com/rcpch/growth-references',
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(OUT, 'who-lms.json'),
    JSON.stringify({ meta, tables: merged }),
  );

  console.log('WHO LMS data written to lib/growthCharts/data/who-lms.json');
  for (const [k, v] of Object.entries(merged)) {
    console.log(`  ${k}: male=${v.male.length} female=${v.female.length}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
