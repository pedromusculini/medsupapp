import { NextResponse } from 'next/server';
import {
  formatBytesLimit,
  getProntuarioCsvMaxBytes,
  getProntuarioCsvRouteTimeoutMs,
  PRONTUARIO_CSV_ROUTE_TIMEOUT_CODE,
  PRONTUARIO_CSV_TOO_LARGE_CODE,
} from '@/lib/prontuarioCsvLimits';

export type ValidatedCsvUpload =
  | { ok: true; file: File; csvText: string }
  | { ok: false; response: NextResponse };

export function csvFileTooLargeResponse(maxBytes: number): NextResponse {
  return NextResponse.json(
    {
      error: `Arquivo muito grande. O limite é ${formatBytesLimit(maxBytes)}. Divida o CSV em partes menores.`,
      code: PRONTUARIO_CSV_TOO_LARGE_CODE,
      maxBytes,
    },
    { status: 413 },
  );
}

export function csvRouteTimeoutResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        'A análise do CSV demorou demais. Tente um arquivo menor ou com menos linhas.',
      code: PRONTUARIO_CSV_ROUTE_TIMEOUT_CODE,
    },
    { status: 504 },
  );
}

export function validateCsvFileSize(file: File): NextResponse | null {
  const maxBytes = getProntuarioCsvMaxBytes();
  if (file.size > maxBytes) {
    return csvFileTooLargeResponse(maxBytes);
  }
  return null;
}

export async function readValidatedCsvUpload(file: File): Promise<ValidatedCsvUpload> {
  const sizeError = validateCsvFileSize(file);
  if (sizeError) return { ok: false, response: sizeError };

  const csvText = await file.text();
  const byteLength = new TextEncoder().encode(csvText).length;
  const maxBytes = getProntuarioCsvMaxBytes();
  if (byteLength > maxBytes) {
    return { ok: false, response: csvFileTooLargeResponse(maxBytes) };
  }

  return { ok: true, file, csvText };
}

export async function withCsvRouteTimeout<T>(fn: () => Promise<T>): Promise<T> {
  const ms = getProntuarioCsvRouteTimeoutMs();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(PRONTUARIO_CSV_ROUTE_TIMEOUT_CODE)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
