import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireClienteFichaAccess } from '@/lib/api-auth';
import { loadClienteFichaByFormularioToken } from '@/lib/loadClienteFichaPublic';
import { checkRateLimit } from '@/lib/rateLimit';
import { getRequestIp } from '@/lib/requestIp';

type Params = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;

  const ip = getRequestIp(req);
  const ipLimit = await checkRateLimit(`ficha-ip:${ip}`, 60, 60 * 60 * 1000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: 'Muitas consultas. Tente novamente mais tarde.' },
      { status: 429 },
    );
  }

  const tokenLimit = await checkRateLimit(`ficha-token:${token}`, 40, 60 * 60 * 1000);
  if (!tokenLimit.allowed) {
    return NextResponse.json(
      { error: 'Muitas consultas. Tente novamente mais tarde.' },
      { status: 429 },
    );
  }

  const authResult = await requireClienteFichaAccess(token);
  if (isAuthError(authResult)) return authResult;

  const result = await loadClienteFichaByFormularioToken(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
