/**
 * Cache em memória de buscas/páginas de contatos Google por tenant.
 * Evita refetch completo da agenda de contatos (quota People API).
 */

import {
  fetchGoogleContacts,
  fetchGoogleContactsPage,
  isGoogleContactsQuotaError,
  searchGoogleContacts,
  type GoogleContactImport,
  type GoogleContactsPageResult,
} from '@/lib/googleContacts';

/** TTL do cache server-side (minutos). */
export const GOOGLE_CONTACTS_CACHE_TTL_MS = 3 * 60 * 1000;

/** Após quota 429, não tenta de novo antes deste intervalo. */
const QUOTA_BACKOFF_MS = 60 * 1000;

const QUOTA_MSG =
  'Contatos Google temporariamente indisponíveis — tente em 1 minuto';

type CacheEntry = {
  result: GoogleContactsPageResult;
  fetchedAt: number;
  quotaExceededUntil?: number;
};

const cache = new Map<string, CacheEntry>();

function ownerKey(ownerEmail: string): string {
  return ownerEmail.trim().toLowerCase();
}

function searchCacheKey(
  ownerEmail: string,
  query: string,
  pageToken?: string,
): string {
  return `${ownerKey(ownerEmail)}:q:${query.trim().toLowerCase()}:${pageToken ?? ''}`;
}

function pageCacheKey(ownerEmail: string, pageToken?: string): string {
  return `${ownerKey(ownerEmail)}:page:${pageToken ?? ''}`;
}

export function invalidateGoogleContactsCache(ownerEmail: string): void {
  const prefix = `${ownerKey(ownerEmail)}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export type GoogleContactsCachedResult = GoogleContactsPageResult & {
  fromCache: boolean;
  quotaExceeded?: boolean;
  error?: string;
};

function getStaleOrEmpty(key: string, now: number): CacheEntry | undefined {
  const existing = cache.get(key);
  if (!existing) return undefined;
  if (existing.quotaExceededUntil && existing.quotaExceededUntil > now) {
    return existing;
  }
  if (now - existing.fetchedAt < GOOGLE_CONTACTS_CACHE_TTL_MS) {
    return existing;
  }
  return undefined;
}

function handleQuotaError(
  key: string,
  existing: CacheEntry | undefined,
  now: number,
): GoogleContactsCachedResult {
  const stale = existing?.result ?? { contacts: [], nextPageToken: null };
  cache.set(key, {
    result: stale,
    fetchedAt: existing?.fetchedAt ?? now,
    quotaExceededUntil: now + QUOTA_BACKOFF_MS,
  });
  return {
    ...stale,
    fromCache: !!existing,
    quotaExceeded: true,
    error: QUOTA_MSG,
  };
}

async function runCached<T extends GoogleContactsPageResult>(
  key: string,
  ownerEmail: string,
  fetcher: () => Promise<T>,
  options?: { force?: boolean },
): Promise<GoogleContactsCachedResult> {
  const now = Date.now();
  const existing = cache.get(key);

  if (!options?.force) {
    const fresh = getStaleOrEmpty(key, now);
    if (fresh) {
      if (fresh.quotaExceededUntil && fresh.quotaExceededUntil > now) {
        return {
          ...fresh.result,
          fromCache: true,
          quotaExceeded: true,
          error: QUOTA_MSG,
        };
      }
      return { ...fresh.result, fromCache: true };
    }
  }

  try {
    const result = await fetcher();
    cache.set(key, { result, fetchedAt: now });
    return { ...result, fromCache: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isGoogleContactsQuotaError(429, message)) {
      return handleQuotaError(key, existing, now);
    }
    throw err;
  }
}

/** Busca paginada por texto (campo de paciente, modal Clientes). */
export async function getGoogleContactsSearchCached(
  ownerEmail: string,
  accessToken: string,
  query: string,
  options?: { pageToken?: string; pageSize?: number; force?: boolean },
): Promise<GoogleContactsCachedResult> {
  const q = query.trim();
  const key = searchCacheKey(ownerEmail, q, options?.pageToken);
  return runCached(
    key,
    ownerEmail,
    () =>
      searchGoogleContacts(accessToken, q, {
        pageToken: options?.pageToken,
        pageSize: options?.pageSize,
      }),
    options,
  );
}

/** Uma página da lista de conexões (navegar 20 em 20). */
export async function getGoogleContactsPageCached(
  ownerEmail: string,
  accessToken: string,
  options?: { pageToken?: string; pageSize?: number; force?: boolean },
): Promise<GoogleContactsCachedResult> {
  const key = pageCacheKey(ownerEmail, options?.pageToken);
  return runCached(
    key,
    ownerEmail,
    () =>
      fetchGoogleContactsPage(accessToken, {
        pageToken: options?.pageToken,
        pageSize: options?.pageSize,
      }),
    options,
  );
}

/**
 * @deprecated Import em massa — carrega todos os contatos. Prefira busca/página.
 */
export async function getGoogleContactsCached(
  ownerEmail: string,
  accessToken: string,
  options?: { force?: boolean },
): Promise<{
  contacts: GoogleContactImport[];
  fromCache: boolean;
  quotaExceeded?: boolean;
  error?: string;
}> {
  const key = `${ownerKey(ownerEmail)}:bulk`;
  const now = Date.now();
  const existing = cache.get(key);

  if (!options?.force) {
    const fresh = getStaleOrEmpty(key, now);
    if (fresh) {
      if (fresh.quotaExceededUntil && fresh.quotaExceededUntil > now) {
        return {
          contacts: fresh.result.contacts,
          fromCache: true,
          quotaExceeded: true,
          error: QUOTA_MSG,
        };
      }
      return { contacts: fresh.result.contacts, fromCache: true };
    }
  }

  try {
    const contacts = await fetchGoogleContacts(accessToken);
    cache.set(key, {
      result: { contacts, nextPageToken: null },
      fetchedAt: now,
    });
    return { contacts, fromCache: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isGoogleContactsQuotaError(429, message)) {
      const stale = existing?.result.contacts ?? [];
      cache.set(key, {
        result: { contacts: stale, nextPageToken: null },
        fetchedAt: existing?.fetchedAt ?? now,
        quotaExceededUntil: now + QUOTA_BACKOFF_MS,
      });
      return {
        contacts: stale,
        fromCache: !!existing,
        quotaExceeded: true,
        error: QUOTA_MSG,
      };
    }
    throw err;
  }
}
