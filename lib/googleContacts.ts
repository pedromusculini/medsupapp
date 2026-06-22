/**
 * Google People API — importação de contatos para clientes MedSupAPP.
 * @see https://developers.google.com/people/api/rest/v1/people.connections.list
 * @see https://developers.google.com/people/api/rest/v1/people/searchContacts
 */

import { normalizePhoneForStorage, formatPhoneDisplay } from '@/lib/phone';

const PEOPLE_API = 'https://people.googleapis.com/v1';
const PERSON_FIELDS = 'names,emailAddresses,phoneNumbers,birthdays';
const READ_MASK = PERSON_FIELDS;

/** Tamanho padrão de página (busca e listagem). */
export const GOOGLE_CONTACTS_PAGE_SIZE = 20;

/** Mínimo de caracteres para buscar no Google. */
export const GOOGLE_CONTACTS_MIN_QUERY_LEN = 2;

/** @deprecated Usado só no import em massa legado; prefira searchGoogleContacts. */
const BULK_PAGE_SIZE = 200;

export function isGoogleContactsQuotaError(status: number, message: string): boolean {
  if (status === 429) return true;
  const lower = message.toLowerCase();
  return (
    lower.includes('quota exceeded') ||
    lower.includes('rate limit') ||
    lower.includes('resource_exhausted')
  );
}

/** Mensagem amigável quando a People API não está habilitada no projeto Google Cloud. */
export function formatPeopleApiError(rawMessage: string, status?: number): string {
  const lower = rawMessage.toLowerCase();
  const needsEnable =
    lower.includes('has not been used') ||
    lower.includes('it is disabled') ||
    lower.includes('people api') ||
    status === 403;

  if (!needsEnable) return rawMessage;

  const projectMatch = rawMessage.match(/project\s+(\d+)/i);
  const enableUrl = projectMatch?.[1]
    ? `https://console.developers.google.com/apis/api/people.googleapis.com/overview?project=${projectMatch[1]}`
    : 'https://console.cloud.google.com/apis/library/people.googleapis.com';

  return (
    `Ative a People API no Google Cloud (botão "Ativar" ou "Enable"), aguarde 2–5 minutos e tente de novo: ${enableUrl}`
  );
}

export type GoogleContactImport = {
  nome: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  googleResourceName: string;
};

export type GoogleContactsPageResult = {
  contacts: GoogleContactImport[];
  nextPageToken: string | null;
};

type PersonConnection = {
  resourceName?: string;
  names?: { displayName?: string; givenName?: string; familyName?: string }[];
  emailAddresses?: { value?: string }[];
  phoneNumbers?: { value?: string; canonicalForm?: string }[];
  birthdays?: { date?: { year?: number; month?: number; day?: number } }[];
};

function formatBirthday(
  date?: { year?: number; month?: number; day?: number },
): string | null {
  if (!date?.month || !date?.day) return null;
  const y = date.year && date.year > 1900 ? date.year : 1900;
  const m = String(date.month).padStart(2, '0');
  const d = String(date.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizePhone(raw: string): string | null {
  const stored = normalizePhoneForStorage(raw);
  if (stored) return stored;
  const display = formatPhoneDisplay(raw);
  return display || raw.trim() || null;
}

function mapPersonToContact(person: PersonConnection): GoogleContactImport | null {
  const resourceName = person.resourceName ?? '';
  const nameObj = person.names?.[0];
  const nome =
    nameObj?.displayName?.trim() ||
    [nameObj?.givenName, nameObj?.familyName].filter(Boolean).join(' ').trim();
  if (!nome) return null;

  const email =
    person.emailAddresses?.find((e) => e.value?.includes('@'))?.value?.trim() ?? null;
  const phoneRaw =
    person.phoneNumbers?.[0]?.canonicalForm ||
    person.phoneNumbers?.[0]?.value ||
    null;
  const telefone = phoneRaw ? normalizePhone(phoneRaw) : null;

  if (!email && !telefone) return null;

  return {
    nome,
    email: email ? email.toLowerCase() : null,
    telefone,
    data_nascimento: formatBirthday(person.birthdays?.[0]?.date),
    googleResourceName: resourceName,
  };
}

function mapConnections(connections: PersonConnection[] | undefined): GoogleContactImport[] {
  const out: GoogleContactImport[] = [];
  for (const person of connections ?? []) {
    const mapped = mapPersonToContact(person);
    if (mapped) out.push(mapped);
  }
  return out;
}

async function peopleApiFetch(
  accessToken: string,
  url: URL,
): Promise<Response> {
  return fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function parsePeopleApiError(res: Response): Promise<never> {
  const err = await res.json().catch(() => ({}));
  const raw =
    (err as { error?: { message?: string } })?.error?.message ||
    `Erro ao ler contatos Google (${res.status})`;
  throw new Error(formatPeopleApiError(raw, res.status));
}

/** Busca contatos no Google (sob demanda). */
export async function searchGoogleContacts(
  accessToken: string,
  query: string,
  options?: { pageSize?: number; pageToken?: string },
): Promise<GoogleContactsPageResult> {
  const q = query.trim();
  if (q.length < GOOGLE_CONTACTS_MIN_QUERY_LEN) {
    return { contacts: [], nextPageToken: null };
  }

  const pageSize = Math.min(
    Math.max(options?.pageSize ?? GOOGLE_CONTACTS_PAGE_SIZE, 1),
    30,
  );

  const url = new URL(`${PEOPLE_API}/people:searchContacts`);
  url.searchParams.set('query', q);
  url.searchParams.set('readMask', READ_MASK);
  url.searchParams.set('pageSize', String(pageSize));
  if (options?.pageToken) url.searchParams.set('pageToken', options.pageToken);

  const res = await peopleApiFetch(accessToken, url);
  if (!res.ok) await parsePeopleApiError(res);

  const data = (await res.json()) as {
    results?: { person?: PersonConnection }[];
    nextPageToken?: string;
  };

  const contacts: GoogleContactImport[] = [];
  for (const row of data.results ?? []) {
    if (!row.person) continue;
    const mapped = mapPersonToContact(row.person);
    if (mapped) contacts.push(mapped);
  }

  return {
    contacts,
    nextPageToken: data.nextPageToken ?? null,
  };
}

/** Uma página da lista de conexões (20 por vez). */
export async function fetchGoogleContactsPage(
  accessToken: string,
  options?: { pageSize?: number; pageToken?: string },
): Promise<GoogleContactsPageResult> {
  const pageSize = Math.min(
    Math.max(options?.pageSize ?? GOOGLE_CONTACTS_PAGE_SIZE, 1),
    100,
  );

  const url = new URL(`${PEOPLE_API}/people/me/connections`);
  url.searchParams.set('personFields', PERSON_FIELDS);
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('sortOrder', 'LAST_MODIFIED_ASCENDING');
  if (options?.pageToken) url.searchParams.set('pageToken', options.pageToken);

  const res = await peopleApiFetch(accessToken, url);
  if (!res.ok) await parsePeopleApiError(res);

  const data = (await res.json()) as {
    connections?: PersonConnection[];
    nextPageToken?: string;
  };

  return {
    contacts: mapConnections(data.connections),
    nextPageToken: data.nextPageToken ?? null,
  };
}

/** Import em massa (legado) — percorre todas as páginas. */
export async function fetchGoogleContacts(
  accessToken: string,
): Promise<GoogleContactImport[]> {
  const out: GoogleContactImport[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${PEOPLE_API}/people/me/connections`);
    url.searchParams.set('personFields', PERSON_FIELDS);
    url.searchParams.set('pageSize', String(BULK_PAGE_SIZE));
    url.searchParams.set('sortOrder', 'LAST_MODIFIED_ASCENDING');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await peopleApiFetch(accessToken, url);
    if (!res.ok) await parsePeopleApiError(res);

    const data = (await res.json()) as {
      connections?: PersonConnection[];
      nextPageToken?: string;
    };

    out.push(...mapConnections(data.connections));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return out;
}

/** Busca contatos por resourceName (import seletivo). */
export async function fetchGoogleContactsByResourceNames(
  accessToken: string,
  resourceNames: string[],
): Promise<GoogleContactImport[]> {
  const unique = [...new Set(resourceNames.map((r) => r.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const out: GoogleContactImport[] = [];
  const batchSize = 50;

  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const url = new URL(`${PEOPLE_API}/people:batchGet`);
    url.searchParams.set('personFields', PERSON_FIELDS);
    for (const rn of batch) {
      url.searchParams.append('resourceNames', rn);
    }

    const res = await peopleApiFetch(accessToken, url);
    if (!res.ok) await parsePeopleApiError(res);

    const data = (await res.json()) as { responses?: { person?: PersonConnection }[] };
    for (const row of data.responses ?? []) {
      if (!row.person) continue;
      const mapped = mapPersonToContact(row.person);
      if (mapped) out.push(mapped);
    }
  }

  return out;
}
