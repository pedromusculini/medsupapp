import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  loadClientesStore,
  mergeClientesRecords,
  saveClientesStore,
} from '@/lib/clientesDrive';

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const driveToken = await requireGoogleAccessToken(req);
  if (isDriveError(driveToken)) return driveToken;

  let body: { principalId?: string; secundarioId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const principalId = String(body.principalId ?? '').trim();
  const secundarioId = String(body.secundarioId ?? '').trim();

  if (!principalId || !secundarioId) {
    return NextResponse.json(
      { error: 'Informe o cadastro principal e o cadastro a unificar.' },
      { status: 400 },
    );
  }

  try {
    const store = await loadClientesStore(driveToken, email);
    const merged = mergeClientesRecords(store, principalId, secundarioId);
    await saveClientesStore(driveToken, store);

    return NextResponse.json({
      ok: true,
      paciente: {
        id: merged.id,
        nome: merged.nome,
      },
      removido_id: secundarioId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao unificar cadastros';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
