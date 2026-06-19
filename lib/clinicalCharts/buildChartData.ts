import {
  ageInMonths,
  formatAgeMonthsLabel,
  interpolateLms,
  percentileFromZ,
  REFERENCE_Z_LABELS,
  REFERENCE_Z_LEVELS,
  valueFromZScore,
  zScoreFromValue,
} from '@/lib/growthCharts/lms';
import { getLmsTable } from '@/lib/growthCharts/catalog';
import type { GrowthSex } from '@/lib/growthCharts/catalog';
import type { ClinicalChartDef, GoalLineDef } from './types';
import { formatDateLabel } from './seriesUtils';

export type TimePoint = {
  date: string;
  dateLabel: string;
  value: number;
  index: number;
  zScore?: number;
  percentile?: number;
  pctChange?: number;
};

export type LmsChartResult = {
  kind: 'lms-age';
  plotData: Record<string, number | string>[];
  scatterData: Array<{
    ageMonths: number;
    patient: number;
    date: string;
    zScore: number;
    percentile: number;
  }>;
  referenceKeys: { key: string; z: number; label: string }[];
};

export type TimeChartResult = {
  kind: 'time';
  lineData: TimePoint[];
  goals: GoalLineDef[];
  recistGoals?: GoalLineDef[];
};

export function buildLmsChartData(opts: {
  chart: ClinicalChartDef;
  sex: GrowthSex;
  birthDate: string;
  measures: { date: string; value: number }[];
}): LmsChartResult {
  const { chart, sex, birthDate, measures } = opts;
  const indicator = chart.lmsIndicator!;
  const table = getLmsTable(indicator, sex).filter(
    (p) =>
      p.ageMonths >= (chart.ageMinMonths ?? 0) &&
      p.ageMonths <= (chart.ageMaxMonths ?? 228),
  );

  const referenceCurves = REFERENCE_Z_LEVELS.map((z) => ({
    z,
    label: REFERENCE_Z_LABELS[z] ?? `Z${z}`,
    points: table
      .map((row) => ({
        ageMonths: row.ageMonths,
        value: valueFromZScore(row, z),
      }))
      .filter((p) => Number.isFinite(p.value)),
  }));

  const scatterData = measures
    .map((m) => {
      const ageMonths = ageInMonths(birthDate, m.date);
      const minA = chart.ageMinMonths ?? 0;
      const maxA = chart.ageMaxMonths ?? 228;
      if (!Number.isFinite(ageMonths) || ageMonths < minA || ageMonths > maxA) {
        return null;
      }
      const lms = interpolateLms(table, ageMonths);
      if (!lms) return null;
      const z = zScoreFromValue(lms, m.value);
      return {
        ageMonths,
        patient: m.value,
        date: m.date,
        zScore: z,
        percentile: percentileFromZ(z),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null)
    .sort((a, b) => a.ageMonths - b.ageMonths);

  const ages = new Set<number>();
  for (const c of referenceCurves) for (const p of c.points) ages.add(p.ageMonths);
  for (const p of scatterData) ages.add(p.ageMonths);

  const plotData = [...ages]
    .filter(
      (a) =>
        a >= (chart.ageMinMonths ?? 0) && a <= (chart.ageMaxMonths ?? 228),
    )
    .sort((a, b) => a - b)
    .map((ageMonths) => {
      const row: Record<string, number | string> = {
        ageMonths,
        ageLabel: formatAgeMonthsLabel(ageMonths),
      };
      for (const curve of referenceCurves) {
        const y = interpolateAt(curve.points, ageMonths, 'ageMonths');
        if (y != null) row[`z${curve.z}`] = Math.round(y * 100) / 100;
      }
      return row;
    });

  return {
    kind: 'lms-age',
    plotData,
    scatterData,
    referenceKeys: referenceCurves.map((c) => ({
      key: `z${c.z}`,
      z: c.z,
      label: c.label,
    })),
  };
}

export function buildTimeChartData(opts: {
  chart: ClinicalChartDef;
  measures: { date: string; value: number }[];
}): TimeChartResult {
  const { chart, measures } = opts;
  const sorted = [...measures].sort((a, b) => a.date.localeCompare(b.date));
  const baseline = sorted[0]?.value;

  const lineData: TimePoint[] = sorted.map((m, index) => {
    const pt: TimePoint = {
      date: m.date,
      dateLabel: formatDateLabel(m.date),
      value: m.value,
      index,
    };
    if (chart.kind === 'time-recist' && baseline != null && baseline > 0) {
      if (chart.measureKey === 'carga_tumoral_pct') {
        pt.pctChange = m.value;
      } else {
        pt.pctChange = ((m.value - baseline) / baseline) * 100;
      }
    }
    return pt;
  });

  let recistGoals: GoalLineDef[] | undefined;
  if (chart.kind === 'time-recist' && baseline != null && baseline > 0) {
    if (chart.measureKey === 'carga_tumoral_pct') {
      recistGoals = [
        { value: -30, label: 'RP −30%', color: '#86efac' },
        { value: 20, label: 'PD +20%', color: '#fca5a5' },
        { value: 0, label: 'Basal', color: '#94a3b8' },
      ];
    } else {
      recistGoals = [
        { value: baseline * 0.7, label: 'RP −30%', color: '#86efac' },
        { value: baseline * 1.2, label: 'PD +20%', color: '#fca5a5' },
        { value: baseline, label: 'Basal', color: '#94a3b8' },
      ];
    }
  }

  return {
    kind: 'time',
    lineData,
    goals: chart.goals ?? [],
    recistGoals,
  };
}

function interpolateAt(
  points: { ageMonths: number; value: number }[],
  x: number,
  key: 'ageMonths',
): number | null {
  if (points.length === 0) return null;
  if (x <= points[0][key]) return points[0].value;
  if (x >= points[points.length - 1][key]) return points[points.length - 1].value;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (x >= a[key] && x <= b[key]) {
      const t = (x - a[key]) / (b[key] - a[key]);
      return a.value + t * (b.value - a.value);
    }
  }
  return null;
}
