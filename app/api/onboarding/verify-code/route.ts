import { NextResponse } from 'next/server';
import { verifyStoredCode } from '@/lib/onboardingCodeStore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const code = typeof body?.code === 'string' ? body.code.trim() : '';

    if (!email || !code) {
      return NextResponse.json({ error: 'E-mail e código são obrigatórios.' }, { status: 400 });
    }

    const verification = verifyStoredCode(email, code);
    if (!verification.valid) {
      return NextResponse.json({ error: verification.reason }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Erro verificando código de verificação:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Não foi possível verificar o código.' },
      { status: 500 }
    );
  }
}
