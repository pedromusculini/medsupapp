import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export async function requireOwnerEmail(): Promise<
  { email: string } | NextResponse
> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  return { email };
}

export function isAuthError(
  result: { email: string } | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
