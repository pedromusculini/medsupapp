import type { GrowthSex } from '@/lib/growthCharts/catalog';

type SeriePonto = { data: string; hora: string | null; valor: number };

export function measuresFromSeries(
  series: Record<string, SeriePonto[]>,
  measureKey: string,
): { date: string; value: number }[] {
  return (series[measureKey] ?? []).map((p) => ({ date: p.data, value: p.valor }));
}

export function imcMeasuresFromSeries(
  series: Record<string, SeriePonto[]>,
): { date: string; value: number }[] {
  const pesos = new Map<string, number>();
  const alturas = new Map<string, number>();
  for (const p of series.peso_kg ?? []) pesos.set(p.data, p.valor);
  for (const p of series.altura_cm ?? []) alturas.set(p.data, p.valor);
  const out: { date: string; value: number }[] = [];
  for (const date of new Set([...pesos.keys(), ...alturas.keys()])) {
    const kg = pesos.get(date);
    const cm = alturas.get(date);
    if (kg == null || cm == null || cm <= 0) continue;
    const m = cm / 100;
    out.push({ date, value: Math.round((kg / (m * m)) * 100) / 100 });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function parsePatientSex(sexo: string | null | undefined): GrowthSex | null {
  const s = (sexo ?? '').trim().toLowerCase();
  if (['m', 'masculino', 'menino', 'male', 'homem'].includes(s)) return 'male';
  if (['f', 'feminino', 'menina', 'female', 'mulher'].includes(s)) return 'female';
  return null;
}

export function formatDateLabel(iso: string): string {
  try {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y?.slice(2)}`;
  } catch {
    return iso;
  }
}

export function discoverPlainSeries(
  series: Record<string, SeriePonto[]>,
  excludeKeys: Set<string>,
): string[] {
  return Object.keys(series)
    .filter((k) => !excludeKeys.has(k) && (series[k]?.length ?? 0) >= 2)
    .sort();
}
