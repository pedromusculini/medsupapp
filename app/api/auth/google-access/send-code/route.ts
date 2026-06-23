import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateVerificationCode } from '@/lib/googleAccountAccess';
import {
  storeGoogleAccessCode,
  VERIFICATION_CODES_SETUP_HINT,
} from '@/lib/googleVerificationCodes';
import { sendVerificationEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/rateLimit';
import { VERIFICATION_CODE_TTL_MINUTES } from '@/lib/constants';

export const runtime = 'nodejs';

function mapStoreError(err: unknown): { status: number; error: string } {
  const message = err instanceof Error ? err.message : '';
  if (message.startsWith('MISSING_TABLE:')) {
    return {
      status: 503,
      error: message.slice('MISSING_TABLE:'.length) || VERIFICATION_CODES_SETUP_HINT,
    };
  }
  if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    return {
      status: 503,
      error:
        'Servidor sem acesso ao banco (SUPABASE_SERVICE_ROLE_KEY). Configure na Vercel.',
    };
  }
  return {
    status: 500,
    error: message || 'Não foi possível gerar o código. Tente novamente.',
  };
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email || !session.googleSub) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const email = session.user.email.toLowerCase().trim();
    const limit = await checkRateLimit(`send-code:${email}`, 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `Aguarde ${limit.retryAfterSec ?? 60}s antes de solicitar outro código.`,
        },
        { status: 429 },
      );
    }

    const code = generateVerificationCode();

    try {
      await storeGoogleAccessCode(email, session.googleSub, code);
    } catch (err) {
      console.error('[google-access/send-code] store:', err);
      const mapped = mapStoreError(err);
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }

    let emailDeliveryId: string | null = null;
    try {
      const sent = await sendVerificationEmail(email, code);
      emailDeliveryId = sent.id;
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
      emailDeliveryId,
      expiresInMinutes: VERIFICATION_CODE_TTL_MINUTES,
    });
  } catch (err) {
    console.error('[google-access/send-code] unexpected:', err);
    return NextResponse.json(
      { error: 'Erro interno ao enviar código. Tente novamente.' },
      { status: 500 },
    );
  }
}
