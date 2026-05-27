import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';

const publicRoutes = ['/login', '/register', '/auth', '/'];
const apiRoutes = ['/api/auth', '/api/onboarding'];

export const middleware = (req: NextRequest) => {
  const pathname = req.nextUrl.pathname;

  // Rotas públicas - sempre permitir
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next();
  }

  // APIs públicas de autenticação - sempre permitir
  if (apiRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Rotas estáticas
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/public')) {
    return NextResponse.next();
  }

  // Verificar token JWT customizado para rotas protegidas
  const token = req.cookies.get('session_token')?.value;
  
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      return NextResponse.next();
    }
  }

  // Se não tiver token JWT válido, verificar NextAuth session (via cookie de sessão)
  const nextAuthCookie = req.cookies.get('next-auth.session-token')?.value || 
                         req.cookies.get('__Secure-next-auth.session-token')?.value;
  
  if (nextAuthCookie) {
    return NextResponse.next();
  }

  // Redirecionar para login se não autenticado
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('callbackUrl', pathname);
  return NextResponse.redirect(loginUrl);
};

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
