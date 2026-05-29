import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/auth';

// GET /api/perfil/medicos - Listar médicos da clínica
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const clinicaEmail = session.user.email.toLowerCase().trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se é uma clínica
    const { data: profile } = await supabase
      .from('onboarding_profiles')
      .select('user_type')
      .eq('email', clinicaEmail)
      .single();

    if (!profile || profile.user_type !== 'clinica') {
      return NextResponse.json({ error: 'Apenas clínicas podem gerenciar médicos' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('clinica_medicos')
      .select('*')
      .eq('clinica_email', clinicaEmail)
      .order('nome', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ medicos: data });
  } catch (error) {
    console.error('[perfil/medicos/GET] Erro:', error);
    return NextResponse.json({ error: 'Erro ao carregar médicos' }, { status: 500 });
  }
}

// POST /api/perfil/medicos - Adicionar médico à clínica
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const clinicaEmail = session.user.email.toLowerCase().trim();
    const body = await req.json();

    if (!body.nome) {
      return NextResponse.json({ error: 'Nome do médico é obrigatório' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se é uma clínica
    const { data: profile } = await supabase
      .from('onboarding_profiles')
      .select('user_type')
      .eq('email', clinicaEmail)
      .single();

    if (!profile || profile.user_type !== 'clinica') {
      return NextResponse.json({ error: 'Apenas clínicas podem gerenciar médicos' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('clinica_medicos')
      .insert({
        clinica_email: clinicaEmail,
        nome: body.nome,
        crm: body.crm || null,
        specialty: body.specialty || null,
        whatsapp: body.whatsapp || null,
        email: body.email || null,
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[perfil/medicos/POST] Médico "${body.nome}" adicionado para ${clinicaEmail}`);
    return NextResponse.json({ medico: data, message: 'Médico adicionado com sucesso!' });
  } catch (error) {
    console.error('[perfil/medicos/POST] Erro:', error);
    return NextResponse.json({ error: 'Erro ao adicionar médico' }, { status: 500 });
  }
}

// DELETE /api/perfil/medicos - Remover médico
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const clinicaEmail = session.user.email.toLowerCase().trim();
    const { searchParams } = new URL(req.url);
    const medicoId = searchParams.get('id');

    if (!medicoId) {
      return NextResponse.json({ error: 'ID do médico é obrigatório' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from('clinica_medicos')
      .delete()
      .eq('id', medicoId)
      .eq('clinica_email', clinicaEmail);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Médico removido com sucesso!' });
  } catch (error) {
    console.error('[perfil/medicos/DELETE] Erro:', error);
    return NextResponse.json({ error: 'Erro ao remover médico' }, { status: 500 });
  }
}
