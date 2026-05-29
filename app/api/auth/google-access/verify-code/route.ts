import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  GOOGLE_ACCESS_TABLE_SETUP_HINT,
  markEmailVerified,
} from '@/lib/googleAccountAccess';
import { verifyGoogleAccessCode } from '@/lib/googleVerificationCodes';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !session.googleSub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? '').trim();

  if (code.length !== 4) {
    return NextResponse.json(
      { error: 'Informe o código de 4 dígitos.' },
      { status: 400 },
    );
  }

  const email = session.user.email.toLowerCase().trim();
  const result = await verifyGoogleAccessCode(email, session.googleSub, code);

  if (!result.valid) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  try {
    await markEmailVerified(session.googleSub, email);
  } catch (err) {
    console.error('[google-access/verify-code] mark verified:', err);
    const msg =
      err instanceof Error ? err.message : 'Erro ao registrar verificação';
    const hint = msg.includes('MISSING_TABLE') || msg.includes('MISSING_ROW');
    return NextResponse.json(
      {
        error: hint
          ? `Código válido, mas o banco não está configurado. ${GOOGLE_ACCESS_TABLE_SETUP_HINT}`
          : `Código válido, mas falhou ao registrar: ${msg.replace(/^MISSING_[A-Z]+:/, '')}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    trialEligible: session.trialConsumed !== true,
    trialConsumed: session.trialConsumed === true,
  });
}
