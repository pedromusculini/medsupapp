import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { enderecoVarsFromProfile, loadOwnerProfile } from '@/lib/agendamento';
import { getConsultaCalendarLink } from '@/lib/calendarToken';
import {
  formatConsultaDataHora,
  renderMensagemForOwner,
} from '@/lib/mensagensWhatsapp';
import { buildWhatsAppUrls, normalizeBrazilPhone } from '@/lib/whatsapp';

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

    const profile = await loadOwnerProfile(email);
    const clinica =
      String(profile?.clinic_name ?? profile?.full_name ?? '').trim() || 'sua clínica';
    const { local, link_maps } = enderecoVarsFromProfile(profile);
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
      link_maps,
    });

    const urls = telefone ? buildWhatsAppUrls(telefone, mensagem) : null;

    return NextResponse.json({
      mensagem,
      link_calendario: linkCal,
      whatsapp_url: urls?.web ?? null,
      whatsapp_app_url: urls?.app ?? null,
      whatsapp_android_url: urls?.android ?? null,
    });
  } catch (error) {
    console.error('[consultas/confirmacao-whatsapp]', error);
    return NextResponse.json({ error: 'Erro ao gerar mensagem' }, { status: 500 });
  }
}
