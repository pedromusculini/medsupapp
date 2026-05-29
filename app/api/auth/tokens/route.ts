import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import {
  getGoogleAccessForSession,
  googleAccessDeniedResponse,
} from '@/lib/requireGoogleAccess';

/** Tokens Google da sessão — não substitui `/api/auth/session` do Auth.js */
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const access = await getGoogleAccessForSession(session);
  if (!access?.accessVerified) {
    return googleAccessDeniedResponse();
  }

  return NextResponse.json({
    user: {
      id: (session.user as { id?: string })?.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    },
    accessToken: (session as { accessToken?: string }).accessToken,
    refreshToken: (session as { refreshToken?: string }).refreshToken,
    tokenExpiresAt: (session as { tokenExpiresAt?: number }).tokenExpiresAt,
    googleSub: (session as { googleSub?: string }).googleSub,
    accessVerified: (session as { accessVerified?: boolean }).accessVerified,
  });
}
