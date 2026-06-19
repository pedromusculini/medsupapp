import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import {
  canAccessClienteFichaProfissional,
  resolveOwnerEmailFromFormularioToken,
} from '@/lib/clienteFichaAccess';
import { isClinicaTitular } from '@/lib/clinicaTitular';
import { getGoogleAccessForSession } from '@/lib/requireGoogleAccess';

export { isClinicaTitular } from '@/lib/clinicaTitular';

export async function requireOwnerEmail(): Promise<
  { email: string; googleSub: string } | NextResponse
> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase().trim();
  const googleSub = session?.googleSub;
  if (!email || !googleSub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  return { email, googleSub };
}

/** Sessão autenticada + e-mail confirmado (LGPD / anti-abuso). */
export async function requireVerifiedOwner(): Promise<
  { email: string; googleSub: string } | NextResponse
> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase().trim();
  const googleSub = session?.googleSub;
  if (!email || !googleSub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const access = await getGoogleAccessForSession(session);
  if (!access?.accessVerified) {
    return NextResponse.json(
      {
        error: 'Confirme seu e-mail com o código enviado antes de continuar.',
        code: 'EMAIL_VERIFICATION_REQUIRED',
      },
      { status: 403 },
    );
  }

  return { email, googleSub };
}

/** Titular da clínica (owner_email) — bloqueia profissionais de equipe com agenda conectada. */
export async function requireClinicaTitular(): Promise<
  { email: string; googleSub: string } | NextResponse
> {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;

  const session = await auth();
  const titular = await isClinicaTitular(session);
  if (!titular) {
    return NextResponse.json(
      {
        error:
          'O módulo financeiro é exclusivo do titular da clínica. Profissionais de equipe não têm acesso.',
        code: 'FINANCEIRO_TITULAR_ONLY',
      },
      { status: 403 },
    );
  }

  return authResult;
}

export function isAuthError(
  result: { email: string; googleSub?: string } | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}

export type ClienteFichaAuthContext = {
  email: string;
  googleSub: string;
  ownerEmail: string;
  role: 'titular' | 'equipe';
  nomeProfissional?: string;
};

/** Sessão + vínculo à clínica do token (titular ou médico com agenda conectada). */
export async function requireClienteFichaAccess(
  token: string,
): Promise<ClienteFichaAuthContext | NextResponse> {
  const ownerResult = await resolveOwnerEmailFromFormularioToken(token);
  if (!ownerResult.ok) {
    return NextResponse.json({ error: ownerResult.error }, { status: ownerResult.status });
  }

  const session = await auth();
  const email = session?.user?.email?.toLowerCase().trim() ?? '';
  const googleSub = session?.googleSub ?? '';
  if (!email || !googleSub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const access = await canAccessClienteFichaProfissional({
    googleSub,
    sessionEmail: email,
    ownerEmail: ownerResult.ownerEmail,
  });

  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 });
  }

  if (access.role === 'titular') {
    const verified = await getGoogleAccessForSession(session);
    if (!verified?.accessVerified) {
      return NextResponse.json(
        {
          error: 'Confirme seu e-mail com o código enviado antes de continuar.',
          code: 'EMAIL_VERIFICATION_REQUIRED',
        },
        { status: 403 },
      );
    }
  }

  return {
    email,
    googleSub,
    ownerEmail: ownerResult.ownerEmail,
    role: access.role,
    ...(access.role === 'equipe' ? { nomeProfissional: access.nomeProfissional } : {}),
  };
}
