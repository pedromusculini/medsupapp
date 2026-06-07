import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';
import { getAppBaseUrl } from '@/lib/appUrl';
import {
  buildAgendaInviteUrl,
  regenerateProfissionalInvite,
} from '@/lib/profissionalGoogleCalendar';
import {
  buildPedidoAcessoAgendaWhatsAppMessage,
  buildWhatsAppUrls,
} from '@/lib/whatsapp';

/** Gera ou renova convite de agenda Google para um médico. */
export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const body = await req.json();
    const medicoId = body.id?.trim() || body.medicoId?.trim() || body.profissionalId?.trim();

    if (!medicoId) {
      return NextResponse.json({ error: 'ID do médico é obrigatório' }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('user_type')
      .eq('email', clinicaEmail)
      .single();

    if (!profile || profile.user_type !== 'clinica') {
      return NextResponse.json(
        { error: 'Apenas clínicas podem enviar convites de agenda' },
        { status: 403 },
      );
    }

    const { data: medico, error: medErr } = await supabaseAdmin
      .from('clinica_medicos')
      .select('id, nome, whatsapp')
      .eq('id', medicoId)
      .eq('clinica_email', clinicaEmail)
      .maybeSingle();

    if (medErr) throw medErr;
    if (!medico) {
      return NextResponse.json({ error: 'Médico não encontrado' }, { status: 404 });
    }

    const row = await regenerateProfissionalInvite(medicoId, clinicaEmail);
    const baseUrl = getAppBaseUrl(req);
    const inviteUrl = buildAgendaInviteUrl(row.invite_token, baseUrl);

    const { data: profileRow } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('clinic_name, full_name')
      .eq('email', clinicaEmail)
      .maybeSingle();

    const nomeClinica =
      profileRow?.clinic_name?.trim() || profileRow?.full_name?.trim() || undefined;

    const mensagem = buildPedidoAcessoAgendaWhatsAppMessage({
      nomeMedico: medico.nome,
      nomeClinica,
      linkConvite: inviteUrl,
    });

    const urls = medico.whatsapp
      ? buildWhatsAppUrls(medico.whatsapp, mensagem)
      : null;

    return NextResponse.json({
      invite_token: row.invite_token,
      invite_url: inviteUrl,
      invite_expires_at: row.invite_token_expires_at,
      mensagem,
      whatsapp_url: urls?.web ?? null,
      whatsapp_app_url: urls?.app ?? null,
      whatsapp_android_url: urls?.android ?? null,
    });
  } catch (error) {
    console.error('[perfil/medicos/invite-agenda]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao gerar convite de agenda') },
      { status: 500 },
    );
  }
}
