import { NextRequest, NextResponse } from 'next/server';
import { verifyStoredCode } from '@/lib/onboardingCodeStore';
import { signToken } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    const body = text ? JSON.parse(text) : {};

    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json({ success: false, error: 'E-mail e código são obrigatórios' }, { status: 400 });
    }

    const result = verifyStoredCode(email, code);

    if (!result.valid) {
      return NextResponse.json({ success: false, error: result.reason }, { status: 400 });
    }

    // O email já foi criado no Supabase via signUp durante o registro.
    // O Supabase já enviou um email de confirmação, mas nós estamos fazendo
    // uma verificação adicional via código próprio.
    // O usuário poderá fazer login mesmo sem email confirmado, 
    // pois controlamos o acesso via nosso middleware JWT.

    // Criar token JWT de sessão
    const userName = result.metadata?.name || email.split('@')[0];
    const userId = result.metadata?.userId || email;
    
    const sessionToken = signToken(
      { sub: userId, email, name: userName },
      'session'
    );

    return NextResponse.json({ 
      success: true, 
      message: 'E-mail verificado com sucesso',
      sessionToken,
      user: { id: userId, email, name: userName },
      role: result.metadata?.role,
      plan: result.metadata?.plan
    });
  } catch (error) {
    console.error('[verify-registration-code] Error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro na verificação.' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({ success: true }, { status: 200 });
}
