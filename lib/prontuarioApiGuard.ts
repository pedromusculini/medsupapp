import { NextRequest, NextResponse } from 'next/server';
import { getRequestIp } from '@/lib/requestIp';
import {
  isProntuarioTokenEnabled,
  PRONTUARIO_TOKEN_DISABLED_MESSAGE,
} from '@/lib/prontuarioTokenFeature';
import { checkProntuarioTokenRateLimit } from '@/lib/prontuarioTokenRateLimit';

function rateLimitResponse(retryAfterSec?: number): NextResponse {
  const headers: Record<string, string> = {};
  if (retryAfterSec) headers['Retry-After'] = String(retryAfterSec);
  return NextResponse.json(
    { error: 'Muitas tentativas. Tente novamente mais tarde.', code: 'RATE_LIMITED' },
    { status: 429, headers },
  );
}

/** Rate limit + feature flag para rotas legadas `/api/prontuario/[token]/*`. */
export async function guardLegacyProntuarioApi(
  req: NextRequest,
  token: string,
): Promise<NextResponse | null> {
  const ip = getRequestIp(req);
  const ipLimit = await checkProntuarioTokenRateLimit('ip', ip);
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSec);

  const tokenKey = token.trim().slice(0, 64) || 'empty';
  const tokenLimit = await checkProntuarioTokenRateLimit('token', tokenKey);
  if (!tokenLimit.allowed) return rateLimitResponse(tokenLimit.retryAfterSec);

  if (!isProntuarioTokenEnabled()) {
    return NextResponse.json(
      {
        error: PRONTUARIO_TOKEN_DISABLED_MESSAGE,
        code: 'PRONTUARIO_TOKEN_DISABLED',
      },
      { status: 410 },
    );
  }

  return null;
}
