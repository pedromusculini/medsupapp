import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { storeVerificationCode } from '@/lib/onboardingCodeStore';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { name, email, password } = body || {};

    if (!name || !email || !password) {
      return NextResponse.json({ success: false, error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 });
    }

    // Criar cliente Supabase com ANON key (para signUp)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[REGISTER] Supabase credentials missing');
      return NextResponse.json({ success: false, error: 'Erro de configuração do servidor.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Criar usuário no Supabase Auth usando signUp (funciona com ANON key)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/verify-email`,
      },
    });

    if (authError) {
      console.error('[REGISTER] Supabase Auth error:', authError);
      
      if (authError.message?.includes('already registered') || authError.status === 409) {
        return NextResponse.json({ success: false, error: 'Este e-mail já está cadastrado. Faça login.' }, { status: 409 });
      }
      
      return NextResponse.json({ success: false, error: authError.message }, { status: 400 });
    }

    const userId = authData.user?.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Erro ao criar usuário.' }, { status: 500 });
    }

    console.log(`[REGISTER] Usuário criado no Auth: ${email} (id: ${userId})`);

    // 2. Gerar código de verificação
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    storeVerificationCode(email, code, { userId, name });

    // 3. Enviar e-mail
    try {
      await sendVerificationEmail(email, code);
    } catch (emailErr) {
      console.error('[REGISTER] Email failure:', emailErr);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Código para ${email}: ${code}`);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Usuário registrado com sucesso. Verifique seu e-mail.',
      userId,
    });
  } catch (error) {
    console.error('[register] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno ao processar cadastro.' 
      }, 
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
