import { NextRequest, NextResponse } from 'next/server';
import { getAppBaseUrl } from '@/lib/appUrl';

/**
 * Inicia autorização incremental do Google para um escopo específico.
 * 
 * Fluxo:
 * 1. Frontend redireciona para /api/auth/google-authorize?scope=calendar
 * 2. Este endpoint redireciona para o Google OAuth com include_granted_scopes=true
 * 3. Google retorna para /api/auth/google-callback com o código de autorização
 * 4. Callback troca o código por tokens e redireciona de volta para o app
 * 
 * Scopes disponíveis:
 * - calendar: Google Calendar (events + readonly)
 * - drive: Google Drive (file access)
 * - contacts: Google Contatos (somente leitura)
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope');
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  if (!scope) {
    return NextResponse.json(
      { error: 'Parâmetro scope é obrigatório. Use: calendar, drive ou contacts' },
      { status: 400 },
    );
  }

  let scopeParam = '';
  if (scope === 'calendar') {
    scopeParam =
      'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';
  } else if (scope === 'drive') {
    scopeParam = 'https://www.googleapis.com/auth/drive.file';
  } else if (scope === 'contacts') {
    scopeParam = 'https://www.googleapis.com/auth/contacts.readonly';
  } else {
    return NextResponse.json(
      { error: 'Scope inválido. Use: calendar, drive ou contacts' },
      { status: 400 },
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
  const baseUrl = getAppBaseUrl(req);
  const redirectUri = `${baseUrl}/api/auth/google-callback`;

  // URL de autorização incremental do Google
  // include_granted_scopes=true mantém os scopes já concedidos
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId!);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopeParam);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('include_granted_scopes', 'true');
  authUrl.searchParams.set('prompt', 'consent');
  // Passar o redirect final como state
  const state = Buffer.from(JSON.stringify({ redirectTo, scope })).toString('base64');
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}