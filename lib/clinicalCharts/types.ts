import type { GrowthIndicator } from '@/lib/growthCharts/catalog';

export type ClinicalChartGroup =
  | 'pediatria'
  | 'cardiometabolico'
  | 'oncologia'
  | 'escalas'
  | 'pneumo'
  | 'geral';

export type ClinicalChartKind =
  | 'lms-age'
  | 'time-goals'
  | 'time-zones'
  | 'time-recist'
  | 'time-plain';

export type GoalLineDef = {
  value: number;
  label: string;
  color?: string;
};

export type ZoneBandDef = {
  min: number;
  max: number;
  label: string;
  color: string;
};

export type ClinicalChartDef = {
  id: string;
  group: ClinicalChartGroup;
  kind: ClinicalChartKind;
  label: string;
  measureKey: string;
  yLabel: string;
  source: string;
  /** lms-age */
  lmsIndicator?: GrowthIndicator;
  ageMinMonths?: number;
  ageMaxMonths?: number;
  /** Metas horizontais (valor absoluto). */
  goals?: GoalLineDef[];
  /** Faixas de interpretação (escalas). */
  zones?: ZoneBandDef[];
  yMax?: number;
  requiresBirthDate?: boolean;
  requiresSex?: boolean;
};

export const CLINICAL_CHART_GROUPS: { id: ClinicalChartGroup; label: string }[] = [
  { id: 'pediatria', label: 'Pediatria' },
  { id: 'cardiometabolico', label: 'Cardiometabólico' },
  { id: 'oncologia', label: 'Oncologia' },
  { id: 'escalas', label: 'Escalas' },
  { id: 'pneumo', label: 'Pneumo' },
  { id: 'geral', label: 'Geral' },
];
