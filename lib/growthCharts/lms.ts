/** LMS (Lambda-Mu-Sigma) — método OMS para curvas de crescimento. */

export type LmsPoint = {
  ageMonths: number;
  L: number;
  M: number;
  S: number;
};

/** Valor no eixo Y para um Z-score dado (curva de referência). */
export function valueFromZScore(lms: Pick<LmsPoint, 'L' | 'M' | 'S'>, z: number): number {
  const { L, M, S } = lms;
  if (Math.abs(L) < 1e-7) {
    return M * Math.exp(S * z);
  }
  const base = 1 + L * S * z;
  if (base <= 0) return NaN;
  return M * base ** (1 / L);
}

/** Z-score de uma medida observada. */
export function zScoreFromValue(lms: Pick<LmsPoint, 'L' | 'M' | 'S'>, value: number): number {
  const { L, M, S } = lms;
  if (value <= 0 || M <= 0) return NaN;
  if (Math.abs(L) < 1e-7) {
    return Math.log(value / M) / S;
  }
  return ((value / M) ** L - 1) / (L * S);
}

/** Percentil a partir do Z-score (distribuição normal padrão). */
export function percentileFromZ(z: number): number {
  if (!Number.isFinite(z)) return NaN;
  return normalCdf(z) * 100;
}

/** Interpola LMS entre dois pontos de referência. */
export function interpolateLms(table: LmsPoint[], ageMonths: number): LmsPoint | null {
  if (table.length === 0) return null;
  if (ageMonths <= table[0].ageMonths) return table[0];
  if (ageMonths >= table[table.length - 1].ageMonths) return table[table.length - 1];

  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (ageMonths >= a.ageMonths && ageMonths <= b.ageMonths) {
      const t = (ageMonths - a.ageMonths) / (b.ageMonths - a.ageMonths);
      return {
        ageMonths,
        L: a.L + t * (b.L - a.L),
        M: a.M + t * (b.M - a.M),
        S: a.S + t * (b.S - a.S),
      };
    }
  }
  return table[table.length - 1];
}

/** Idade em meses entre data de nascimento e data da medida. */
export function ageInMonths(birthDate: string, measureDate: string): number {
  const birth = parseDate(birthDate);
  const measure = parseDate(measureDate);
  if (!birth || !measure) return NaN;
  const days = (measure.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, days / 30.4375);
}

function parseDate(iso: string): Date | null {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Aproximação de Abramowitz & Stegun para Φ(z). */
function normalCdf(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y =
    1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/** Rótulos de curvas de referência. */
export const REFERENCE_Z_LEVELS = [-3, -2, -1, 0, 1, 2, 3] as const;

export const REFERENCE_Z_LABELS: Record<number, string> = {
  [-3]: 'P0,1',
  [-2]: 'P2,3',
  [-1]: 'P15,9',
  0: 'P50',
  1: 'P84,1',
  2: 'P97,7',
  3: 'P99,9',
};

export function formatAgeMonthsLabel(months: number): string {
  if (months < 24) return `${Math.round(months)}m`;
  const years = months / 12;
  if (years < 10) return `${years.toFixed(1)}a`;
  return `${Math.round(years)}a`;
}
