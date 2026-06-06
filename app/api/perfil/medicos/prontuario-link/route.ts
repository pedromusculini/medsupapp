import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getAppBaseUrl } from '@/lib/appUrl';
import {
  buildProntuarioUrl,
  ensureMedicoProntuarioAcesso,
} from '@/lib/medicoProntuario';

/** Retorna link permanente do portal de prontuário do médico. */
export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const body = await req.json();
    const medicoId = body.id?.trim() || body.medicoId?.trim();

    if (!medicoId) {
      return NextResponse.json({ error: 'ID do médico é obrigatório' }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('user_type')
      .eq('email', clinicaEmail)
      .single();

    if (!profile || profile.user_type !== 'clinica') {
      return NextResponse.json({ error: 'Apenas clínicas podem gerar links' }, { status: 403 });
    }

    const { data: medico, error: medErr } = await supabaseAdmin
      .from('clinica_medicos')
      .select('id, nome')
      .eq('id', medicoId)
      .eq('clinica_email', clinicaEmail)
      .maybeSingle();

    if (medErr) throw medErr;
    if (!medico) {
      return NextResponse.json({ error: 'Médico não encontrado' }, { status: 404 });
    }

    const row = await ensureMedicoProntuarioAcesso(medicoId);
    const baseUrl = getAppBaseUrl(req);
    const url = buildProntuarioUrl(row.access_token, baseUrl);

    return NextResponse.json({
      medico_id: medicoId,
      nome_medico: medico.nome,
      prontuario_url: url,
    });
  } catch (error) {
    console.error('[perfil/medicos/prontuario-link]', error);
    return NextResponse.json({ error: 'Erro ao gerar link' }, { status: 500 });
  }
}
