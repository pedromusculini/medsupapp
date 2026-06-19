import {
  ageInMonths,
  formatAgeMonthsLabel,
  interpolateLms,
  percentileFromZ,
  REFERENCE_Z_LABELS,
  REFERENCE_Z_LEVELS,
  valueFromZScore,
  zScoreFromValue,
  type LmsPoint,
} from './lms';
import {
  chartAppliesToPatient,
  getLmsTable,
  type GrowthChartDef,
  type GrowthSex,
} from './catalog';

export type PatientMeasurePoint = {
  ageMonths: number;
  value: number;
  date: string;
  zScore: number;
  percentile: number;
};

export type ReferenceCurveSeries = {
  z: number;
  label: string;
  points: { ageMonths: number; value: number }[];
};

export type GrowthChartData = {
  referenceCurves: ReferenceCurveSeries[];
  patientPoints: PatientMeasurePoint[];
  ageTicks: { ageMonths: number; label: string }[];
};

export function buildGrowthChartData(opts: {
  chart: GrowthChartDef;
  sex: GrowthSex;
  birthDate: string;
  measures: { date: string; value: number }[];
}): GrowthChartData {
  const { chart, sex, birthDate, measures } = opts;
  const table = getLmsTable(chart.indicator, sex).filter(
    (p) => p.ageMonths >= chart.ageMinMonths && p.ageMonths <= chart.ageMaxMonths,
  );

  const referenceCurves: ReferenceCurveSeries[] = REFERENCE_Z_LEVELS.map((z) => ({
    z,
    label: REFERENCE_Z_LABELS[z] ?? `Z${z}`,
    points: table
      .map((row) => ({
        ageMonths: row.ageMonths,
        value: valueFromZScore(row, z),
      }))
      .filter((p) => Number.isFinite(p.value)),
  }));

  const patientPoints: PatientMeasurePoint[] = measures
    .map((m) => {
      const ageMonths = ageInMonths(birthDate, m.date);
      if (!Number.isFinite(ageMonths) || !chartAppliesToPatient(chart, ageMonths)) return null;
      const lms = interpolateLms(table, ageMonths);
      if (!lms) return null;
      const z = zScoreFromValue(lms, m.value);
      return {
        ageMonths,
        value: m.value,
        date: m.date,
        zScore: z,
        percentile: percentileFromZ(z),
      };
    })
    .filter((p): p is PatientMeasurePoint => p != null)
    .sort((a, b) => a.ageMonths - b.ageMonths);

  const tickAges = pickAgeTicks(chart.ageMinMonths, chart.ageMaxMonths);
  const ageTicks = tickAges.map((ageMonths) => ({
    ageMonths,
    label: formatAgeMonthsLabel(ageMonths),
  }));

  return { referenceCurves, patientPoints, ageTicks };
}

function pickAgeTicks(min: number, max: number): number[] {
  const span = max - min;
  const step =
    span <= 24 ? 3 : span <= 60 ? 6 : span <= 120 ? 12 : span <= 180 ? 24 : 36;
  const ticks: number[] = [];
  for (let a = min; a <= max; a += step) ticks.push(a);
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return ticks;
}

/** Extrai medidas das séries do prontuário. */
export function measuresFromSeries(
  series: Record<string, { data: string; hora: string | null; valor: number }[]>,
  measureKey: string,
): { date: string; value: number }[] {
  const pts = series[measureKey] ?? [];
  return pts.map((p) => ({ date: p.data, value: p.valor }));
}

/** Calcula IMC a partir de séries de peso e altura na mesma data. */
export function imcMeasuresFromSeries(
  series: Record<string, { data: string; hora: string | null; valor: number }[]>,
): { date: string; value: number }[] {
  const pesos = new Map<string, number>();
  const alturas = new Map<string, number>();
  for (const p of series.peso_kg ?? []) pesos.set(p.data, p.valor);
  for (const p of series.altura_cm ?? []) alturas.set(p.data, p.valor);

  const dates = new Set([...pesos.keys(), ...alturas.keys()]);
  const out: { date: string; value: number }[] = [];
  for (const date of dates) {
    const kg = pesos.get(date);
    const cm = alturas.get(date);
    if (kg == null || cm == null || cm <= 0) continue;
    const m = cm / 100;
    out.push({ date, value: Math.round((kg / (m * m)) * 100) / 100 });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function parsePatientSex(
  sexo: string | null | undefined,
): GrowthSex | null {
  const s = (sexo ?? '').trim().toLowerCase();
  if (['m', 'masculino', 'menino', 'male', 'homem'].includes(s)) return 'male';
  if (['f', 'feminino', 'menina', 'female', 'mulher'].includes(s)) return 'female';
  return null;
}

export type LmsPointExport = LmsPoint;
