import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('onboarding_profiles')
      .select('*')
      .eq('email', session.user.email.toLowerCase().trim())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ profile: null, message: 'Perfil não encontrado' });
      }
      throw error;
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error('[perfil/GET] Erro:', error);
    return NextResponse.json({ error: 'Erro ao carregar perfil' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const userEmail = session.user.email.toLowerCase().trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Mapear campos permitidos para atualização
    const allowedFields = [
      'full_name', 'crm', 'specialty',
      'clinic_name', 'cnpj', 'doctors_count',
      'whatsapp', 'health_plan',
      'cep', 'street', 'address_number', 'complement',
      'neighborhood', 'city', 'state', 'country',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Se veio os campos estruturados, montar o campo address legado também
    if (body.street || body.address_number || body.neighborhood || body.city) {
      const parts = [
        body.street || '',
        body.address_number ? `, ${body.address_number}` : '',
        body.complement ? ` - ${body.complement}` : '',
        body.neighborhood ? `\nBairro: ${body.neighborhood}` : '',
        body.city ? `\n${body.city}` : '',
        body.state ? `/${body.state}` : '',
        body.cep ? `\nCEP: ${body.cep}` : '',
        body.country ? `\n${body.country}` : '',
      ].filter(Boolean);
      updateData.address = parts.join('');
    }

    const { error: upsertError } = await supabase
      .from('onboarding_profiles')
      .update(updateData)
      .eq('email', userEmail);

    if (upsertError) {
      console.error('[perfil/PUT] Erro:', upsertError);
      return NextResponse.json(
        { error: 'Erro ao atualizar perfil: ' + upsertError.message },
        { status: 500 },
      );
    }

    console.log(`[perfil/PUT] Perfil atualizado para ${userEmail}`);
    return NextResponse.json({ success: true, message: 'Perfil atualizado com sucesso!' });
  } catch (error) {
    console.error('[perfil/PUT] Erro:', error);
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 });
  }
}
