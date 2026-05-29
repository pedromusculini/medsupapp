import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const { data: profile } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('user_type')
      .eq('email', clinicaEmail)
      .single();

    if (!profile || profile.user_type !== 'clinica') {
      return NextResponse.json({ error: 'Apenas clínicas podem gerenciar médicos' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
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

export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const body = await req.json();

    if (!body.nome) {
      return NextResponse.json({ error: 'Nome do médico é obrigatório' }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('user_type')
      .eq('email', clinicaEmail)
      .single();

    if (!profile || profile.user_type !== 'clinica') {
      return NextResponse.json({ error: 'Apenas clínicas podem gerenciar médicos' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
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

    return NextResponse.json({ medico: data, message: 'Médico adicionado com sucesso!' });
  } catch (error) {
    console.error('[perfil/medicos/POST] Erro:', error);
    return NextResponse.json({ error: 'Erro ao adicionar médico' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const medicoId = new URL(req.url).searchParams.get('id');

    if (!medicoId) {
      return NextResponse.json({ error: 'ID do médico é obrigatório' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
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
