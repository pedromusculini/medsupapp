import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { buildProntuarioAccessStatus } from '@/lib/prontuarioAcesso';

export async function requireProntuarioImportAccess(
  ownerEmail: string,
  req: NextRequest,
): Promise<NextResponse | null> {
  const access = await buildProntuarioAccessStatus(ownerEmail, req);

  if (access.modoRecepcao) {
    return NextResponse.json(
      { error: 'Importação de prontuário não disponível no modo recepção.' },
      { status: 403 },
    );
  }

  if (access.locked) {
    return NextResponse.json(
      {
        error: 'Desbloqueie o prontuário com o PIN da clínica antes de importar.',
        code: 'PRONTUARIO_LOCKED',
      },
      { status: 403 },
    );
  }

  return null;
}
