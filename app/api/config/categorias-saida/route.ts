import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  supabaseErrorMessage,
  supabaseErrorStatus,
} from '@/lib/supabaseErrors';
import {
  defaultCategoriasSaida,
  sanitizeCategoriasSaidaInput,
  type CategoriaSaida,
} from '@/lib/configCategoriasSaida';
import { loadCategoriasSaidaForOwner } from '@/lib/categoriasSaidaUsage';

function isCategoriasColumnMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42703' ||
    (error.message?.includes('categorias_saida') ?? false)
  );
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireVerifiedOwner();
    if (isAuthError(authResult)) return authResult;
    const email = authResult.email;

    const sortParam = new URL(req.url).searchParams.get('sort');
    const sortByUsage = sortParam !== 'stored';

    const { data, error } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('categorias_saida')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      if (isCategoriasColumnMissing(error)) {
        const { categorias, usageById } = await loadCategoriasSaidaForOwner(
          email,
          null,
          sanitizeCategoriasSaidaInput,
          sortByUsage,
        );
        return NextResponse.json({ categorias, usageById, schemaMissing: true });
      }
      throw error;
    }

    const { categorias, usageById } = await loadCategoriasSaidaForOwner(
      email,
      data?.categorias_saida,
      sanitizeCategoriasSaidaInput,
      sortByUsage,
    );

    return NextResponse.json(
      { categorias, usageById },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    );
  } catch (error) {
    console.error('[config/categorias-saida/GET]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao carregar categorias') },
      { status: supabaseErrorStatus(error) },
    );
  }
}

export async function PUT(req: NextRequest) {
  let categorias: CategoriaSaida[] = defaultCategoriasSaida();

  try {
    const authResult = await requireVerifiedOwner();
    if (isAuthError(authResult)) return authResult;
    const email = authResult.email;

    const body = await req.json().catch(() => ({}));
    categorias = sanitizeCategoriasSaidaInput(body.categorias);

    const { error } = await supabaseAdmin
      .from('onboarding_profiles')
      .update({
        categorias_saida: categorias,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email);

    if (error) {
      if (isCategoriasColumnMissing(error)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado: rode npm run db:categorias-saida ou execute sql/financeiro_categorias_saida_schema.sql no Supabase.',
            code: 'SUPABASE_SCHEMA_MISSING',
          },
          { status: 503 },
        );
      }
      throw error;
    }

    return NextResponse.json({
      categorias,
      message: 'Categorias salvas',
    });
  } catch (error) {
    console.error('[config/categorias-saida/PUT]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao salvar categorias') },
      { status: supabaseErrorStatus(error) },
    );
  }
}
