import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { formatEnderecoPerfil } from '@/lib/agendamento';
import { getConsultaCalendarLink } from '@/lib/calendarToken';
import {
  formatConsultaDataHora,
  renderMensagemForOwner,
} from '@/lib/mensagensWhatsapp';
import { buildWhatsAppUrl, normalizeBrazilPhone } from '@/lib/whatsapp';

/** Mensagem WhatsApp de confirmação com link para adicionar ao calendário. */
export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const body = await req.json();
    const consultaId = String(body.consultaId ?? body.id ?? '').trim();
    const paciente = String(body.paciente ?? body.patient ?? '').trim();
    const telefone = body.telefone ? normalizeBrazilPhone(String(body.telefone)) : '';
    const inicio = body.inicio ?? body.start;
    const medico = String(body.medico ?? '').trim();

    if (!consultaId || !paciente || !inicio) {
      return NextResponse.json(
        { error: 'consultaId, paciente e inicio são obrigatórios' },
        { status: 400 },
      );
    }

    const inicioIso =
      typeof inicio === 'string' ? inicio : new Date(inicio).toISOString();

    const { data: profile } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    const clinica = profile?.clinic_name || profile?.full_name || 'sua clínica';
    const local = profile ? formatEnderecoPerfil(profile) : '';
    const { data, hora } = formatConsultaDataHora(inicioIso);
    const linkCal = await getConsultaCalendarLink({
      consultaId,
      ownerEmail: email,
    });

    const mensagem = await renderMensagemForOwner(email, 'confirmacao_apos_agendar', {
      nome: paciente,
      data,
      hora,
      medico,
      local,
      clinica,
      link_calendario: linkCal,
    });

    return NextResponse.json({
      mensagem,
      link_calendario: linkCal,
      whatsapp_url: telefone ? buildWhatsAppUrl(telefone, mensagem) : null,
    });
  } catch (error) {
    console.error('[consultas/confirmacao-whatsapp]', error);
    return NextResponse.json({ error: 'Erro ao gerar mensagem' }, { status: 500 });
  }
}
