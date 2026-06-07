import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { upsertProntuarioSeguranca } from '@/lib/prontuarioAcesso';

export async function PATCH(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = await req.json();
  const enabled = Boolean(body.enabled ?? body.modo_recepcao);

  await upsertProntuarioSeguranca(email, { modo_recepcao: enabled });

  return NextResponse.json({
    success: true,
    modoRecepcao: enabled,
    message: enabled
      ? 'Modo recepção ativado — prontuário oculto nesta sessão.'
      : 'Modo recepção desativado.',
  });
}
