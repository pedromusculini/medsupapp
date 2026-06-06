import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';
import {
  isValidPlanId,
  maxMedicosCadastrados,
  type PlanId,
} from '@/lib/subscriptionPlans';
import {
  agendaStatusFromRow,
  ensureProfissionalCalendarRow,
  loadCalendarRowsForMedicos,
} from '@/lib/profissionalGoogleCalendar';

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

    const ids = (data ?? []).map((m) => m.id as string);
    const calMap = await loadCalendarRowsForMedicos(ids);
    const enriched = (data ?? []).map((m) => ({
      ...m,
      agenda_google_status: agendaStatusFromRow(calMap.get(m.id as string)),
    }));

    return NextResponse.json({ medicos: enriched });
  } catch (error) {
    console.error('[perfil/medicos/GET] Erro:', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao carregar médicos') },
      { status: 500 },
    );
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
      .select('user_type, plan')
      .eq('email', clinicaEmail)
      .single();

    if (!profile || profile.user_type !== 'clinica') {
      return NextResponse.json({ error: 'Apenas clínicas podem gerenciar médicos' }, { status: 403 });
    }

    const plan = profile.plan as string;
    if (isValidPlanId(plan)) {
      const { count } = await supabaseAdmin
        .from('clinica_medicos')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_email', clinicaEmail);

      const max = maxMedicosCadastrados(plan as PlanId);
      if ((count ?? 0) >= max) {
        return NextResponse.json(
          {
            error: `Limite do plano: até ${max} médico(s) cadastrado(s) na clínica.`,
            code: 'MEDICOS_LIMIT',
          },
          { status: 400 },
        );
      }
    }

    const nome = String(body.nome).trim();
    const { data, error } = await supabaseAdmin
      .from('clinica_medicos')
      .insert({
        clinica_email: clinicaEmail,
        nome,
        crm: body.crm?.trim() || null,
        specialty: body.specialty?.trim() || null,
        whatsapp: body.whatsapp?.trim() || null,
        email: body.email?.trim().toLowerCase() || null,
        percentual_comissao:
          body.percentual_comissao != null ? Number(body.percentual_comissao) : 50,
      })
      .select()
      .single();

    if (error) {
      console.error('[perfil/medicos/POST] Supabase:', error);
      return NextResponse.json(
        { error: supabaseErrorMessage(error, 'Erro ao adicionar médico') },
        { status: 500 },
      );
    }

    await ensureProfissionalCalendarRow(data.id);
    const calMap = await loadCalendarRowsForMedicos([data.id]);
    const enriched = {
      ...data,
      agenda_google_status: agendaStatusFromRow(calMap.get(data.id)),
    };

    return NextResponse.json({ medico: enriched, message: 'Médico adicionado com sucesso!' });
  } catch (error) {
    console.error('[perfil/medicos/POST] Erro:', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao adicionar médico') },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const body = await req.json();
    const medicoId = body.id?.trim();

    if (!medicoId) {
      return NextResponse.json({ error: 'ID do médico é obrigatório' }, { status: 400 });
    }
    if (!body.nome?.trim()) {
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

    let percentualComissao: number | undefined;
    if (body.percentual_comissao != null && body.percentual_comissao !== '') {
      percentualComissao = Number(body.percentual_comissao);
      if (!Number.isFinite(percentualComissao) || percentualComissao < 0 || percentualComissao > 100) {
        return NextResponse.json(
          { error: 'Comissão deve estar entre 0 e 100%' },
          { status: 400 },
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from('clinica_medicos')
      .update({
        nome: String(body.nome).trim(),
        crm: body.crm?.trim() || null,
        specialty: body.specialty?.trim() || null,
        whatsapp: body.whatsapp?.trim() || null,
        email: body.email?.trim().toLowerCase() || null,
        ...(percentualComissao !== undefined ? { percentual_comissao: percentualComissao } : {}),
      })
      .eq('id', medicoId)
      .eq('clinica_email', clinicaEmail)
      .select()
      .single();

    if (error) {
      console.error('[perfil/medicos/PATCH] Supabase:', error);
      return NextResponse.json(
        { error: supabaseErrorMessage(error, 'Erro ao atualizar médico') },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json({ error: 'Médico não encontrado' }, { status: 404 });
    }

    await ensureProfissionalCalendarRow(data.id);
    const calMap = await loadCalendarRowsForMedicos([data.id]);
    const enriched = {
      ...data,
      agenda_google_status: agendaStatusFromRow(calMap.get(data.id)),
    };

    return NextResponse.json({ medico: enriched, message: 'Médico atualizado com sucesso!' });
  } catch (error) {
    console.error('[perfil/medicos/PATCH] Erro:', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao atualizar médico') },
      { status: 500 },
    );
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
