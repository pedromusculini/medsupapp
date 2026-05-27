import { NextRequest, NextResponse } from 'next/server';
import { storeVerificationCode } from '@/lib/onboardingCodeStore';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    // Safe parsing
    const body = await request.json().catch(() => ({}));
    const { email, role, plan } = body || {};

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false, error: 'E-mail inválido' }, { status: 400 });
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Store the code with role and plan metadata
    storeVerificationCode(email, code, { role, plan });

    // Attempt to send the actual email
    try {
      await sendVerificationEmail(email, code);
    } catch (emailErr) {
      console.error('[send-verification-code] Email failure:', emailErr);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Código para ${email}: ${code}`);
      // Em desenvolvimento, retornamos o código para facilitar o teste
      return NextResponse.json({ 
        success: true, 
        message: 'Código enviado com sucesso',
        devCode: code // Apenas em desenvolvimento
      });
    }

    return NextResponse.json({ success: true, message: 'Código enviado com sucesso' });
  } catch (error) {
    console.error('[send-verification-code] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno no servidor de e-mail.' 
      }, 
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
