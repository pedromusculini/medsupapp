import { NextResponse } from 'next/server';
import { sendVerificationEmail } from '@/lib/email';
import { storeVerificationCode } from '@/lib/onboardingCodeStore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim() : '';

    if (!email) {
      return NextResponse.json({ error: 'E-mail do usuário é obrigatório.' }, { status: 400 });
    }

    const code = String(Math.floor(1000 + Math.random() * 9000));
    storeVerificationCode(email, code);
    await sendVerificationEmail(email, code);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Erro enviando código de verificação:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Não foi possível enviar o e-mail de verificação.' },
      { status: 500 }
    );
  }
}
