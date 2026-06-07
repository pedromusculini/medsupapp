import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { checkRateLimit, resetRateLimit } from '@/lib/rateLimit';
import {
  getProntuarioSeguranca,
  PRONTUARIO_COOKIE_NAME,
  signProntuarioUnlockCookie,
  validatePinFormat,
  verifySecret,
} from '@/lib/prontuarioAcesso';

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const limit = checkRateLimit(`prontuario-pin:${email}`, 8, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Muitas tentativas. Aguarde ${limit.retryAfterSec ?? 60}s.` },
      { status: 429 },
    );
  }

  const body = await req.json();
  const pin = String(body.pin ?? '').trim();
  const pinError = validatePinFormat(pin);
  if (pinError) {
    return NextResponse.json({ error: pinError }, { status: 400 });
  }

  const row = await getProntuarioSeguranca(email);
  if (!row?.pin_hash) {
    return NextResponse.json(
      { error: 'Configure um PIN em Meu Perfil antes de desbloquear o prontuário.' },
      { status: 400 },
    );
  }

  const ok = await verifySecret(pin, row.pin_hash);
  if (!ok) {
    return NextResponse.json({ error: 'PIN incorreto.' }, { status: 401 });
  }

  resetRateLimit(`prontuario-pin:${email}`);

  const token = signProntuarioUnlockCookie(email);
  const res = NextResponse.json({
    success: true,
    unlocked: true,
    message: 'Prontuário desbloqueado por 30 minutos.',
  });

  res.cookies.set(PRONTUARIO_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 60,
    path: '/',
  });

  return res;
}
