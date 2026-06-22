import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { buildLembretesPendentesResponse } from '@/lib/lembretesPendentes';

export async function GET(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const syncGoogle = req.nextUrl.searchParams.get('syncGoogle') === '1';

  try {
    const payload = await buildLembretesPendentesResponse(email, { syncGoogle });
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[lembretes/pendentes]', error);
    return NextResponse.json({ error: 'Erro ao listar lembretes' }, { status: 500 });
  }
}
