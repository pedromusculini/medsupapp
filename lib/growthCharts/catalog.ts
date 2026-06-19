import type { LmsPoint } from './lms';
import whoLms from './data/who-lms.json';

export type GrowthSex = 'male' | 'female';
export type GrowthIndicator = 'lhfa' | 'wfa' | 'bfa' | 'hcfa';

export type GrowthChartId =
  | 'oms-lhfa-0-5-pct'
  | 'oms-lhfa-5-19-pct'
  | 'oms-wfa-0-5-pct'
  | 'oms-wfa-5-10-pct'
  | 'oms-bfa-0-5-pct'
  | 'oms-bfa-5-19-pct'
  | 'oms-hcfa-0-5-pct';

export type GrowthChartDef = {
  id: GrowthChartId;
  label: string;
  shortLabel: string;
  indicator: GrowthIndicator;
  sexLabel: string;
  ageMinMonths: number;
  ageMaxMonths: number;
  yUnit: string;
  yLabel: string;
  /** Campo numérico no prontuário / séries. */
  measureKey: string;
  source: string;
};

export const GROWTH_CHART_CATALOG: GrowthChartDef[] = [
  {
    id: 'oms-lhfa-0-5-pct',
    label: 'OMS — Altura × idade (0–5 anos)',
    shortLabel: 'Altura 0–5a',
    indicator: 'lhfa',
    sexLabel: 'Meninos / Meninas',
    ageMinMonths: 0,
    ageMaxMonths: 60,
    yUnit: 'cm',
    yLabel: 'Altura (cm)',
    measureKey: 'altura_cm',
    source: 'WHO Child Growth Standards',
  },
  {
    id: 'oms-lhfa-5-19-pct',
    label: 'OMS — Altura × idade (5–19 anos)',
    shortLabel: 'Altura 5–19a',
    indicator: 'lhfa',
    sexLabel: 'Meninos / Meninas',
    ageMinMonths: 61,
    ageMaxMonths: 228,
    yUnit: 'cm',
    yLabel: 'Altura (cm)',
    measureKey: 'altura_cm',
    source: 'WHO Growth Reference 5–19 years',
  },
  {
    id: 'oms-wfa-0-5-pct',
    label: 'OMS — Peso × idade (0–5 anos)',
    shortLabel: 'Peso 0–5a',
    indicator: 'wfa',
    sexLabel: 'Meninos / Meninas',
    ageMinMonths: 0,
    ageMaxMonths: 60,
    yUnit: 'kg',
    yLabel: 'Peso (kg)',
    measureKey: 'peso_kg',
    source: 'WHO Child Growth Standards',
  },
  {
    id: 'oms-wfa-5-10-pct',
    label: 'OMS — Peso × idade (5–10 anos)',
    shortLabel: 'Peso 5–10a',
    indicator: 'wfa',
    sexLabel: 'Meninos / Meninas',
    ageMinMonths: 61,
    ageMaxMonths: 120,
    yUnit: 'kg',
    yLabel: 'Peso (kg)',
    measureKey: 'peso_kg',
    source: 'WHO Growth Reference 5–19 years',
  },
  {
    id: 'oms-bfa-0-5-pct',
    label: 'OMS — IMC × idade (0–5 anos)',
    shortLabel: 'IMC 0–5a',
    indicator: 'bfa',
    sexLabel: 'Meninos / Meninas',
    ageMinMonths: 0,
    ageMaxMonths: 60,
    yUnit: 'kg/m²',
    yLabel: 'IMC (kg/m²)',
    measureKey: 'imc',
    source: 'WHO Child Growth Standards',
  },
  {
    id: 'oms-bfa-5-19-pct',
    label: 'OMS — IMC × idade (5–19 anos)',
    shortLabel: 'IMC 5–19a',
    indicator: 'bfa',
    sexLabel: 'Meninos / Meninas',
    ageMinMonths: 61,
    ageMaxMonths: 228,
    yUnit: 'kg/m²',
    yLabel: 'IMC (kg/m²)',
    measureKey: 'imc',
    source: 'WHO Growth Reference 5–19 years',
  },
  {
    id: 'oms-hcfa-0-5-pct',
    label: 'OMS — Perímetro cefálico × idade (0–5 anos)',
    shortLabel: 'PC 0–5a',
    indicator: 'hcfa',
    sexLabel: 'Meninos / Meninas',
    ageMinMonths: 0,
    ageMaxMonths: 60,
    yUnit: 'cm',
    yLabel: 'Perímetro cefálico (cm)',
    measureKey: 'perimetro_cefalico',
    source: 'WHO Child Growth Standards',
  },
];

type WhoTables = Record<GrowthIndicator, Record<GrowthSex, LmsPoint[]>>;

const tables = (whoLms as { tables: WhoTables }).tables;

export function getLmsTable(indicator: GrowthIndicator, sex: GrowthSex): LmsPoint[] {
  return tables[indicator]?.[sex] ?? [];
}

export function chartAppliesToPatient(
  chart: GrowthChartDef,
  ageMonths: number,
): boolean {
  return ageMonths >= chart.ageMinMonths && ageMonths <= chart.ageMaxMonths;
}

export function suggestedChartsForAge(ageMonths: number): GrowthChartDef[] {
  return GROWTH_CHART_CATALOG.filter((c) => chartAppliesToPatient(c, ageMonths));
}
