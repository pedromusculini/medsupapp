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
  getPortfolioPublicPath,
  getPortfolioTitular,
  resolveOwnerSlug,
} from '@/lib/portfolio';

export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const { data: profile } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('full_name, clinic_name')
      .eq('email', email)
      .maybeSingle();

    const nomeMedico = profile?.full_name?.trim() || 'Profissional';
    const nomeClinica = profile?.clinic_name?.trim() || profile?.full_name?.trim() || undefined;

    let row = await getPortfolioTitular(email);
    if (!row) {
      row = await ensurePortfolioRecord({
        ownerEmail: email,
        clinicaMedicosId: null,
        nome: nomeMedico,
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
      nomeMedico,
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
    console.error('[perfil/portfolio/whatsapp]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao gerar link WhatsApp') },
      { status: 500 },
    );
  }
}
