import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';
import { getAppBaseUrl } from '@/lib/appUrl';
import {
  buildPortfolioWhatsAppMessage,
  buildWhatsAppUrls,
} from '@/lib/whatsapp';
import {
  ensurePortfolioRecord,
  getPortfolioByMedicoId,
  getPortfolioPublicPath,
  resolveOwnerSlug,
} from '@/lib/portfolio';

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id: medicoId } = await ctx.params;

  try {
    const { data: medico, error: medErr } = await supabaseAdmin
      .from('clinica_medicos')
      .select('id, nome, clinica_email')
      .eq('id', medicoId)
      .eq('clinica_email', email)
      .maybeSingle();

    if (medErr) throw medErr;
    if (!medico) {
      return NextResponse.json({ error: 'Médico não encontrado' }, { status: 404 });
    }

    const { data: profile } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('clinic_name, full_name')
      .eq('email', email)
      .maybeSingle();

    const nomeClinica =
      profile?.clinic_name?.trim() || profile?.full_name?.trim() || undefined;

    let row = await getPortfolioByMedicoId(email, medicoId);
    if (!row) {
      row = await ensurePortfolioRecord({
        ownerEmail: email,
        clinicaMedicosId: medicoId,
        nome: medico.nome,
      });
    }

    const ownerSlug = await resolveOwnerSlug(email);
    if (!ownerSlug) {
      return NextResponse.json(
        {
          error:
            'Configure o link de agendamento em Configurações → Comunicação antes de compartilhar o portfólio.',
        },
        { status: 400 },
      );
    }

    if (!row.ativo) {
      return NextResponse.json(
        { error: 'Ative e publique o portfólio antes de compartilhar.' },
        { status: 400 },
      );
    }

    const linkPortfolio = `${getAppBaseUrl(req)}${getPortfolioPublicPath(ownerSlug, row.medico_slug)}`;
    const mensagem = buildPortfolioWhatsAppMessage({
      nomeMedico: medico.nome,
      nomeClinica,
      linkPortfolio,
    });

    const urls = buildWhatsAppUrls(null, mensagem);

    return NextResponse.json({
      mensagem,
      portfolio_url: linkPortfolio,
      whatsapp_url: urls.web,
      whatsapp_app_url: urls.app,
      whatsapp_android_url: urls.android,
    });
  } catch (error) {
    console.error('[perfil/medicos/portfolio/whatsapp]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao gerar link WhatsApp') },
      { status: 500 },
    );
  }
}
