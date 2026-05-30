import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getGoogleAccessFromDb } from '@/lib/requireGoogleAccess';

/** Rotas públicas (landing, login, formulário paciente). `/` só casa a raiz. */
function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/planos' ||
    pathname === '/privacidade' ||
    pathname === '/termos'
  ) {
    return true;
  }
  if (pathname.startsWith('/f/')) return true;
  if (pathname.startsWith('/auth/verify-email')) return true;
  return false;
}

/** Fluxos de cadastro por e-mail/senha desativados — apenas Google */
const emailSignupRoutes = [
  '/register',
  '/auth/cadastro',
  '/auth/choose-plan',
  '/auth/verify-code',
  '/login/register',
];

/** APIs permitidas sem confirmação de e-mail (login + envio/validação do código). */
function isUnverifiedApiPath(pathname: string): boolean {
  if (pathname.startsWith('/api/health/')) return true;
  if (pathname.startsWith('/api/auth/google-access')) return true;
  if (pathname.startsWith('/api/formulario/')) return true;
  if (pathname === '/api/auth/oauth-uris') return true;

  const nextAuthPublic = [
    '/api/auth/signin',
    '/api/auth/callback',
    '/api/auth/csrf',
    '/api/auth/providers',
    '/api/auth/session',
    '/api/auth/signout',
    '/api/auth/error',
  ];
  return nextAuthPublic.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Páginas permitidas com login Google mas e-mail ainda não confirmado. */
function isUnverifiedPagePath(pathname: string): boolean {
  return (
    pathname === '/auth/verificar-email' ||
    pathname.startsWith('/auth/verificar-email/') ||
    pathname === '/login' ||
    pathname.startsWith('/login/')
  );
}

function isWhatsAppSystemPath(pathname: string): boolean {
  return (
    pathname === '/api/whatsapp/webhook' ||
    pathname === '/api/whatsapp/status' ||
    pathname === '/api/whatsapp/process' ||
    pathname === '/api/whatsapp/lembrete-agendado'
  );
}

export default auth(async (req) => {
  const pathname = req.nextUrl.pathname;
  const host =
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    req.headers.get('host')?.split(':')[0]?.trim() ||
    '';

  if (host === 'medsupapp.com.br') {
    const dest = new URL(req.nextUrl.pathname + req.nextUrl.search, 'https://www.medsupapp.com.br');
    return NextResponse.redirect(dest, 308);
  }

  if (isWhatsAppSystemPath(pathname)) {
    return NextResponse.next();
  }

  if (
    emailSignupRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + '/'),
    )
  ) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('acesso', 'google');
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/public')) {
    return NextResponse.next();
  }

  if (!req.auth?.user) {
    if (isPublicPath(pathname) || isUnverifiedApiPath(pathname)) {
      return NextResponse.next();
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const googleSub = (req.auth as { googleSub?: string }).googleSub;
  const email = req.auth.user.email;

  if (!googleSub || !email) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('erro', 'sessao');
    return NextResponse.redirect(loginUrl);
  }

  let accessVerified = false;
  try {
    const access = await getGoogleAccessFromDb(googleSub, email);
    accessVerified = access.accessVerified;
  } catch (err) {
    console.error('[middleware] google access check:', err);
    accessVerified = false;
  }

  if (!accessVerified) {
    if (isUnverifiedPagePath(pathname) || isUnverifiedApiPath(pathname)) {
      return NextResponse.next();
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: 'Confirme seu e-mail com o código enviado antes de continuar.',
          code: 'EMAIL_VERIFICATION_REQUIRED',
        },
        { status: 403 },
      );
    }
    const verifyUrl = new URL('/auth/verificar-email', req.url);
    if (pathname !== '/auth/verificar-email') {
      const dest = req.nextUrl.pathname + req.nextUrl.search;
      verifyUrl.searchParams.set('callbackUrl', dest);
    }
    return NextResponse.redirect(verifyUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Do not run app middleware on Auth.js routes (avoids callback/error failures)
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|favicon.svg|apple-icon.svg|icon.svg|public).*)'],
};
