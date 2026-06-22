import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  requireGoogleContactsToken,
  isContactsError,
} from '@/lib/contactsAuth';
import type { GoogleContactImport } from '@/lib/googleContacts';
import { GOOGLE_CONTACTS_MIN_QUERY_LEN } from '@/lib/googleContacts';
import {
  getGoogleContactsSearchCached,
  GOOGLE_CONTACTS_CACHE_TTL_MS,
} from '@/lib/googleContactsCache';
import {
  filterClientes,
  findClienteByContato,
  findClienteByNome,
  loadClientesStore,
} from '@/lib/clientesDrive';
import {
  enrichOpcoesComGoogle,
  googleOpcaoIdFromContact,
} from '@/lib/pacienteOpcoesUi';
import { formatPhoneDisplay } from '@/lib/phone';
import { phoneDigits } from '@/lib/phoneMatch';
import type { PacienteOpcao } from '@/lib/types';

function mapDrive(c: {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  convenio: string | null;
}): PacienteOpcao {
  return {
    id: `d:${c.id}`,
    nome: c.nome,
    telefone: c.telefone ? formatPhoneDisplay(c.telefone) : null,
    email: c.email,
    cpf: c.cpf,
    data_nascimento: c.data_nascimento,
    convenio: c.convenio,
    origem: 'drive',
  };
}

function enrichDriveOpcao(
  opcoes: PacienteOpcao[],
  driveId: string,
  patch: Partial<Pick<PacienteOpcao, 'telefone' | 'telefoneSugerido' | 'email' | 'data_nascimento'>>,
): void {
  const idx = opcoes.findIndex((o) => o.id === `d:${driveId}`);
  if (idx < 0) return;
  const cur = opcoes[idx];
  if (!cur.telefone && patch.telefone) {
    cur.telefone = patch.telefone;
    cur.telefoneSugerido = patch.telefoneSugerido ?? patch.telefone;
  }
  if (!cur.email && patch.email) cur.email = patch.email;
  if (!cur.data_nascimento && patch.data_nascimento) {
    cur.data_nascimento = patch.data_nascimento;
  }
}

function appendGoogleContactsFromImports(
  opcoes: PacienteOpcao[],
  seenPhones: Set<string>,
  imports: GoogleContactImport[],
  filterQuery: string,
  store: Awaited<ReturnType<typeof loadClientesStore>> | null,
) {
  for (const contact of imports) {
    const tel = contact.telefone ? formatPhoneDisplay(contact.telefone) : null;
    const pd = phoneDigits(tel);
    const nome = contact.nome?.trim();
    if (!nome) continue;

    if (filterQuery) {
      const hay = `${nome} ${tel ?? ''} ${contact.email ?? ''}`.toLowerCase();
      if (!hay.includes(filterQuery)) continue;
    }

    const gid = googleOpcaoIdFromContact(contact);
    if (opcoes.some((o) => o.id === gid)) continue;

    if (pd && seenPhones.has(pd)) continue;

    if (store) {
      const existente =
        findClienteByContato(store, {
          telefone: contact.telefone,
          email: contact.email,
        }) ?? findClienteByNome(store, nome);

      if (existente) {
        enrichDriveOpcao(opcoes, existente.id, {
          telefone: tel,
          telefoneSugerido: tel,
          email: contact.email,
          data_nascimento: contact.data_nascimento,
        });
        if (!opcoes.some((o) => o.id === `d:${existente.id}`)) {
          const merged = mapDrive(existente);
          if (!merged.telefone && tel) {
            merged.telefone = tel;
            merged.telefoneSugerido = tel;
          }
          if (!merged.email && contact.email) merged.email = contact.email;
          if (!merged.data_nascimento && contact.data_nascimento) {
            merged.data_nascimento = contact.data_nascimento;
          }
          opcoes.push(merged);
        }
      }
    }

    if (pd) seenPhones.add(pd);
    opcoes.push({
      id: gid,
      nome,
      telefone: tel,
      email: contact.email,
      cpf: null,
      data_nascimento: contact.data_nascimento,
      convenio: null,
      origem: 'google',
    });
  }
}

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? '';
  const googleEnabled = req.nextUrl.searchParams.get('google') === '1';
  const limitRaw = req.nextUrl.searchParams.get('limit');
  const limit = limitRaw
    ? Math.min(Math.max(parseInt(limitRaw, 10) || 0, 1), 500)
    : 40;

  const opcoes: PacienteOpcao[] = [];
  const seenPhones = new Set<string>();
  let driveConectado = false;
  let aviso: string | null = null;

  const contactsToken = await requireGoogleContactsToken(req);
  const googleContatosDisponivel = !isContactsError(contactsToken);

  let googleImports: GoogleContactImport[] = [];
  const buscaGoogle = q.length >= GOOGLE_CONTACTS_MIN_QUERY_LEN;

  if (googleContatosDisponivel && buscaGoogle && googleEnabled) {
    try {
      const searched = await getGoogleContactsSearchCached(email, contactsToken, q, {
        pageSize: Math.min(limit, 30),
      });
      googleImports = searched.contacts;
      if (searched.quotaExceeded && searched.error) {
        aviso = searched.error;
      }
    } catch {
      aviso =
        'Não foi possível buscar nos Contatos Google — mostrando apenas pacientes do Drive.';
    }
  }

  const driveToken = await requireGoogleAccessToken(req);
  if (isDriveError(driveToken)) {
    const errBody = await driveToken.json().catch(() => ({}));
    aviso =
      aviso ??
      (errBody as { error?: string }).error ??
      'Conecte o Google Drive para ver pacientes cadastrados. Vá em Backup ou Agenda e autorize o Drive.';
  } else {
    driveConectado = true;
    const store = await loadClientesStore(driveToken, email);
    const driveList = filterClientes(store, q || undefined);
    for (const c of driveList) {
      opcoes.push(mapDrive(c));
      const pd = phoneDigits(c.telefone);
      if (pd) seenPhones.add(pd);
    }

    if (googleContatosDisponivel && googleImports.length > 0) {
      appendGoogleContactsFromImports(opcoes, seenPhones, googleImports, '', store);
    }
  }

  if (!driveConectado && googleContatosDisponivel && googleImports.length > 0) {
    appendGoogleContactsFromImports(opcoes, seenPhones, googleImports, '', null);
  }

  const opcoesEnriquecidas = enrichOpcoesComGoogle(opcoes).sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR'),
  );

  const opcoesFinal = opcoesEnriquecidas.slice(0, limit);
  const total = opcoesEnriquecidas.length;

  const maxAgeSec = Math.floor(GOOGLE_CONTACTS_CACHE_TTL_MS / 1000);

  return NextResponse.json(
    {
      opcoes: opcoesFinal,
      total,
      google_contatos_disponivel: googleContatosDisponivel,
      google_busca_ativa: buscaGoogle,
      drive_conectado: driveConectado,
      aviso,
      hint_busca_google:
        googleContatosDisponivel && !googleEnabled
          ? 'Marque "Buscar nos Contatos Google" e pressione Enter para incluir a agenda Google.'
          : googleContatosDisponivel && googleEnabled && !buscaGoogle
            ? `Pressione Enter na busca com pelo menos ${GOOGLE_CONTACTS_MIN_QUERY_LEN} caracteres para buscar no Google.`
            : null,
    },
    {
      headers: {
        'Cache-Control': `private, max-age=${maxAgeSec}`,
      },
    },
  );
}
