/** Limites de import CSV de prontuário (server + referência para UI). */

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const DEFAULT_MAX_DATA_ROWS = 10_000;
const DEFAULT_ROUTE_TIMEOUT_MS = 55_000;
const DEFAULT_MAX_DURATION_SEC = 60;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getProntuarioCsvMaxBytes(): number {
  return parsePositiveInt(process.env.PRONTUARIO_CSV_MAX_BYTES, DEFAULT_MAX_BYTES);
}

export function getProntuarioCsvMaxDataRows(): number {
  return parsePositiveInt(process.env.PRONTUARIO_CSV_MAX_DATA_ROWS, DEFAULT_MAX_DATA_ROWS);
}

export function getProntuarioCsvRouteTimeoutMs(): number {
  return parsePositiveInt(process.env.PRONTUARIO_CSV_ROUTE_TIMEOUT_MS, DEFAULT_ROUTE_TIMEOUT_MS);
}

export function getProntuarioCsvMaxDurationSec(): number {
  return parsePositiveInt(process.env.PRONTUARIO_CSV_MAX_DURATION_SEC, DEFAULT_MAX_DURATION_SEC);
}

/** Defaults exibidos na UI (espelham os defaults do servidor). */
export const PRONTUARIO_CSV_MAX_BYTES_UI = DEFAULT_MAX_BYTES;
export const PRONTUARIO_CSV_MAX_DATA_ROWS_UI = DEFAULT_MAX_DATA_ROWS;

export function formatBytesLimit(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export const PRONTUARIO_CSV_TOO_LARGE_CODE = 'CSV_TOO_LARGE';
export const PRONTUARIO_CSV_ROUTE_TIMEOUT_CODE = 'CSV_ROUTE_TIMEOUT';
