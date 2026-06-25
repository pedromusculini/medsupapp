import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { normalizePhoneForStorage, isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/phone';
import {
  findCliente,
  loadClientesStore,
  normalizeSexo,
  saveClientesStore,
} from '@/lib/clientesDrive';
import {
  buildProntuarioAccessStatus,
  filterClienteDetalhe,
} from '@/lib/prontuarioAcesso';
import { syncRealizadasAgendaToClienteDrive } from '@/lib/syncClienteAtendimentosFromAgenda';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, id);
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const sync = await syncRealizadasAgendaToClienteDrive(email, store, {
    clienteId: id,
  });
  if (sync.atendimentos_created > 0) {
    await saveClientesStore(tokenResult, store);
  }

  const access = await buildProntuarioAccessStatus(email, req);
  const clienteFiltrado = filterClienteDetalhe(cliente, access.locked);

  return NextResponse.json({
    cliente: clienteFiltrado,
    storage: 'google_drive',
    sync_atendimentos: sync,
    prontuarioAccess: {
      locked: access.locked,
      pinConfigured: access.pinConfigured,
      modoRecepcao: access.modoRecepcao,
      unlocked: access.unlocked,
    },
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, id);
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const body = await req.json();
  const nome = body.nome !== undefined ? String(body.nome).trim() : cliente.nome;
  if (!nome || nome.length < 2) {
    return NextResponse.json({ error: 'Nome inválido' }, { status: 400 });
  }

  cliente.nome = nome;
  if (body.email !== undefined) cliente.email = body.email?.trim() || null;
  if (body.telefone !== undefined) {
    const raw = body.telefone?.trim() || '';
    if (raw && !isValidPhone(raw)) {
      return NextResponse.json({ error: PHONE_VALIDATION_MESSAGE }, { status: 400 });
    }
    cliente.telefone = raw ? normalizePhoneForStorage(raw) : null;
  }
  if (body.cpf !== undefined) cliente.cpf = body.cpf?.trim() || null;
  if (body.data_nascimento !== undefined) cliente.data_nascimento = body.data_nascimento || null;
  if (body.sexo !== undefined) cliente.sexo = normalizeSexo(body.sexo);
  if (body.convenio !== undefined) cliente.convenio = body.convenio?.trim() || null;
  if (body.observacoes_gerais !== undefined) {
    cliente.observacoes_gerais = body.observacoes_gerais?.trim() || null;
  }
  cliente.updated_at = new Date().toISOString();

  await saveClientesStore(tokenResult, store);
  return NextResponse.json({ cliente, storage: 'google_drive' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  const idx = store.clientes.findIndex((c) => c.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  store.clientes.splice(idx, 1);
  await saveClientesStore(tokenResult, store);
  return NextResponse.json({ success: true });
}
