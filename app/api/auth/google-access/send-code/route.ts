import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateFourDigitCode } from '@/lib/googleAccountAccess';
import { storeGoogleAccessCode } from '@/lib/googleVerificationCodes';
import { sendVerificationEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST() {
  const session = await auth();
  if (!session?.user?.email || !session.googleSub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const email = session.user.email.toLowerCase().trim();
  const code = generateFourDigitCode();

  try {
    await storeGoogleAccessCode(email, session.googleSub, code);
  } catch (err) {
    console.error('[google-access/send-code] store:', err);
    return NextResponse.json(
      { error: 'Não foi possível gerar o código. Tente novamente.' },
      { status: 500 },
    );
  }

  try {
    await sendVerificationEmail(email, code);
  } catch (err) {
    console.error('[google-access/send-code] email:', err);
    const message =
      err instanceof Error
        ? err.message
        : 'Falha ao enviar e-mail. Verifique a caixa de spam ou use Reenviar código.';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    message: `Código enviado para ${email}. Verifique a caixa de entrada e o spam.`,
  });
}
