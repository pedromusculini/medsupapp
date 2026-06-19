import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  requireGoogleContactsToken,
  isContactsError,
} from '@/lib/contactsAuth';
import {
  fetchGoogleContactsByResourceNames,
  type GoogleContactImport,
} from '@/lib/googleContacts';
import {
  getGoogleContactsCached,
  invalidateGoogleContactsCache,
} from '@/lib/googleContactsCache';
import {
  createClienteRecord,
  findClienteByContato,
  loadClientesStore,
  saveClientesStore,
} from '@/lib/clientesDrive';

export const runtime = 'nodejs';

function importContactsToStore(
  store: Awaited<ReturnType<typeof loadClientesStore>>,
  imports: GoogleContactImport[],
) {
  let criados = 0;
  let ignorados = 0;

  for (const contact of imports) {
    const existente = findClienteByContato(store, {
      email: contact.email,
      telefone: contact.telefone,
    });

    if (existente) {
      ignorados++;
      if (!existente.email && contact.email) existente.email = contact.email;
      if (!existente.telefone && contact.telefone) {
        existente.telefone = contact.telefone;
      }
      if (!existente.data_nascimento && contact.data_nascimento) {
        existente.data_nascimento = contact.data_nascimento;
      }
      const tag = 'Importado do Google Contatos';
      if (
        existente.observacoes_gerais &&
        !existente.observacoes_gerais.includes(tag)
      ) {
        existente.observacoes_gerais = `${existente.observacoes_gerais}\n${tag}`;
      } else if (!existente.observacoes_gerais) {
        existente.observacoes_gerais = tag;
      }
      existente.updated_at = new Date().toISOString();
      continue;
    }

    const cliente = createClienteRecord({
      nome: contact.nome,
      email: contact.email,
      telefone: contact.telefone,
      data_nascimento: contact.data_nascimento,
      observacoes_gerais: 'Importado do Google Contatos',
    });
    store.clientes.push(cliente);
    criados++;
  }

  return { criados, ignorados };
}

/** Importa contatos selecionados (ou todos, se importAll) para clientes.json no Drive. */
export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const driveToken = await requireGoogleAccessToken(req);
  if (isDriveError(driveToken)) return driveToken;

  const contactsToken = await requireGoogleContactsToken(req);
  if (isContactsError(contactsToken)) return contactsToken;

  const body = await req.json().catch(() => ({}));
  const resourceNames = Array.isArray(body.resourceNames)
    ? body.resourceNames.filter((r: unknown) => typeof r === 'string' && r.trim())
    : [];
  const importAll = body.importAll === true;

  if (!importAll && resourceNames.length === 0) {
    return NextResponse.json(
      { error: 'Selecione ao menos um contato ou use importAll.' },
      { status: 400 },
    );
  }

  try {
    invalidateGoogleContactsCache(email);

    let imports: GoogleContactImport[];
    if (importAll) {
      const cached = await getGoogleContactsCached(email, contactsToken, { force: true });
      imports = cached.contacts;
    } else {
      imports = await fetchGoogleContactsByResourceNames(contactsToken, resourceNames);
    }

    if (imports.length === 0) {
      return NextResponse.json({
        success: true,
        totalGoogle: 0,
        criados: 0,
        ignorados: 0,
        storage: 'google_drive',
      });
    }

    const store = await loadClientesStore(driveToken, email);
    const { criados, ignorados } = importContactsToStore(store, imports);

    if (criados > 0 || ignorados > 0) {
      await saveClientesStore(driveToken, store);
    }

    return NextResponse.json({
      success: true,
      totalGoogle: imports.length,
      criados,
      ignorados,
      storage: 'google_drive',
    });
  } catch (err: unknown) {
    console.error('[sync-google-contacts]', err);
    const message =
      err instanceof Error ? err.message : 'Erro ao importar contatos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
