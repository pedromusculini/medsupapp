import { NextRequest, NextResponse } from 'next/server';
import { verifyStoredCode } from '@/lib/onboardingCodeStore';

export async function POST(request: NextRequest) {
  try {
    // Safe parsing
    const body = await request.json().catch(() => ({}));
    const { email, code } = body || {};

    if (!email || !code) {
      return NextResponse.json({ success: false, error: 'E-mail e código são obrigatórios' }, { status: 400 });
    }

    const result = verifyStoredCode(email, code);

    if (!result.valid) {
      return NextResponse.json({ success: false, error: result.reason }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'E-mail verificado com sucesso',
      ...result.metadata, // Include metadata (role, plan) if available
    });
  } catch (error) {
    console.error('[verify-code] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro de sistema na verificação.' 
      }, 
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
