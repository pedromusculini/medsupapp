import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';
import {
  ensurePortfolioRecord,
  getPortfolioPublicPath,
  getPortfolioTitular,
  MAX_PORTFOLIO_FOTOS,
  portfolioToApiResponse,
  resolveOwnerSlug,
  savePortfolioData,
  updatePortfolioFotos,
} from '@/lib/portfolio';
import {
  deletePortfolioFoto,
  portfolioStoragePath,
  processPortfolioImage,
  uploadPortfolioFoto,
} from '@/lib/portfolioStorage';

async function loadTitularMedico(ownerEmail: string) {
  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('full_name, crm, specialty')
    .eq('email', ownerEmail)
    .maybeSingle();

  return {
    nome: profile?.full_name?.trim() || 'Profissional',
    crm: profile?.crm?.trim() || null,
    specialty: profile?.specialty?.trim() || null,
  };
}

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const medico = await loadTitularMedico(email);
    let row = await getPortfolioTitular(email);
    if (!row) {
      row = await ensurePortfolioRecord({
        ownerEmail: email,
        clinicaMedicosId: null,
        nome: medico.nome,
      });
    }
    const ownerSlug = await resolveOwnerSlug(email);
    return NextResponse.json(portfolioToApiResponse(row, ownerSlug, medico));
  } catch (error) {
    console.error('[perfil/portfolio GET]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao carregar portfólio') },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const body = await req.json();
    const medico = await loadTitularMedico(email);
    let row = await getPortfolioTitular(email);
    if (!row) {
      row = await ensurePortfolioRecord({
        ownerEmail: email,
        clinicaMedicosId: null,
        nome: medico.nome,
      });
    }

    const updated = await savePortfolioData(row.id, email, {
      historia: body.historia,
      competencias: body.competencias,
      ativo: body.ativo,
    });

    const ownerSlug = await resolveOwnerSlug(email);
    return NextResponse.json(portfolioToApiResponse(updated, ownerSlug, medico));
  } catch (error) {
    console.error('[perfil/portfolio PUT]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao salvar portfólio') },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const medico = await loadTitularMedico(email);
    let row = await getPortfolioTitular(email);
    if (!row) {
      row = await ensurePortfolioRecord({
        ownerEmail: email,
        clinicaMedicosId: null,
        nome: medico.nome,
      });
    }

    const form = await req.formData();
    const file = form.get('file');
    const slotRaw = form.get('slot');
    const legendaRaw = form.get('legenda');
    const slot = Number(slotRaw);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 });
    }
    if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_PORTFOLIO_FOTOS) {
      return NextResponse.json({ error: 'Slot inválido (0–5)' }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Imagem muito grande (máx. 8 MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const webp = await processPortfolioImage(buffer);
    const path = portfolioStoragePath(email, row.id, slot);
    await uploadPortfolioFoto(path, webp);

    const legenda = typeof legendaRaw === 'string' ? legendaRaw.trim() || null : null;
    const prev = row.fotos.find((f) => f.slot === slot);
    if (prev?.path) {
      try {
        await deletePortfolioFoto(prev.path);
      } catch {
        /* ignore */
      }
    }

    const fotos = row.fotos.filter((f) => f.slot !== slot);
    fotos.push({ slot, path, legenda });
    fotos.sort((a, b) => a.slot - b.slot);

    const updated = await updatePortfolioFotos(row.id, email, fotos);
    const ownerSlug = await resolveOwnerSlug(email);
    return NextResponse.json(portfolioToApiResponse(updated, ownerSlug, medico));
  } catch (error) {
    console.error('[perfil/portfolio POST foto]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao enviar foto') },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const medico = await loadTitularMedico(email);
    const slot = Number(req.nextUrl.searchParams.get('slot'));
    if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_PORTFOLIO_FOTOS) {
      return NextResponse.json({ error: 'Slot inválido' }, { status: 400 });
    }

    const row = await getPortfolioTitular(email);
    if (!row) {
      return NextResponse.json({ error: 'Portfólio não encontrado' }, { status: 404 });
    }

    const prev = row.fotos.find((f) => f.slot === slot);
    if (prev?.path) {
      try {
        await deletePortfolioFoto(prev.path);
      } catch {
        /* ignore */
      }
    }

    const fotos = row.fotos.filter((f) => f.slot !== slot);
    const updated = await updatePortfolioFotos(row.id, email, fotos);
    const ownerSlug = await resolveOwnerSlug(email);
    return NextResponse.json(portfolioToApiResponse(updated, ownerSlug, medico));
  } catch (error) {
    console.error('[perfil/portfolio DELETE foto]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao remover foto') },
      { status: 500 },
    );
  }
}
