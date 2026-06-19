import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { findCliente, loadClientesStore } from '@/lib/clientesDrive';
import { commitProntuarioCsvImport, type ImportMode } from '@/lib/prontuarioCsvImport';
import { loadProntuarioImportMappings } from '@/lib/backupDriveExport';
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
  const modeRaw = String(form.get('mode') ?? 'append');
  const mode: ImportMode = modeRaw === 'replace' ? 'replace' : 'append';

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo CSV é obrigatório' }, { status: 400 });
  }

  const validated = await readValidatedCsvUpload(file);
  if (!validated.ok) return validated.response;

  const mappings = await loadProntuarioImportMappings(tokenResult);
  const parseOptions = { maxDataRows: getProntuarioCsvMaxDataRows() };

  try {
    const outcome = await withCsvRouteTimeout(async () =>
      commitProntuarioCsvImport({
        accessToken: tokenResult,
        clienteDriveId: clienteId,
        csvText: validated.csvText,
        mode,
        mappings,
        parseOptions,
      }),
    );

    const { result, preview } = outcome;

    if (result.importadas === 0 && preview.entradasValidas === 0) {
      return NextResponse.json(
        {
          error: 'Nenhuma evolução válida encontrada no arquivo.',
          result,
          preview,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      mode,
      result,
      preview: {
        layout: preview.layout,
        entradasValidas: preview.entradasValidas,
        entradasInvalidas: preview.entradasInvalidas,
        totalLinhas: preview.totalLinhas,
        totalLinhasArquivo: preview.totalLinhasArquivo,
        linhasTruncadas: preview.linhasTruncadas,
        avisos: preview.avisos,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === PRONTUARIO_CSV_ROUTE_TIMEOUT_CODE) {
      return csvRouteTimeoutResponse();
    }
    console.error('[prontuario/import-csv]', err);
    return NextResponse.json({ error: 'Erro ao importar prontuário' }, { status: 500 });
  }
}
