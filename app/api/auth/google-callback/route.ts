import { NextRequest, NextResponse } from 'next/server';
import { getAppBaseUrl } from '@/lib/appUrl';

/**
 * Callback do Google OAuth incremental.
 * 
 * Recebe o código de autorização do Google, troca por tokens
 * e redireciona o usuário de volta para o app.
 * 
 * O token é armazenado em um cookie para uso pelas APIs.
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const stateB64 = searchParams.get('state');
  const error = searchParams.get('error');

  // Decodificar state para obter redirectTo e scope
  let redirectTo = '/dashboard';
  let scope = '';
  try {
    if (stateB64) {
      const decoded = JSON.parse(
        Buffer.from(stateB64, 'base64').toString('utf-8'),
      );
      redirectTo = decoded.redirectTo || '/dashboard';
      scope = decoded.scope || '';
    }
  } catch {
    // mantém defaults
  }

  if (error) {
    console.error('[google-callback] Erro do Google:', error);
    const errorUrl = new URL(redirectTo, req.url);
    errorUrl.searchParams.set('google_error', error);
    return NextResponse.redirect(errorUrl);
  }

  if (!code) {
    return NextResponse.json(
      { error: 'Código de autorização não recebido' },
      { status: 400 },
    );
  }

  // Trocar o código por tokens
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;
  const baseUrl = getAppBaseUrl(req);
  const redirectUri = `${baseUrl}/api/auth/google-callback`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json();
      console.error('[google-callback] Erro ao obter token:', err);
      const errorUrl = new URL(redirectTo, req.url);
      errorUrl.searchParams.set(
        'google_error',
        'Falha ao autorizar: ' + (err.error_description || err.error),
      );
      return NextResponse.redirect(errorUrl);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;

    // Armazenar o token incremental em cookies seguros
    // O nome do cookie depende do scope
    const cookieName =
      scope === 'calendar'
        ? 'google_calendar_token'
        : scope === 'drive'
          ? 'google_drive_token'
          : scope === 'contacts'
            ? 'google_contacts_token'
            : 'google_incremental_token';

    // Criar resposta com redirect
    const successUrl = new URL(redirectTo, req.url);
    successUrl.searchParams.set('google_connected', scope);
    
    const response = NextResponse.redirect(successUrl);

    // Setar cookie com o token incremental (expira conforme o token)
    response.cookies.set(cookieName, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn,
      path: '/',
    });

    // Se tiver refresh token, armazenar em cookie separado (longa duração)
    if (refreshToken) {
      response.cookies.set(`${cookieName}_refresh`, refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 dias
        path: '/',
      });
    }

    console.log(
      `[google-callback] Autorização incremental (${scope}) concluída para o usuário`,
    );

    return response;
  } catch (err) {
    console.error('[google-callback] Erro inesperado:', err);
    const errorUrl = new URL(redirectTo, req.url);
    errorUrl.searchParams.set('google_error', 'Erro interno ao processar autorização');
    return NextResponse.redirect(errorUrl);
  }
}