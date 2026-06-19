import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  createClienteRecord,
  filterClientes,
  loadClientesStore,
  saveClientesStore,
} from '@/lib/clientesDrive';

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const q = new URL(req.url).searchParams.get('q')?.trim();
  const somenteComAtendimento =
    new URL(req.url).searchParams.get('com_atendimento') === '1';
  const store = await loadClientesStore(tokenResult, email);
  let list = filterClientes(store, q);
  if (somenteComAtendimento) {
    list = list.filter((c) => c.atendimentos.length > 0);
  }
  const clientes = list.map(({ atendimentos, observacoes, pagamentos, ...c }) => ({
    ...c,
    tem_atendimento: atendimentos.length > 0,
  }));

  return NextResponse.json({ clientes, storage: 'google_drive' });
}

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = await req.json();
  const cliente = createClienteRecord(body);
  if (!cliente.nome || cliente.nome.length < 2) {
    return NextResponse.json({ error: 'Nome é obrigatório (mín. 2 caracteres).' }, { status: 400 });
  }

  const store = await loadClientesStore(tokenResult, email);
  store.clientes.push(cliente);
  await saveClientesStore(tokenResult, store);

  return NextResponse.json({ cliente, storage: 'google_drive' }, { status: 201 });
}
