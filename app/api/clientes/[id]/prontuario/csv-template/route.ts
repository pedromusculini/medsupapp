import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { findCliente, loadClientesStore } from '@/lib/clientesDrive';
import { csvTemplateWithBom } from '@/lib/prontuarioEntradasDrive';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { id: clienteId } = await params;

  const tokenResult = await requireGoogleAccessToken(_req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, authResult.email);
  if (!findCliente(store, clienteId)) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const body = csvTemplateWithBom();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="modelo_prontuario.csv"',
    },
  });
}
