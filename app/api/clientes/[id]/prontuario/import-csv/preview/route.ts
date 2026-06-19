import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { findCliente, loadClientesStore } from '@/lib/clientesDrive';
import { loadProntuarioEntradas } from '@/lib/prontuarioEntradasDrive';
import { loadProntuarioImportMappings } from '@/lib/backupDriveExport';
import { parseProntuarioCsv } from '@/lib/prontuarioCsvParser';
import { getProntuarioCsvMaxDataRows, PRONTUARIO_CSV_ROUTE_TIMEOUT_CODE } from '@/lib/prontuarioCsvLimits';
import {
  csvRouteTimeoutResponse,
  readValidatedCsvUpload,
  withCsvRouteTimeout,
} from '@/lib/prontuarioCsvUpload';
import { requireProntuarioImportAccess } from '@/lib/prontuarioImportAuth';

/** Limite Vercel (segundos). Ajuste aqui se o plano permitir mais. */
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id: clienteId } = await params;

  const blocked = await requireProntuarioImportAccess(email, req);
  if (blocked) return blocked;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  if (!findCliente(store, clienteId)) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo CSV é obrigatório' }, { status: 400 });
  }

  const validated = await readValidatedCsvUpload(file);
  if (!validated.ok) return validated.response;

  try {
    const payload = await withCsvRouteTimeout(async () => {
      const mappings = await loadProntuarioImportMappings(tokenResult);
      const preview = parseProntuarioCsv(validated.csvText, mappings, {
        maxDataRows: getProntuarioCsvMaxDataRows(),
      });
      const existing = await loadProntuarioEntradas(tokenResult, clienteId);
      return {
        preview,
        existingCount: existing.entradas.length,
        hasExisting: existing.entradas.length > 0,
      };
    });
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof Error && err.message === PRONTUARIO_CSV_ROUTE_TIMEOUT_CODE) {
      return csvRouteTimeoutResponse();
    }
    console.error('[prontuario/import-csv/preview]', err);
    return NextResponse.json({ error: 'Erro ao analisar CSV' }, { status: 500 });
  }
}
