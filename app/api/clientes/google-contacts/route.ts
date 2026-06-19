import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import {
  requireGoogleContactsToken,
  isContactsError,
} from '@/lib/contactsAuth';
import { GOOGLE_CONTACTS_MIN_QUERY_LEN } from '@/lib/googleContacts';
import { getGoogleContactsSearchCached } from '@/lib/googleContactsCache';

/** Busca ou lista paginada de contatos Google (20 por vez). */
export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const contactsToken = await requireGoogleContactsToken(req);
  if (isContactsError(contactsToken)) return contactsToken;

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const pageToken = req.nextUrl.searchParams.get('pageToken')?.trim() || undefined;

  try {
    if (q.length >= GOOGLE_CONTACTS_MIN_QUERY_LEN) {
      const result = await getGoogleContactsSearchCached(email, contactsToken, q, {
        pageToken,
      });
      return NextResponse.json({
        contacts: result.contacts,
        nextPageToken: result.nextPageToken,
        mode: 'search',
        fromCache: result.fromCache,
        aviso: result.error ?? null,
      });
    }

    return NextResponse.json({
      contacts: [],
      nextPageToken: null,
      mode: 'idle',
      hint: `Digite pelo menos ${GOOGLE_CONTACTS_MIN_QUERY_LEN} caracteres e pressione Enter para buscar.`,
    });
  } catch (err: unknown) {
    console.error('[google-contacts/GET]', err);
    const message = err instanceof Error ? err.message : 'Erro ao carregar contatos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
