import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendVerificationEmail } from '@/lib/email';
import {
  generateProntuarioResetOtp,
  storeProntuarioPinResetCode,
  verifyProntuarioPinResetCode,
} from '@/lib/prontuarioVerificationCodes';
import {
  generateRecoveryCode,
  getProntuarioSeguranca,
  hashSecret,
  upsertProntuarioSeguranca,
  validatePinFormat,
  verifySecret,
} from '@/lib/prontuarioAcesso';

/** Envia OTP por e-mail para reset do PIN (secundário — ver aviso sobre e-mail compartilhado). */
export async function PUT(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email, googleSub } = authResult;

  const row = await getProntuarioSeguranca(email);
  if (!row?.pin_hash) {
    return NextResponse.json({ error: 'Nenhum PIN configurado.' }, { status: 400 });
  }

  const limit = await checkRateLimit(`prontuario-reset-email:${email}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Aguarde ${limit.retryAfterSec ?? 60}s antes de solicitar outro código.` },
      { status: 429 },
    );
  }

  const code = generateProntuarioResetOtp();
  try {
    await storeProntuarioPinResetCode(email, googleSub, code);
    await sendVerificationEmail(email, code);
  } catch (err) {
    console.error('[prontuario-acesso/recuperar-pin] email:', err);
    return NextResponse.json(
      { error: 'Não foi possível enviar o código por e-mail.' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    message: `Código enviado para ${email}. Se a secretária compartilha este e-mail, prefira o código de recuperação.`,
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email, googleSub } = authResult;

  const body = await req.json();
  const pin = String(body.pin ?? body.newPin ?? '').trim();
  const pinConfirm = String(body.pinConfirm ?? body.newPinConfirm ?? '').trim();
  const recoveryCode = String(body.recoveryCode ?? body.recovery_code ?? '')
    .trim()
    .toUpperCase();
  const emailOtp = String(body.emailOtp ?? body.email_otp ?? '').trim();

  const pinError = validatePinFormat(pin);
  if (pinError) {
    return NextResponse.json({ error: pinError }, { status: 400 });
  }
  if (pin !== pinConfirm) {
    return NextResponse.json({ error: 'A confirmação do PIN não confere.' }, { status: 400 });
  }

  const row = await getProntuarioSeguranca(email);
  if (!row?.pin_hash) {
    return NextResponse.json({ error: 'Nenhum PIN configurado.' }, { status: 400 });
  }

  let authorized = false;

  if (recoveryCode) {
    authorized = await verifySecret(recoveryCode, row.recovery_code_hash);
    if (!authorized) {
      return NextResponse.json({ error: 'Código de recuperação inválido.' }, { status: 401 });
    }
  } else if (emailOtp) {
    const otpResult = await verifyProntuarioPinResetCode(email, googleSub, emailOtp);
    if (!otpResult.valid) {
      return NextResponse.json({ error: otpResult.reason ?? 'Código inválido.' }, { status: 401 });
    }
    authorized = true;
  } else {
    return NextResponse.json(
      {
        error: 'Informe o código de recuperação (recomendado) ou o código enviado por e-mail.',
      },
      { status: 400 },
    );
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const newRecoveryCode = generateRecoveryCode();
  const now = new Date().toISOString();
  const [pinHash, recoveryHash] = await Promise.all([
    hashSecret(pin),
    hashSecret(newRecoveryCode),
  ]);

  await upsertProntuarioSeguranca(email, {
    pin_hash: pinHash,
    recovery_code_hash: recoveryHash,
    pin_updated_at: now,
  });

  return NextResponse.json({
    success: true,
    message: 'PIN redefinido. Guarde o novo código de recuperação.',
    recoveryCode: newRecoveryCode,
  });
}
