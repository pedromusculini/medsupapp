import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import {
  generateRecoveryCode,
  getProntuarioSeguranca,
  hashSecret,
  upsertProntuarioSeguranca,
  validatePinFormat,
  verifySecret,
} from '@/lib/prontuarioAcesso';

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = await req.json();
  const pin = String(body.pin ?? '').trim();
  const pinConfirm = String(body.pinConfirm ?? body.pin_confirm ?? '').trim();
  const pinAtual = String(body.pinAtual ?? body.pin_atual ?? '').trim();

  const pinError = validatePinFormat(pin);
  if (pinError) {
    return NextResponse.json({ error: pinError }, { status: 400 });
  }
  if (pin !== pinConfirm) {
    return NextResponse.json({ error: 'A confirmação do PIN não confere.' }, { status: 400 });
  }

  const existing = await getProntuarioSeguranca(email);
  const now = new Date().toISOString();

  if (existing?.pin_hash) {
    if (!pinAtual) {
      return NextResponse.json(
        { error: 'Informe o PIN atual ou use a recuperação se esqueceu.' },
        { status: 400 },
      );
    }
    const atualOk = await verifySecret(pinAtual, existing.pin_hash);
    if (!atualOk) {
      return NextResponse.json({ error: 'PIN atual incorreto.' }, { status: 401 });
    }

    const pinHash = await hashSecret(pin);
    await upsertProntuarioSeguranca(email, {
      pin_hash: pinHash,
      pin_updated_at: now,
    });

    return NextResponse.json({
      success: true,
      message: 'PIN alterado com sucesso.',
      recoveryCode: null,
    });
  }

  const recoveryCode = generateRecoveryCode();
  const [pinHash, recoveryHash] = await Promise.all([
    hashSecret(pin),
    hashSecret(recoveryCode),
  ]);

  await upsertProntuarioSeguranca(email, {
    pin_hash: pinHash,
    recovery_code_hash: recoveryHash,
    pin_updated_at: now,
  });

  return NextResponse.json({
    success: true,
    message: 'PIN configurado. Guarde o código de recuperação em local seguro.',
    recoveryCode,
  });
}
