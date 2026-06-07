import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { buildProntuarioAccessStatus } from '@/lib/prontuarioAcesso';

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;

  const status = await buildProntuarioAccessStatus(authResult.email, req);
  return NextResponse.json(status);
}
