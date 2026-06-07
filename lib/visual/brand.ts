/**
 * Identidade visual MedSupAPP — paleta e gráficos.
 * CORES espelham lib/constants.ts; evite hex soltos em componentes novos.
 */

import { CORES as CORES_CONST } from '@/lib/constants';

export const PRODUCT_NAME = 'MedSupAPP' as const;

export const CORES = CORES_CONST;

/** Paleta para gráficos Recharts (donut, barras, linha) — derivada de emerald */
export const CHART_COLORS = [
  '#059669',
  '#065f46',
  '#10b981',
  CORES.primary,
  '#047857',
  '#34d399',
  CORES.googleGreen,
  '#0d9488',
  '#6366f1',
  '#f59e0b',
] as const;
